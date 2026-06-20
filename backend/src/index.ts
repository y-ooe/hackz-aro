import express from "express";
import dotenv from "dotenv";
import path from "node:path";

import { chatWithTools } from "./claude.js";
import { runDeploy, GENERATED_DIR, type TargetCloud } from "./deploy.js";

import { deployStaticSite, makeBucketName } from './deployStaticSite.js';
import { deployHtml } from './deployHtml.js';


const TARGET_CLOUDS: TargetCloud[] = ["vercel", "aws", "gcp", "cloudflare"];

dotenv.config();
const app = express();
app.use(express.json({ limit: '5mb' }));

const PORT = 3000;

app.get("/", (request, response) => {
  response.status(200).send("Hello World");
});

app.post("/api/chat", async (request, response) => {
  const { message } = request.body;

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

app.post("/api/deploy", async (request, response) => {
  const { projectName, targetCloud, prompt } = request.body ?? {};

  if (typeof prompt !== "string" || !prompt.trim()) {
    response.status(400).json({ error: "prompt is required" });
    return;
  }

  const cloud: TargetCloud = TARGET_CLOUDS.includes(targetCloud)
    ? targetCloud
    : "vercel";

  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-cache");
  response.flushHeaders();

  try {
    await runDeploy(
      { projectName: typeof projectName === "string" ? projectName : "", targetCloud: cloud, prompt },
      (line) => response.write(line + "\n")
    );
  } catch (error) {
    console.error(error);
    response.write(
      JSON.stringify({ level: "error", message: "デプロイ処理中にエラーが発生しました" }) + "\n"
    );
  } finally {
    response.end();
  }
});

// 生成されたアプリ(単一HTML)を配信する。完了URLのリンク先。
app.get("/preview/:name", (request, response) => {
  const safe = (request.params.name ?? "").replace(/[^a-z0-9-]/gi, "");
  if (!safe) {
    response.status(404).send("Not found");
    return;
  }
  response.sendFile(path.join(GENERATED_DIR, `${safe}.html`), (err) => {
    if (err) response.status(404).send("生成されたアプリが見つかりません");
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