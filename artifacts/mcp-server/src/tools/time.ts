import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerTimeTool(server: McpServer): void {
  server.tool(
    "get_current_time",
    "Lấy thời gian hiện tại theo múi giờ được chỉ định",
    {
      timezone: z
        .string()
        .optional()
        .describe(
          "Múi giờ IANA (ví dụ: 'Asia/Ho_Chi_Minh', 'UTC', 'America/New_York'). Mặc định là UTC."
        ),
      format: z
        .enum(["iso", "locale", "unix"])
        .optional()
        .default("locale")
        .describe(
          "Định dạng: iso (ISO 8601), locale (thân thiện với người dùng), unix (timestamp Unix)"
        ),
    },
    async ({ timezone, format }) => {
      const tz = timezone ?? "UTC";
      const now = new Date();

      let timeStr: string;

      switch (format) {
        case "iso":
          timeStr = now.toISOString();
          break;
        case "unix":
          timeStr = String(Math.floor(now.getTime() / 1000));
          break;
        default: {
          try {
            timeStr = now.toLocaleString("vi-VN", {
              timeZone: tz,
              dateStyle: "full",
              timeStyle: "long",
            });
          } catch {
            throw new Error(`Múi giờ không hợp lệ: ${tz}`);
          }
          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `Thời gian hiện tại (${tz}): ${timeStr}`,
          },
        ],
      };
    }
  );
}
