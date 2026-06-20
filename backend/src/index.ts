import express from "express";
import dotenv from "dotenv";
import { chatWithTools } from "./claude.js";

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

app.listen(PORT, () => {
  console.log("Server running at PORT: ", PORT);
}).on("error", (error) => {
  throw new Error(error.message);
});