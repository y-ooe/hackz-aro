import {
    EC2Client,
    RunInstancesCommand,
    DescribeInstancesCommand,
    DescribeSecurityGroupsCommand,
    CreateSecurityGroupCommand,
    AuthorizeSecurityGroupIngressCommand,
    waitUntilInstanceRunning,
} from '@aws-sdk/client-ec2';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// ---- 公開する型 -----------------------------------------------------------

export interface DeployEc2Options {
    /** 配信するHTML（index.html として nginx で公開される） */
    html: string;
    /** インスタンスの Name タグ。未指定なら "hackathon-web" */
    name?: string;
    /** リージョン。未指定なら env か東京(ap-northeast-1) */
    region?: string;
    /** インスタンスタイプ。未指定なら t3.micro */
    instanceType?: string;
    /** 起動から何分後に自動終了(terminate)するか。未指定なら 3 分 */
    shutdownMinutes?: number;
}

export interface DeployEc2Result {
    instanceId: string;
    region: string;
    publicIp: string;
    url: string;
}

// terraform/main.tf と同じ：HTTP(80)を全開放するセキュリティグループ名
const SECURITY_GROUP_NAME = 'hackathon-web-sg';

// ---- メイン関数 -----------------------------------------------------------

/**
 * 生成HTMLを EC2 インスタンスにデプロイする（terraform/main.tf 相当を実行時に行う）。
 *
 * 1. 最新の Amazon Linux 2023 AMI を SSM から取得
 * 2. HTTP(80)を開けるセキュリティグループを用意（無ければ作成）
 * 3. nginx を入れて HTML を index.html として配信する user_data でインスタンスを起動
 * 4. running になるまで待ち、公開IPからURLを組み立てて返す
 *
 * AWS認証情報・リージョンは環境変数(.env: AWS_REGION / AWS_ACCESS_KEY_ID など)を使う。
 *
 * 注意: 起動直後は user_data(nginx導入)の実行中で、URLは数十秒〜1分ほど
 *       アクセスできないことがある。
 */
export async function deployEc2(opts: DeployEc2Options): Promise<DeployEc2Result> {
    const region = opts.region ?? process.env.AWS_REGION ?? 'ap-northeast-1';
    const instanceType = opts.instanceType ?? 't3.micro';
    const name = opts.name ?? 'hackathon-web';
    const shutdownMinutes = opts.shutdownMinutes ?? 3;

    if (!opts.html) {
        throw new Error('デプロイ対象のHTMLがありません');
    }

    const ec2 = new EC2Client({ region });

    // 1. 最新の Amazon Linux 2023 AMI を取得
    const amiId = await getLatestAl2023Ami(region);

    // 2. セキュリティグループを用意(HTTP 80 を全開放)
    const securityGroupId = await ensureSecurityGroup(ec2);

    // 3. user_data を組み立ててインスタンスを起動
    const userData = buildUserData(opts.html, shutdownMinutes);
    const run = await ec2.send(
        new RunInstancesCommand({
            ImageId: amiId,
            InstanceType: instanceType as any,
            MinCount: 1,
            MaxCount: 1,
            SecurityGroupIds: [securityGroupId],
            UserData: Buffer.from(userData).toString('base64'),
            // OSのシャットダウン(=自動終了タイマー)で terminate されるようにする
            InstanceInitiatedShutdownBehavior: 'terminate',
            TagSpecifications: [
                {
                    ResourceType: 'instance',
                    Tags: [{ Key: 'Name', Value: name }],
                },
            ],
        }),
    );

    const instanceId = run.Instances?.[0]?.InstanceId;
    if (!instanceId) {
        throw new Error('EC2インスタンスの起動に失敗しました');
    }

    // 4. running になるまで待つ
    await waitUntilInstanceRunning(
        { client: ec2, maxWaitTime: 180 },
        { InstanceIds: [instanceId] },
    );

    // 5. 公開IPを取得
    const publicIp = await getPublicIp(ec2, instanceId);
    if (!publicIp) {
        throw new Error('EC2インスタンスの公開IPが取得できませんでした');
    }

    const url = `http://${publicIp}`;
    console.log(`Deployed to EC2: ${url} (instance ${instanceId})`);

    return { instanceId, region, publicIp, url };
}

// ---- 内部ヘルパー ---------------------------------------------------------

/**
 * 起動時に1回だけ走るスクリプト：nginx を入れて HTML を index.html として配信する。
 * shutdownMinutes 分後に自動シャットダウン → 自動終了する。
 */
function buildUserData(html: string, shutdownMinutes: number): string {
    const htmlBase64 = Buffer.from(html).toString('base64');
    return `#!/bin/bash
set -e
dnf install -y nginx
systemctl enable --now nginx
echo "${htmlBase64}" | base64 -d > /usr/share/nginx/html/index.html
systemctl restart nginx
# ${shutdownMinutes}分後に自動シャットダウン → InstanceInitiatedShutdownBehavior=terminate で自動削除
shutdown -h +${shutdownMinutes}
`;
}

/** 最新の Amazon Linux 2023 AMI ID を SSM パラメータから取得する。 */
async function getLatestAl2023Ami(region: string): Promise<string> {
    const ssm = new SSMClient({ region });
    const res = await ssm.send(
        new GetParameterCommand({
            Name: '/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64',
        }),
    );
    const amiId = res.Parameter?.Value;
    if (!amiId) {
        throw new Error('Amazon Linux 2023 の AMI が取得できませんでした');
    }
    return amiId;
}

/**
 * HTTP(80)を全開放するセキュリティグループを用意する。
 * 既に同名のものがあれば再利用し、無ければデフォルトVPCに作成する。
 */
async function ensureSecurityGroup(ec2: EC2Client): Promise<string> {
    // 既存を探す
    const existing = await ec2.send(
        new DescribeSecurityGroupsCommand({
            Filters: [{ Name: 'group-name', Values: [SECURITY_GROUP_NAME] }],
        }),
    );
    const found = existing.SecurityGroups?.[0]?.GroupId;
    if (found) return found;

    // 無ければ作成
    const created = await ec2.send(
        new CreateSecurityGroupCommand({
            GroupName: SECURITY_GROUP_NAME,
            Description: 'Allow HTTP inbound',
        }),
    );
    const groupId = created.GroupId;
    if (!groupId) {
        throw new Error('セキュリティグループの作成に失敗しました');
    }

    // HTTP(80)を 0.0.0.0/0 から許可
    await ec2.send(
        new AuthorizeSecurityGroupIngressCommand({
            GroupId: groupId,
            IpPermissions: [
                {
                    IpProtocol: 'tcp',
                    FromPort: 80,
                    ToPort: 80,
                    IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'HTTP' }],
                },
            ],
        }),
    );

    return groupId;
}

/** インスタンスの公開IPアドレスを取得する。 */
async function getPublicIp(ec2: EC2Client, instanceId: string): Promise<string | undefined> {
    const res = await ec2.send(
        new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
    );
    return res.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress;
}
