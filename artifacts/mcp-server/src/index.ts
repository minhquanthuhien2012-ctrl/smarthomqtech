import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";

const server = new McpServer({
  name: "workspace-mcp-server",
  version: "1.0.0",
});

registerTools(server);
registerResources(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("MCP Server đã khởi động (stdio transport)\n");
}

main().catch((err) => {
  process.stderr.write(`Lỗi khởi động server: ${String(err)}\n`);
  process.exit(1);
});
