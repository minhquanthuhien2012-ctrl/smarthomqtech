import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCalculatorTool(server: McpServer): void {
  server.tool(
    "calculator",
    "Thực hiện các phép tính toán học cơ bản (cộng, trừ, nhân, chia, lũy thừa, căn bậc hai)",
    {
      operation: z
        .enum(["add", "subtract", "multiply", "divide", "power", "sqrt"])
        .describe(
          "Phép tính: add (cộng), subtract (trừ), multiply (nhân), divide (chia), power (lũy thừa), sqrt (căn bậc hai)"
        ),
      a: z.number().describe("Số thứ nhất"),
      b: z
        .number()
        .optional()
        .describe("Số thứ hai (không cần thiết với sqrt)"),
    },
    async ({ operation, a, b }) => {
      let result: number;

      switch (operation) {
        case "add":
          if (b === undefined) throw new Error("Cần số thứ hai cho phép cộng");
          result = a + b;
          break;
        case "subtract":
          if (b === undefined) throw new Error("Cần số thứ hai cho phép trừ");
          result = a - b;
          break;
        case "multiply":
          if (b === undefined) throw new Error("Cần số thứ hai cho phép nhân");
          result = a * b;
          break;
        case "divide":
          if (b === undefined) throw new Error("Cần số thứ hai cho phép chia");
          if (b === 0) throw new Error("Không thể chia cho 0");
          result = a / b;
          break;
        case "power":
          if (b === undefined)
            throw new Error("Cần số mũ cho phép lũy thừa");
          result = Math.pow(a, b);
          break;
        case "sqrt":
          if (a < 0)
            throw new Error("Không thể tính căn bậc hai của số âm");
          result = Math.sqrt(a);
          break;
        default:
          throw new Error(`Phép tính không hợp lệ: ${operation}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Kết quả: ${result}`,
          },
        ],
      };
    }
  );
}
