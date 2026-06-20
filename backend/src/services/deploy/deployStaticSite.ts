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
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// ---- 公開する型 -----------------------------------------------------------

export interface DeployOptions {
    /** AIが生成したReactプロジェクトのディレクトリ */
    projectDir: string;
    /** S3バケット名（グローバルに一意・小文字英数とハイフンのみ） */
    bucketName: string;
    /** AWSリージョン。未指定なら env か東京 */
    region?: string;
    /** 既にビルド済みなら true にして install/build をスキップ */
    skipBuild?: boolean;
    /** デフォルトは 'npm install' */
    installCommand?: string;
    /** デフォルトは 'npm run build' */
    buildCommand?: string;
    /** 成果物フォルダを手動指定したい場合（通常は自動検出） */
    outputDir?: string;
}

export interface DeployResult {
    bucketName: string;
    region: string;
    url: string;
    uploadedFiles: number;
}

// ---- メイン関数 -----------------------------------------------------------

export async function deployStaticSite(opts: DeployOptions): Promise<DeployResult> {
    const region = opts.region ?? process.env.AWS_REGION ?? 'us-east-1';
    const projectDir = path.resolve(opts.projectDir);
    const s3 = new S3Client({ region });

    // 1. ビルド（install → build）。ログはサーバのコンソールに流す
    if (!opts.skipBuild) {
        await run(opts.installCommand ?? 'npm install', projectDir);
        await run(opts.buildCommand ?? 'npm run build', projectDir);
    }

    // 2. 成果物フォルダを特定（Vite=dist / Create React App=build）
    const outputDir = await detectOutputDir(projectDir, opts.outputDir);

    // 3. バケットを用意（無ければ作成・既にあれば再利用）
    await ensureBucket(s3, opts.bucketName, region);

    // 4. パブリックアクセスブロックを解除（静的公開のため）
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

    // 5. 誰でも GetObject できるバケットポリシーを付与
    //    （ブロック解除直後は反映待ちで失敗することがあるので軽くリトライ）
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

    // 6. 静的ウェブサイトホスティング設定。
    //    SPA対応で error も index.html に向ける（/about 直アクセス対策）
    await s3.send(
        new PutBucketWebsiteCommand({
            Bucket: opts.bucketName,
            WebsiteConfiguration: {
                IndexDocument: { Suffix: 'index.html' },
                ErrorDocument: { Key: 'index.html' },
            },
        }),
    );

    // 7. 成果物をアップロード
    const uploadedFiles = await uploadDir(s3, opts.bucketName, outputDir);

    // 8. 公開URLを返す
    const url = websiteEndpoint(opts.bucketName, region);
    return { bucketName: opts.bucketName, region, url, uploadedFiles };
}

/** アプリ名から一意なバケット名を作る（例: "アイス家計簿" → "app-3f9k2a"） */
export function makeBucketName(appName: string): string {
    const slug =
        appName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40) || 'app';
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${slug}-${suffix}`;
}

// ---- 内部ヘルパー ---------------------------------------------------------

/** install/build などの外部コマンドを実行（cwd 指定・クロスプラットフォーム） */
function run(command: string, cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, { cwd, shell: true, stdio: 'inherit' });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`コマンド失敗 (exit ${code}): ${command}`));
        });
    });
}

async function detectOutputDir(projectDir: string, override?: string): Promise<string> {
    if (override) return path.resolve(projectDir, override);
    for (const candidate of ['dist', 'build']) {
        const p = path.join(projectDir, candidate);
        try {
            if ((await fs.stat(p)).isDirectory()) return p;
        } catch {
            // 無ければ次の候補へ
        }
    }
    throw new Error(
        'ビルド成果物フォルダ（dist/ または build/）が見つかりません。ビルドが成功したか確認してください。',
    );
}

async function ensureBucket(s3: S3Client, bucket: string, region: string): Promise<void> {
    const input: CreateBucketCommandInput = { Bucket: bucket };
    // us-east-1 だけは LocationConstraint を付けてはいけない
    if (region !== 'us-east-1') {
        input.CreateBucketConfiguration = { LocationConstraint: region as BucketLocationConstraint };
    }
    try {
        await s3.send(new CreateBucketCommand(input));
    } catch (err: any) {
        // 既に自分が所有しているバケットならそのまま使う
        if (err?.name === 'BucketAlreadyOwnedByYou') return;
        throw err;
    }
}

async function uploadDir(s3: S3Client, bucket: string, dir: string): Promise<number> {
    const files = await walk(dir);
    let uploaded = 0;
    const concurrency = 8;
    for (let i = 0; i < files.length; i += concurrency) {
        const batch = files.slice(i, i + concurrency);
        await Promise.all(
            batch.map(async (absPath) => {
                // S3のキーは常にスラッシュ区切り（Windowsの\\を変換）
                const key = path.relative(dir, absPath).split(path.sep).join('/');
                const body = await fs.readFile(absPath);
                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucket,
                        Key: key,
                        Body: body,
                        ContentType: contentTypeFor(key),
                        // index.html は毎回最新を見せたいのでキャッシュさせない
                        CacheControl: key === 'index.html' ? 'no-cache' : 'public, max-age=3600',
                    }),
                );
                uploaded++;
            }),
        );
    }
    return uploaded;
}

/** ディレクトリを再帰的に辿って全ファイルの絶対パスを返す */
async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((e) => {
            const res = path.resolve(dir, e.name);
            return e.isDirectory() ? walk(res) : Promise.resolve([res]);
        }),
    );
    return nested.flat();
}

/** 拡張子から Content-Type を引く（必要なら mime-types パッケージに差し替え可） */
function contentTypeFor(key: string): string {
    return MIME[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
}

const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json',
};

/**
 * S3静的ウェブサイトの公開URLを組み立てる。
 * リージョンによって区切りが "-"（古い）か "."（新しい）で変わる罠がある。
 * 例: ap-northeast-1(東京)=ダッシュ, ap-northeast-3(大阪)=ドット
 */
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