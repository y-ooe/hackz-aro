import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { MessageRow } from "./db.js";

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-opus-4-8";

const ResultSchema = z.object({
  reply: z
    .string()
    .describe(
      "ユーザーへのチャット返答。生成・修正した場合はその説明、要望が曖昧な場合は確認の質問。"
    ),
  jsx: z
    .string()
    .nullable()
    .describe(
      "更新後のReactコンポーネントのソース(.jsx)全文。新規生成・修正したときのみ設定。質問だけ・変更不要のときは null。"
    ),
});

export type AgentResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = [
  "あなたはWebアプリをユーザーと対話しながら作るエージェントです。アプリは React で作ります。",
  "",
  "【出力するコードの形式】",
  "- `App` という名前の関数コンポーネントを定義する、純粋な React の JSX コードだけを出力してください。",
  "- `import` 文や `export` 文は書かないでください。",
  "- `<html>` `<body>` `<script>` などのHTMLのガワや、ReactDOM.render / createRoot の呼び出しは書かないでください（実行環境側で用意します）。",
  "- フック(`useState`,`useEffect`,`useRef`,`useMemo`,`useCallback`)はそのまま使えます（React. は不要）。",
  "- スタイルはコンポーネント内のインライン style か、コンポーネント先頭で定義した style 文字列で当ててください。外部CSSファイルやUIライブラリは使わないでください。",
  "- 必要なら App の下に補助コンポーネントや定数を定義してかまいません。最終的に画面に描画されるのは `App` です。",
  "- 見た目も整った、そのまま動く完成品にしてください。",
  "",
  "【出力例のイメージ】",
  "function App() {",
  "  const [count, setCount] = useState(0);",
  "  return <button onClick={() => setCount(count + 1)}>count: {count}</button>;",
  "}",
  "",
  "【対話のルール】",
  "- 要望が曖昧で重要な仕様が決まらない場合は、作り始める前に reply で簡潔に質問し、jsx は null にしてください。",
  "- 要望が十分明確なら、アプリを生成または修正し、reply に変更点の説明、jsx に更新後の完全なコードを入れてください。",
  "- 「現在のコード」が与えられた場合は、それを土台に、指示された部分だけを修正してください。ゼロから作り直さず、既存の構造・機能を尊重してください。",
  "- jsx を返すときは必ず省略せずコード全文を出力してください（部分的な差分やコメントによる省略は禁止）。",
].join("\n");

/**
 * チャット履歴と現在のコードを踏まえて、Reactアプリを生成または修正する。
 *
 * @param history    これまでの会話(古い順)
 * @param currentJsx 現在の生成コード(.jsx, 無ければ null)
 * @param userMessage 今回のユーザー発言
 */
export async function generateOrEditApp(
  history: MessageRow[],
  currentJsx: string | null,
  userMessage: string
): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const userContent = currentJsx
    ? `現在のアプリのコード(.jsx):\n\`\`\`jsx\n${currentJsx}\n\`\`\`\n\n上記を踏まえた指示: ${userMessage}`
    : userMessage;

  messages.push({ role: "user", content: userContent });

  const response = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(ResultSchema) },
    system: SYSTEM_PROMPT,
    messages,
  });

  const result = response.parsed_output;
  if (!result) {
    throw new Error("AIの応答を解釈できませんでした");
  }
  return result;
}
