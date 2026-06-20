import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { chatWithTools } from "./claude.js";
import { runDeploy, GENERATED_DIR, type TargetCloud } from "./deploy.js";

const TARGET_CLOUDS: TargetCloud[] = ["vercel", "aws", "gcp", "cloudflare"];

dotenv.config();
const app = express();
app.use(express.json());

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

app.listen(PORT, () => {
  console.log("Server running at PORT: ", PORT);
}).on("error", (error) => {
  throw new Error(error.message);
});