import { app } from "./app.js";
import { PORT } from "./config.js";

// 状態(チャット履歴・生成コード)はフロント側で保持するため、DB初期化は不要。
app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    throw new Error(error.message);
  });
