import express from "express";
import dotenv from "dotenv";
import path from "node:path";

import { chatWithTools } from "./claude.js";
import { generateOrEditApp, decodeUnicodeEscapes } from "./agent.js";
import { deployApp } from "./deploy.js";
import {
  initDb,
  createSession,
  getSession,
  updateSessionJsx,
  addMessage,
  getMessages,
  deleteSession,
} from "./db.js";

import { deployStaticSite, makeBucketName } from './deployStaticSite.js';
import { deployHtml } from './deployHtml.js';


const TARGET_CLOUDS: TargetCloud[] = ["vercel", "aws", "gcp", "cloudflare"];

dotenv.config();
const app = express();
app.use(express.json({ limit: '5mb' }));
const VENDOR_DIR = path.resolve(import.meta.dirname, "../public/vendor");

/** 純粋なReactコンポーネント(.jsx)を、Babelで動く単一HTMLに包む */
function renderPreviewHtml(jsx: string): string {
  // 古い生成物も含めて正規化:
  //  - 日本語/絵文字の \uXXXX エスケープを実際の文字へ戻す
  //  - CDNでReactをグローバル提供しているため import/export 行を除去
  const code = decodeUnicodeEscapes(jsx)
    .replace(/^\s*import\s.*$/gm, "")
    .replace(/^\s*export\s+default\s+.*$/gm, "")
    // <script>タグ内に埋め込むため、終了タグ文字列だけ無害化する
    .replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="/vendor/react.development.js"></script>
<script src="/vendor/react-dom.development.js"></script>
<script src="/vendor/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="text/plain" id="app-source">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer } = React;
${code}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
<script>
(function () {
  var source = document.getElementById('app-source').textContent;
  try {
    // automatic JSXランタイム(import文を生成)を避け、グローバルReact/ReactDOMで動く形に変換する
    var output = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
    }).code;
    (0, eval)(output);
  } catch (e) {
    document.getElementById('root').innerHTML =
      '<pre style="white-space:pre-wrap;color:#dc2626;padding:16px;font-family:monospace">' +
      String(e && e.stack ? e.stack : e).replace(/</g, '&lt;') +
      '</pre>';
  }
})();
</script>
</body>
</html>`;
}

dotenv.config();
const app = express();
app.use(express.json());
app.use("/vendor", express.static(VENDOR_DIR));

const PORT = 3000;

const TARGET_CLOUDS = ["vercel", "aws", "gcp", "cloudflare"];

app.get("/", (_request, response) => {
  response.status(200).send("Hello World");
});

// === セッション作成 ===
app.post("/api/sessions", async (request, response) => {
  const { projectName, targetCloud } = request.body ?? {};
  const name =
    typeof projectName === "string" && projectName.trim()
      ? projectName.trim()
      : "my-app";
  const cloud = TARGET_CLOUDS.includes(targetCloud) ? targetCloud : "vercel";

  try {
    const session = await createSession(name, cloud);
    response.status(201).json({ sessionId: session.id });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "セッションの作成に失敗しました" });
  }
});

// === チャット（生成・修正）: NDJSONストリーム ===
app.post("/api/sessions/:id/chat", async (request, response) => {
  const sessionId = Number(request.params.id);
  const { message } = request.body ?? {};

  if (!Number.isInteger(sessionId)) {
    response.status(400).json({ error: "invalid session id" });
    return;
  }
  if (typeof message !== "string" || !message.trim()) {
    response.status(400).json({ error: "message is required" });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    response.status(404).json({ error: "session not found" });
    return;
  }

  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-cache");
  response.flushHeaders();

  const write = (obj: unknown) => response.write(JSON.stringify(obj) + "\n");

  try {
    const history = await getMessages(sessionId);
    const result = await generateOrEditApp(
      history,
      session.current_jsx,
      message
    );

    await addMessage(sessionId, "user", message);
    await addMessage(sessionId, "assistant", result.reply);

    write({ type: "reply", text: result.reply });

    if (result.jsx) {
      await updateSessionJsx(sessionId, result.jsx);
      write({ type: "preview_updated" });
    }
  } catch (error) {
    console.error(error);
    write({ type: "error", text: "生成処理中にエラーが発生しました" });
  } finally {
    response.end();
  }
});

// === セッションの履歴・状態を取得（リロード復帰用） ===
app.get("/api/sessions/:id", async (request, response) => {
  const sessionId = Number(request.params.id);
  if (!Number.isInteger(sessionId)) {
    response.status(400).json({ error: "invalid session id" });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    response.status(404).json({ error: "session not found" });
    return;
  }

  const messages = await getMessages(sessionId);
  response.status(200).json({
    sessionId: session.id,
    projectName: session.project_name,
    targetCloud: session.target_cloud,
    status: session.status,
    deployUrl: session.deploy_url,
    hasPreview: Boolean(session.current_jsx),
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
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


app.listen(PORT, () => {
  console.log("Server running at PORT: ", PORT);
}).on("error", (error) => {
  throw new Error(error.message);
});
// === セッション削除 ===
app.delete("/api/sessions/:id", async (request, response) => {
  const sessionId = Number(request.params.id);
  if (!Number.isInteger(sessionId)) {
    response.status(400).json({ error: "invalid session id" });
    return;
  }
  try {
    await deleteSession(sessionId);
    response.status(204).end();
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "セッションの削除に失敗しました" });
  }
});

// === 生成アプリのプレビュー配信（iframe先） ===
app.get("/preview/:id", async (request, response) => {
  const sessionId = Number(request.params.id);
  if (!Number.isInteger(sessionId)) {
    response.status(404).send("Not found");
    return;
  }

  const session = await getSession(sessionId);
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (!session?.current_jsx) {
    response
      .status(200)
      .type("html")
      .send(
        `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#888;background:#0a0a0a}</style></head><body>まだアプリが生成されていません</body></html>`
      );
    return;
  }

  response.status(200).type("html").send(renderPreviewHtml(session.current_jsx));
});

// === デプロイ（スタブ） ===
app.post("/api/sessions/:id/deploy", async (request, response) => {
  const sessionId = Number(request.params.id);
  if (!Number.isInteger(sessionId)) {
    response.status(400).json({ error: "invalid session id" });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    response.status(404).json({ error: "session not found" });
    return;
  }

  try {
    const result = await deployApp(session);
    response.status(200).json(result);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "デプロイに失敗しました";
    response.status(500).json({ error: message });
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

// 起動時にDBを初期化してからリッスン
initDb()
  .then(() => {
    app
      .listen(PORT, () => {
        console.log("Server running at PORT: ", PORT);
      })
      .on("error", (error) => {
        throw new Error(error.message);
      });
  })
  .catch((error) => {
    console.error("DB初期化に失敗しました:", error);
    process.exit(1);
  });
