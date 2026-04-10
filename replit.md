# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **MCP Server**: @modelcontextprotocol/sdk (stdio transport)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mcp-server run build` — build MCP server
- `pnpm --filter @workspace/mcp-server run dev` — run MCP server in watch mode (stdio)

## MCP Server

Located at `artifacts/mcp-server/`. Implements the Model Context Protocol over stdio.

**Built-in tools:**
- `calculator` — phép tính cơ bản (cộng, trừ, nhân, chia, lũy thừa, căn)
- `get_current_time` — thời gian hiện tại theo múi giờ
- `echo` — lặp lại & biến đổi chuỗi
- `fetch_url` — lấy nội dung từ URL
- `gdrive_list_files` — liệt kê file trong Google Drive
- `gdrive_read_file` — đọc nội dung file Google Docs/Sheets/Slides/text
- `gdrive_search` — tìm kiếm file theo tên hoặc nội dung

**Secrets cần thiết:**
- `GOOGLE_SERVICE_ACCOUNT_JSON` — JSON key của Google Service Account (đã cấu hình)
  - Service Account phải được chia sẻ quyền đọc trên file/folder Drive muốn truy cập
  - Cần bật Google Drive API, Google Docs API, Google Sheets API trong Google Cloud Console

**Built-in resources:**
- `mcp://workspace/server-info` — thông tin server
- `mcp://workspace/help` — hướng dẫn sử dụng

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["/path/to/artifacts/mcp-server/dist/index.mjs"]
    }
  }
}
```

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
