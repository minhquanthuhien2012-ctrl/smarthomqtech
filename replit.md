# SmartHomeQ MCP Chatbot

## Tổng quan

Hệ thống chatbot AI cho cửa hàng nhà thông minh **SmartHomeQ** (smarthomeq.tech).  
Bao gồm: API server, web chatbot + admin dashboard, tích hợp Zalo OA, Xiaozhi WebSocket.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 / TypeScript 5.9
- **API**: Express 5 + Drizzle ORM + PostgreSQL
- **Frontend**: React + Vite + Tailwind + shadcn/ui + Wouter
- **AI**: Anthropic Claude Sonnet (via Replit AI Integration)
- **Validation**: Zod (`zod/v4` trong libs, `zod` trong api-server routes)
- **Build**: esbuild

## Artifacts

| Artifact | URL | Mô tả |
|---|---|---|
| `api-server` | `/api/*` | Express API + Anthropic SSE streaming |
| `chatbot` | `/` | React web app — Chat + Admin dashboard |

## URLs quan trọng

- **Chat**: `/`
- **Admin Dashboard**: `/admin`
- **Chatbots**: `/admin/chatbots`
- **Tools**: `/admin/tools`
- **Skills**: `/admin/skills`
- **Kết nối**: `/admin/connections`
- **Zalo Webhook**: `/api/webhooks/zalo` (POST)
- **Health**: `/api/healthz`

## Database Tables

- `conversations` — hội thoại chatbot
- `messages` — tin nhắn trong hội thoại
- `chatbots` — quản lý các chatbot
- `tools` — quản lý tools (builtin + custom)
- `skills` — automation skills
- `connections` — kết nối Zalo/Messenger/Xiaozhi/WebSocket

## Tính năng

### Chatbot AI
- Claude Sonnet với system prompt tư vấn SmartHomeQ
- SSE streaming real-time
- Tool use: `fetch_url`, `calculator`, `get_current_time`, `gdrive_*`
- Luôn kèm link + hình ảnh sản phẩm khi tư vấn
- Popup chatbot góc phải màn hình (hiển thị trên mọi trang)

### Admin Dashboard
- **Dashboard**: tổng quan stats hệ thống
- **Chatbots**: CRUD chatbot, chọn model, system prompt, tools/skills
- **Tools**: CRUD tools (builtin + custom), JSON schema editor, JS implementation
- **Skills**: automation theo trigger → actions (fetch_url, send_message, call_api...)
- **Kết nối**: Zalo OA, Xiaozhi WebSocket, Messenger, Webhook tùy chỉnh

### Kết nối nền tảng
- **Zalo OA**: token `4544700640850963554:KcaE...`, secret `TGo-n7-mcmjl629xav`
  - Webhook URL: `/api/webhooks/zalo`
  - Nhận tin nhắn → AI trả lời tự động
- **Xiaozhi**: WebSocket `wss://api.xiaozhi.me/mcp/?token=...`

## Secrets

- `GOOGLE_SERVICE_ACCOUNT_JSON` — Google Service Account cho Drive tools
- `SESSION_SECRET` — session secret
- Anthropic: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` (auto Replit)

## Key Commands

```bash
pnpm run typecheck              # full typecheck
pnpm --filter @workspace/db run push          # push DB schema
pnpm --filter @workspace/api-server run build # build api-server
pnpm --filter @workspace/api-spec run codegen # regenerate API hooks
```

## Lưu ý kỹ thuật

- `zod/v4` dùng trong `lib/db/src/schema/*` (drizzle-zod yêu cầu)
- `zod` (v3) dùng trong `artifacts/api-server/src/routes/admin/*`
- Button lồng nhau: dùng `<span role="button">` thay `<button>` bên trong div clickable
- SSE streaming: `text/event-stream` với `data: {json}\n\n` format
- Webhook Zalo: xác thực HMAC-SHA256 với secret token
- DB migration: `pnpm --filter @workspace/db run push`
