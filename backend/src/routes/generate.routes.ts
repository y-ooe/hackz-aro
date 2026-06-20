import { Router } from "express";

import { generateOrEditApp, type ChatMessage } from "../services/agent.js";

export const generateRoutes = Router();

/**
 * チャット（生成・修正）: ステートレス NDJSONストリーム。
 * 状態はフロント側(React state / localStorage)が保持し、毎回まとめて送ってくる。
 */
generateRoutes.post("/api/generate", async (request, response) => {
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
