import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderPreviewHtml } from "./renderPreview.js";

export interface DeployResult {
  url: string;
}

/** 生成物の保存先ディレクトリ */
export const GENERATED_DIR = path.resolve(import.meta.dirname, "../generated");

/** プロジェクト名をファイル名として安全な形に整える */
function sanitizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "app";
}

/**
 * 生成したアプリ(.jsx)をデプロイする。
 *
 * 現状は、生成された .jsx と、それを単一HTMLに包んだ .html を
 * generated/ フォルダに保存する(DBは使わない)。
 *
 * TODO(相方): ここで保存した .html を AWS(S3/CloudFront 等)へ配置し、
 *             公開URLを deployUrl として返す。
 */
export async function deployApp(
  projectName: string,
  jsx: string
): Promise<DeployResult> {
  if (!jsx) {
    throw new Error("デプロイ対象のアプリがまだ生成されていません");
  }

  const safeName = sanitizeName(projectName);
  await mkdir(GENERATED_DIR, { recursive: true });

  const jsxPath = path.join(GENERATED_DIR, `${safeName}.jsx`);
  const htmlPath = path.join(GENERATED_DIR, `${safeName}.html`);
  await writeFile(jsxPath, jsx, "utf-8");
  await writeFile(htmlPath, renderPreviewHtml(jsx), "utf-8");
  console.log(`Deployed: ${jsxPath} / ${htmlPath} を保存しました`);

  // --- ここに相方のAWSデプロイAPI呼び出しが入る想定 ---
  // const deployUrl = await uploadToAws(htmlPath);
  const deployUrl = `(ローカル保存) generated/${safeName}.html`;

  return { url: deployUrl };
}
