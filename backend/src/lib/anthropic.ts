import Anthropic from "@anthropic-ai/sdk";
import "../config.js"; // dotenv を先に読み込ませる

/** アプリ全体で共有する Anthropic クライアント。モデルは利用箇所ごとに指定する。 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
