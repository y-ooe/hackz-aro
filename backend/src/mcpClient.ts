import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

const MCP_SERVER_PATH = path.resolve(
  import.meta.dirname,
  "../../mcp/dist/index.js"
);

let client: Client | null = null;

export async function getMcpClient(): Promise<Client> {
  if (client) return client;

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_SERVER_PATH],
  });

  const newClient = new Client({ name: "hackz-aro-backend", version: "1.0.0" });
  await newClient.connect(transport);
  client = newClient;

  return client;
}