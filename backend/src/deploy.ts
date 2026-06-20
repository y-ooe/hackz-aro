import { markSessionDeployed, type SessionRow } from "./db.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DeployResult {
  url: string;
}

/** 生成物(.jsx)の保存先ディレクトリ */
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
 * 生成したアプリをデプロイする。
 *
 * 現状は、生成された .jsx を generated/ フォルダに保存し、
 * セッションを deployed 状態にする。
 * 実際のAWSデプロイ処理は相方が実装するため、ここでは保存までを行う。
 *
 * TODO(相方): ここで保存した .jsx を AWS(S3/CloudFront 等)へ配置し、
 *             公開URLを deployUrl として markSessionDeployed に渡す。
 */
export async function deployApp(session: SessionRow): Promise<DeployResult> {
  if (!session.current_jsx) {
    throw new Error("デプロイ対象のアプリがまだ生成されていません");
  }

  // 生成された .jsx をファイルに保存
  const safeName = sanitizeName(session.project_name);
  await mkdir(GENERATED_DIR, { recursive: true });
  const filePath = path.join(GENERATED_DIR, `${safeName}.jsx`);
  await writeFile(filePath, session.current_jsx, "utf-8");
  console.log(`Deployed: ${filePath} を保存しました`);

  // --- ここに相方のAWSデプロイAPI呼び出しが入る想定 ---
  // const deployUrl = await uploadToAws(filePath);
  const deployUrl = `http://localhost:3000/preview/${session.id}`;

  await markSessionDeployed(session.id, deployUrl);

  return { url: deployUrl };
}
