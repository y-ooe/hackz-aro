import {
    S3Client,
    CreateBucketCommand,
    PutPublicAccessBlockCommand,
    PutBucketPolicyCommand,
    PutBucketWebsiteCommand,
    PutObjectCommand,
    type CreateBucketCommandInput,
    type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'node:fs';

// ---- 公開する型 -----------------------------------------------------------

export interface DeployHtmlOptions {
    /** HTML文字列を直接渡す（html か htmlPath のどちらか必須） */
    html?: string;
    /** または .html ファイルのパスを渡す */
    htmlPath?: string;
    /** S3バケット名（グローバルに一意・小文字英数とハイフンのみ） */
    bucketName: string;
    /** リージョン。未指定なら env か東京 */
    region?: string;
}

export interface DeployHtmlResult {
    bucketName: string;
    region: string;
    url: string;
}

// ---- メイン関数 -----------------------------------------------------------

export async function deployHtml(opts: DeployHtmlOptions): Promise<DeployHtmlResult> {
    const region = opts.region ?? process.env.AWS_REGION ?? 'us-east-1';
    const s3 = new S3Client({ region });

    // 1. HTMLの中身を用意（文字列 or ファイルパスのどちらでも）
    const html =
        opts.html ?? (opts.htmlPath ? await fs.readFile(opts.htmlPath, 'utf-8') : undefined);
    if (!html) {
        throw new Error('html（文字列）か htmlPath（ファイルパス）のどちらかを指定してください');
    }

    // 2. バケットを用意（無ければ作成・既にあれば再利用）
    await ensureBucket(s3, opts.bucketName, region);

    // 3. パブリックアクセスブロックを解除（静的公開のため）
    await s3.send(
        new PutPublicAccessBlockCommand({
            Bucket: opts.bucketName,
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: false,
                IgnorePublicAcls: false,
                BlockPublicPolicy: false,
                RestrictPublicBuckets: false,
            },
        }),
    );

    // 4. 誰でも GetObject できるポリシーを付与（反映待ちで失敗しうるので軽くリトライ）
    await retry(() =>
        s3.send(
            new PutBucketPolicyCommand({
                Bucket: opts.bucketName,
                Policy: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Sid: 'PublicReadGetObject',
                            Effect: 'Allow',
                            Principal: '*',
                            Action: 's3:GetObject',
                            Resource: `arn:aws:s3:::${opts.bucketName}/*`,
                        },
                    ],
                }),
            }),
        ),
    );

    // 5. 静的ウェブサイトホスティング設定
    await s3.send(
        new PutBucketWebsiteCommand({
            Bucket: opts.bucketName,
            WebsiteConfiguration: {
                IndexDocument: { Suffix: 'index.html' },
                ErrorDocument: { Key: 'index.html' },
            },
        }),
    );

    // 6. index.html としてアップロード
    await s3.send(
        new PutObjectCommand({
            Bucket: opts.bucketName,
            Key: 'index.html',
            Body: html,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: 'no-cache',
        }),
    );

    return {
        bucketName: opts.bucketName,
        region,
        url: websiteEndpoint(opts.bucketName, region),
    };
}

// ---- 内部ヘルパー（deployStaticSite.ts と同じ内容。共通化したくなったら片方に寄せてOK） ----

async function ensureBucket(s3: S3Client, bucket: string, region: string): Promise<void> {
    const input: CreateBucketCommandInput = { Bucket: bucket };
    // us-east-1 だけは LocationConstraint を付けてはいけない
    if (region !== 'us-east-1') {
        input.CreateBucketConfiguration = { LocationConstraint: region as BucketLocationConstraint };
    }
    try {
        await s3.send(new CreateBucketCommand(input));
    } catch (err: any) {
        if (err?.name === 'BucketAlreadyOwnedByYou') return; // 既に自分のバケットなら再利用
        throw err;
    }
}

function websiteEndpoint(bucket: string, region: string): string {
    const DASH_REGIONS = new Set([
        'us-east-1',
        'us-west-1',
        'us-west-2',
        'ap-southeast-1',
        'ap-southeast-2',
        'ap-northeast-1',
        'eu-west-1',
        'sa-east-1',
        'us-gov-west-1',
    ]);
    const host = DASH_REGIONS.has(region) ? `s3-website-${region}` : `s3-website.${region}`;
    return `http://${bucket}.${host}.amazonaws.com`;
}

async function retry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 1500): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}