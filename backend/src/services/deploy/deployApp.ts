import { renderPreviewHtml } from "../renderPreview.js";
import { deployHtml } from "./deployHtml.js";
import { makeBucketName } from "./deployStaticSite.js";

export interface DeployResult {
  url: string;
}

/**
 * 生成したアプリ(.jsx)を S3 にデプロイする。
 *
 * 1. JSX を、CDN参照の単一HTML(どの環境でも動く)に包む
 * 2. deployHtml() で S3 バケットを用意し index.html として公開アップロード
 * 3. 公開URLを返す
 *
 * AWS認証情報・リージョンは環境変数(.env: AWS_REGION / AWS_ACCESS_KEY_ID など)を使う。
 */
export async function deployApp(
  projectName: string,
  jsx: string
): Promise<DeployResult> {
  if (!jsx) {
    throw new Error("デプロイ対象のアプリがまだ生成されていません");
  }

  // 1. デプロイ可能な単一HTMLを生成
  const html = renderPreviewHtml(jsx);

  // 2. S3 に公開アップロード(バケット名はプロジェクト名から一意に生成)
  const result = await deployHtml({
    html,
    bucketName: makeBucketName(projectName),
  });

  console.log(`Deployed to S3: ${result.url}`);

  // 3. 公開URLを返す
  return { url: result.url };
}
