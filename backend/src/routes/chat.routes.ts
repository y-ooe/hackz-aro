import { Router } from "express";

import { chatWithTools } from "../services/chat.js";

export const chatRoutes = Router();

/** topaz.dev アイデア検索チャット（MCPツール利用）。 */
chatRoutes.post("/api/chat", async (request, response) => {
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
