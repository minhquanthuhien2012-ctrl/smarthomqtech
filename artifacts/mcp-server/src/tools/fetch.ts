import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerFetchTool(server: McpServer): void {
  server.tool(
    "fetch_url",
    "Lấy nội dung văn bản từ một URL (chỉ GET, chỉ phản hồi text/JSON)",
    {
      url: z.string().url().describe("URL cần lấy dữ liệu"),
      headers: z
        .record(z.string())
        .optional()
        .describe("HTTP headers tùy chọn (dạng object key-value)"),
    },
    async ({ url, headers }) => {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "workspace-mcp-server/1.0",
          Accept: "application/json, text/plain, */*",
          ...headers,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) {
        throw new Error(
          `HTTP ${resp.status} ${resp.statusText} khi lấy ${url}`
        );
      }

      const contentType = resp.headers.get("content-type") ?? "";
      let body: string;

      if (contentType.includes("application/json")) {
        const json = await resp.json();
        body = JSON.stringify(json, null, 2);
      } else {
        body = await resp.text();
        if (body.length > 8000) {
          body = body.slice(0, 8000) + "\n...[nội dung bị cắt bớt]";
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `HTTP ${resp.status} từ ${url}\n\n${body}`,
          },
        ],
      };
    }
  );
}
