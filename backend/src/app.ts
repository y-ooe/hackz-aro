import express from "express";

import { VENDOR_DIR } from "./config.js";
import { generateRoutes } from "./routes/generate.routes.js";
import { chatRoutes } from "./routes/chat.routes.js";
import { deployRoutes } from "./routes/deploy.routes.js";

export const app = express();

// --- 共通ミドルウェア ---
app.use(express.json({ limit: "5mb" }));
app.use("/vendor", express.static(VENDOR_DIR));

// --- ヘルスチェック ---
app.get("/", (_request, response) => {
  response.status(200).send("Hello World");
});

// --- 各API(フルパスを持つルーターをルートに登録) ---
app.use(generateRoutes);
app.use(chatRoutes);
app.use(deployRoutes);
