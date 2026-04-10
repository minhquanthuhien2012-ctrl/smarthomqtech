import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerEchoTool(server: McpServer): void {
  server.tool(
    "echo",
    "Lặp lại thông điệp được gửi vào, có thể chuyển đổi cách viết",
    {
      message: z.string().describe("Thông điệp cần lặp lại"),
      transform: z
        .enum(["none", "uppercase", "lowercase", "reverse", "title"])
        .optional()
        .default("none")
        .describe(
          "Biến đổi: none (không đổi), uppercase (hoa), lowercase (thường), reverse (đảo ngược), title (Viết Hoa Chữ Cái Đầu)"
        ),
    },
    async ({ message, transform }) => {
      let result: string;

      switch (transform) {
        case "uppercase":
          result = message.toUpperCase();
          break;
        case "lowercase":
          result = message.toLowerCase();
          break;
        case "reverse":
          result = message.split("").reverse().join("");
          break;
        case "title":
          result = message
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          break;
        default:
          result = message;
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    }
  );
}
