import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCalculatorTool } from "./calculator.js";
import { registerTimeTool } from "./time.js";
import { registerEchoTool } from "./echo.js";
import { registerFetchTool } from "./fetch.js";
import { registerGoogleDriveTools } from "./google-drive.js";

export function registerTools(server: McpServer): void {
  registerCalculatorTool(server);
  registerTimeTool(server);
  registerEchoTool(server);
  registerFetchTool(server);
  registerGoogleDriveTools(server);
}
