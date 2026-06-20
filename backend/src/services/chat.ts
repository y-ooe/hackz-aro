import type { Tool, MessageParam } from "@anthropic-ai/sdk/resources/messages";

import { anthropic } from "../lib/anthropic.js";
import { getMcpClient } from "./mcpClient.js";

const MODEL = "claude-sonnet-4-6";

/** MCPツール(topaz.dev等)を使ってユーザーの問い合わせに答える。 */
export async function chatWithTools(userMessage: string): Promise<string> {
  const mcp = await getMcpClient();
  const { tools: mcpTools } = await mcp.listTools();

  const tools: Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Tool["input_schema"],
  }));

  const messages: MessageParam[] = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      tools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: MessageParam["content"] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const result = await mcp.callTool({
        name: block.name,
        arguments: block.input as Record<string, unknown>,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content as never,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
