import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerHelpResource(server: McpServer): void {
  server.resource(
    "help",
    "mcp://workspace/help",
    {
      description: "Hướng dẫn sử dụng các tools của MCP server",
      mimeType: "text/markdown",
    },
    async () => {
      const helpText = `# Hướng dẫn sử dụng Workspace MCP Server

## Các Tools có sẵn

### 🧮 calculator
Thực hiện phép tính toán học cơ bản.

**Tham số:**
- \`operation\`: \`add\` | \`subtract\` | \`multiply\` | \`divide\` | \`power\` | \`sqrt\`
- \`a\`: số thứ nhất
- \`b\`: số thứ hai (không cần với \`sqrt\`)

**Ví dụ:**
\`\`\`json
{ "operation": "add", "a": 10, "b": 5 }
\`\`\`

---

### 🕐 get_current_time
Lấy thời gian hiện tại theo múi giờ.

**Tham số:**
- \`timezone\`: múi giờ IANA (mặc định: \`UTC\`)
- \`format\`: \`locale\` | \`iso\` | \`unix\` (mặc định: \`locale\`)

**Ví dụ:**
\`\`\`json
{ "timezone": "Asia/Ho_Chi_Minh", "format": "locale" }
\`\`\`

---

### 📣 echo
Lặp lại và biến đổi chuỗi văn bản.

**Tham số:**
- \`message\`: chuỗi cần lặp lại
- \`transform\`: \`none\` | \`uppercase\` | \`lowercase\` | \`reverse\` | \`title\`

**Ví dụ:**
\`\`\`json
{ "message": "xin chào thế giới", "transform": "uppercase" }
\`\`\`

---

### 🌐 fetch_url
Lấy nội dung từ URL bất kỳ.

**Tham số:**
- \`url\`: địa chỉ URL (bắt buộc)
- \`headers\`: object chứa HTTP headers tùy chỉnh

**Ví dụ:**
\`\`\`json
{ "url": "https://api.github.com/zen" }
\`\`\`

---

## Resources

- \`mcp://workspace/server-info\` — Thông tin server dạng JSON
- \`mcp://workspace/help\` — Tài liệu này

## Kết nối với Claude Desktop

Thêm vào file config của Claude Desktop:

\`\`\`json
{
  "mcpServers": {
    "workspace": {
      "command": "node",
      "args": ["/đường/dẫn/đến/artifacts/mcp-server/dist/index.mjs"]
    }
  }
}
\`\`\`
`;

      return {
        contents: [
          {
            uri: "mcp://workspace/help",
            mimeType: "text/markdown",
            text: helpText,
          },
        ],
      };
    }
  );
}
