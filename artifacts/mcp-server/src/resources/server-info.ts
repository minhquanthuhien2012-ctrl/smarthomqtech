import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerServerInfoResource(server: McpServer): void {
  server.resource(
    "server-info",
    "mcp://workspace/server-info",
    {
      description: "Thông tin về MCP server này",
      mimeType: "application/json",
    },
    async () => {
      const info = {
        name: "workspace-mcp-server",
        version: "1.0.0",
        description: "MCP Server tích hợp cho Replit workspace",
        transport: "stdio",
        tools: ["calculator", "get_current_time", "echo", "fetch_url"],
        resources: ["mcp://workspace/server-info", "mcp://workspace/help"],
        startedAt: new Date().toISOString(),
        nodeVersion: process.version,
      };

      return {
        contents: [
          {
            uri: "mcp://workspace/server-info",
            mimeType: "application/json",
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    }
  );
}
