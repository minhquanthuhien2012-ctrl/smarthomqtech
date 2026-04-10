import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerServerInfoResource } from "./server-info.js";
import { registerHelpResource } from "./help.js";

export function registerResources(server: McpServer): void {
  registerServerInfoResource(server);
  registerHelpResource(server);
}
