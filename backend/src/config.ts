import dotenv from "dotenv";
import path from "node:path";

// 環境変数の読み込みはここで一度だけ行う
dotenv.config();

/** サーバーのリッスンポート */
export const PORT = Number(process.env.PORT ?? "3000");

/** React/Babel など、プレビュー用の静的アセット配信元ディレクトリ */
export const VENDOR_DIR = path.resolve(import.meta.dirname, "../public/vendor");
