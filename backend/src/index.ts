import express from "express";
import dotenv from "dotenv";
import path from "node:path";

import { chatWithTools } from "./claude.js";
import { generateOrEditApp, type ChatMessage } from "./agent.js";
import { deployApp } from "./deploy.js";

import { deployStaticSite, makeBucketName } from './deployStaticSite.js';
import { deployHtml } from './deployHtml.js';


dotenv.config();

const app = express();
const VENDOR_DIR = path.resolve(import.meta.dirname, "../public/vendor");

app.use(express.json({ limit: '5mb' }));
app.use("/vendor", express.static(VENDOR_DIR));

const PORT = 3000;

app.get("/", (_request, response) => {
  response.status(200).send("Hello World");
});

// === チャット（生成・修正）: ステートレス NDJSONストリーム ===
// 状態はフロント側(React state / localStorage)が保持し、毎回まとめて送ってくる。
app.post("/api/generate", async (request, response) => {
  const { messages, currentJsx, message } = request.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    response.status(400).json({ error: "message is required" });
    return;
  }

  // これまでの会話履歴(role/contentのみ採用)
  const history: ChatMessage[] = Array.isArray(messages)
    ? messages
        .filter(
          (m: unknown): m is ChatMessage =>
            !!m &&
            typeof (m as ChatMessage).content === "string" &&
            ((m as ChatMessage).role === "user" ||
              (m as ChatMessage).role === "assistant")
        )
        .map((m) => ({ role: m.role, content: m.content }))
    : [];

  const jsx: string | null = typeof currentJsx === "string" ? currentJsx : null;

  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-cache");
  response.flushHeaders();

  const write = (obj: unknown) => response.write(JSON.stringify(obj) + "\n");

  try {
    const result = await generateOrEditApp(history, jsx, message);

    write({ type: "reply", text: result.reply });

    if (result.jsx) {
      // 更新後のJSX全文をフロントへ返す(フロントが保持・プレビュー描画する)
      write({ type: "jsx", text: result.jsx });
    }
  } catch (error) {
    console.error(error);
    write({ type: "error", text: "生成処理中にエラーが発生しました" });
  } finally {
    response.end();
  }
});

// === デプロイ（ステートレス・スタブ） ===
app.post("/api/deploy-app", async (request, response) => {
  const { projectName, jsx } = request.body ?? {};

  if (typeof jsx !== "string" || !jsx.trim()) {
    response.status(400).json({ error: "デプロイ対象のアプリがありません" });
    return;
  }

  const name =
    typeof projectName === "string" && projectName.trim()
      ? projectName.trim()
      : "my-app";

  try {
    const result = await deployApp(name, jsx);
    response.status(200).json(result);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "デプロイに失敗しました";
    response.status(500).json({ error: message });
  }
});

// react-scripts でビルドした静的サイトを S3 にデプロイするパス
app.post('/deploy', async (req, res) => {
  const { projectDir, appName } = req.body as { projectDir?: string; appName?: string };

  if (!projectDir) {
    return res.status(400).json({ error: 'projectDir は必須です' });
  }

  try {
    const result = await deployStaticSite({
      projectDir,
      bucketName: makeBucketName(appName ?? 'app'),
      // region は env (AWS_REGION) で指定。未指定なら東京(ap-northeast-1)
    });
    // result.url をフロントに返せば、そのままアクセスできる
    res.json(result);
  } catch (err) {
    console.error('[deploy] 失敗:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'デプロイに失敗しました',
    });
  }
});

// 単一HTMLファイルを S3 にデプロイするパス
app.post('/deploy-html', async (req, res) => {
  const { html, htmlPath, appName } = req.body as {
    html?: string;
    htmlPath?: string;
    appName?: string;
  };

  if (!html && !htmlPath) {
    return res.status(400).json({ error: 'html か htmlPath のどちらかが必要です' });
  }

  try {
    const result = await deployHtml({
      ...(html !== undefined && { html }),
      ...(htmlPath !== undefined && { htmlPath }),
      bucketName: makeBucketName(appName ?? 'app'),
    });
    res.json(result);
  } catch (err) {
    console.error('[deploy-html] 失敗:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'デプロイに失敗しました',
    });
  }
});

// === topaz.dev アイデア検索チャット（既存・残置） ===
app.post("/api/chat", async (request, response) => {
  const { message } = request.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    response.status(400).json({ error: "message is required" });
    return;
  }
  try {
    const reply = await chatWithTools(message);
    response.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "internal server error" });
  }
});

app.listen(PORT, () => {
  console.log("Server running at PORT: ", PORT);
}).on("error", (error) => {
  throw new Error(error.message);
});
