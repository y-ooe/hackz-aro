import express from "express";
import dotenv from "dotenv";
import { chatWithTools } from "./claude.js";
import { generateOrEditApp } from "./agent.js";
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

/** 純粋なReactコンポーネント(.jsx)を、Babelで動く単一HTMLに包む */
function renderPreviewHtml(jsx: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer } = React;
${jsx}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>`;
}

dotenv.config();
const app = express();
app.use(express.json());

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
