import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-opus-4-8";

/** 生成したアプリの保存先ディレクトリ */
export const GENERATED_DIR = path.resolve(import.meta.dirname, "../generated");

export type TargetCloud = "vercel" | "aws" | "gcp" | "cloudflare";

export interface DeployRequest {
  projectName: string;
  targetCloud: TargetCloud;
  prompt: string;
}

/** プロジェクト名をファイル名として安全な形に整える */
function sanitizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "app";
}

const AppSchema = z.object({
  summary: z.string().describe("生成するアプリの構成・技術選定を1〜2文で説明"),
  html: z
    .string()
    .describe(
      "完全に自己完結した単一HTMLファイルの全内容。CSSは<style>、JavaScriptは<script>にインラインで含める。"
    ),
});

export async function runDeploy(
  req: DeployRequest,
  onChunk: (raw: string) => void
): Promise<void> {
  const safeName = sanitizeName(req.projectName);
  const log = (level: string, message: string) =>
    onChunk(JSON.stringify({ level, message }));

  log("info", `要件を解析しています: "${req.prompt.slice(0, 50)}..."`);
  log(
    "thought",
    "単一HTMLファイル(CSS/JSインライン、ライブラリはCDN読み込み)でアプリを構築する方針を決定しました。"
  );
  log("tool", "AI(claude-opus-4-8)にアプリのコード生成をリクエストしています…");

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(AppSchema) },
    system:
      "あなたは優秀なWebアプリ生成エージェントです。ユーザーの要望に基づき、" +
      "完全に自己完結した単一のHTMLファイルを生成してください。" +
      "CSSは<style>タグ、JavaScriptは<script>タグにインラインで含め、" +
      "外部ライブラリが必要な場合はCDN(unpkg / jsDelivr / cdnjs)から読み込んでください。" +
      "そのファイルをブラウザで開くだけで動作する、見た目も整った完成品にしてください。",
    messages: [
      {
        role: "user",
        content: `プロジェクト名: ${req.projectName}\nアプリの要望: ${req.prompt}`,
      },
    ],
  });

  const app = response.parsed_output;
  if (!app) {
    throw new Error("コード生成に失敗しました");
  }

  log("thought", app.summary);
  log(
    "tool",
    `filesystem.write → ${safeName}.html を生成しました (${app.html.length}文字)`
  );

  await mkdir(GENERATED_DIR, { recursive: true });
  const filePath = path.join(GENERATED_DIR, `${safeName}.html`);
  await writeFile(filePath, app.html, "utf-8");

  log("success", `コードを生成して ${safeName}.html に保存しました。`);

  // 完了イベント: フロントの ResultPanel がこのURLをリンク表示する
  onChunk(JSON.stringify({ url: `http://localhost:3000/preview/${safeName}` }));
}
