import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { google } from "googleapis";

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Thiếu biến môi trường GOOGLE_SERVICE_ACCOUNT_JSON. Vui lòng cấu hình Service Account."
    );
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    docs: google.docs({ version: "v1", auth }),
    sheets: google.sheets({ version: "v4", auth }),
    auth,
  };
}

function extractFileId(urlOrId: string): string {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = urlOrId.match(re);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(urlOrId)) return urlOrId;
  throw new Error(
    `Không thể trích xuất ID file từ: "${urlOrId}". Hãy cung cấp URL Google Drive hoặc ID file trực tiếp.`
  );
}

function extractDocText(doc: {
  body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
}): string {
  const lines: string[] = [];
  for (const block of doc.body?.content ?? []) {
    if (block.paragraph) {
      const text = (block.paragraph.elements ?? [])
        .map((el) => el.textRun?.content ?? "")
        .join("");
      if (text.trim()) lines.push(text.trimEnd());
    }
  }
  return lines.join("\n");
}

export function registerGoogleDriveTools(server: McpServer): void {
  server.tool(
    "gdrive_list_files",
    "Liệt kê các file trong Google Drive (có thể lọc theo tên hoặc thư mục). Service Account chỉ thấy file đã được chia sẻ với nó.",
    {
      query: z
        .string()
        .optional()
        .describe(
          "Từ khóa tìm kiếm trong tên file (để trống để lấy tất cả file được chia sẻ)"
        ),
      folder_id: z
        .string()
        .optional()
        .describe("ID hoặc URL của thư mục Google Drive muốn liệt kê"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Số lượng kết quả tối đa (1-100, mặc định 20)"),
    },
    async ({ query, folder_id, max_results }) => {
      const { drive } = getDriveClient();

      const conditions: string[] = ["trashed = false"];
      if (query) conditions.push(`name contains '${query.replace(/'/g, "\\'")}'`);
      if (folder_id) {
        const fid = extractFileId(folder_id);
        conditions.push(`'${fid}' in parents`);
      }

      const resp = await drive.files.list({
        q: conditions.join(" and "),
        pageSize: max_results,
        fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
        orderBy: "modifiedTime desc",
      });

      const files = resp.data.files ?? [];
      if (files.length === 0) {
        return {
          content: [{ type: "text", text: "Không tìm thấy file nào. Hãy đảm bảo đã chia sẻ file/folder với email của Service Account." }],
        };
      }

      const mimeLabel: Record<string, string> = {
        "application/vnd.google-apps.document": "Google Docs",
        "application/vnd.google-apps.spreadsheet": "Google Sheets",
        "application/vnd.google-apps.presentation": "Google Slides",
        "application/vnd.google-apps.folder": "Thư mục",
        "application/pdf": "PDF",
        "text/plain": "Text",
      };

      const lines = files.map((f) => {
        const type = mimeLabel[f.mimeType ?? ""] ?? f.mimeType ?? "Không rõ";
        const modified = f.modifiedTime
          ? new Date(f.modifiedTime).toLocaleString("vi-VN")
          : "N/A";
        return `📄 ${f.name}\n   ID: ${f.id}\n   Loại: ${type}\n   Sửa lần cuối: ${modified}\n   Link: ${f.webViewLink ?? "N/A"}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Tìm thấy ${files.length} file:\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "gdrive_read_file",
    "Đọc nội dung của một file Google Drive. Hỗ trợ Google Docs, Google Sheets, Google Slides, file text, PDF. Dùng ID hoặc URL của file.",
    {
      file_id: z
        .string()
        .describe("ID hoặc URL đầy đủ của file Google Drive cần đọc"),
      sheet_name: z
        .string()
        .optional()
        .describe(
          "Chỉ dùng cho Google Sheets: tên sheet cụ thể cần đọc (để trống để đọc sheet đầu tiên)"
        ),
      max_rows: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .default(100)
        .describe("Chỉ dùng cho Google Sheets: số hàng tối đa (mặc định 100)"),
    },
    async ({ file_id, sheet_name, max_rows }) => {
      const id = extractFileId(file_id);
      const { drive, docs, sheets } = getDriveClient();

      const metaResp = await drive.files.get({
        fileId: id,
        fields: "name, mimeType, size",
      });
      const { name, mimeType } = metaResp.data;

      if (mimeType === "application/vnd.google-apps.document") {
        const docResp = await docs.documents.get({ documentId: id });
        const text = extractDocText(docResp.data as Parameters<typeof extractDocText>[0]);
        const preview = text.length > 12000 ? text.slice(0, 12000) + "\n\n...[nội dung bị cắt bớt]" : text;
        return {
          content: [
            {
              type: "text",
              text: `📄 **${name}** (Google Docs)\n\n${preview}`,
            },
          ],
        };
      }

      if (mimeType === "application/vnd.google-apps.spreadsheet") {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: id });
        const allSheets = spreadsheet.data.sheets ?? [];
        const targetSheet = sheet_name
          ? allSheets.find((s) => s.properties?.title === sheet_name)
          : allSheets[0];

        if (!targetSheet) {
          const names = allSheets.map((s) => s.properties?.title).join(", ");
          throw new Error(`Không tìm thấy sheet "${sheet_name}". Các sheet có sẵn: ${names}`);
        }

        const sheetTitle = targetSheet.properties?.title ?? "Sheet1";
        const range = `${sheetTitle}!A1:Z${max_rows}`;
        const valueResp = await sheets.spreadsheets.values.get({
          spreadsheetId: id,
          range,
        });

        const rows = valueResp.data.values ?? [];
        if (rows.length === 0) {
          return { content: [{ type: "text", text: `Sheet "${sheetTitle}" trống.` }] };
        }

        const sheetNames = allSheets.map((s) => s.properties?.title).join(", ");
        const table = rows.map((row) => row.join("\t")).join("\n");
        const preview = table.length > 12000 ? table.slice(0, 12000) + "\n...[cắt bớt]" : table;

        return {
          content: [
            {
              type: "text",
              text: `📊 **${name}** (Google Sheets)\nSheet đang đọc: "${sheetTitle}" | Tất cả sheets: ${sheetNames}\nSố hàng: ${rows.length}\n\n${preview}`,
            },
          ],
        };
      }

      if (mimeType === "application/vnd.google-apps.presentation") {
        const exportResp = await drive.files.export(
          { fileId: id, mimeType: "text/plain" },
          { responseType: "text" }
        );
        const text = String(exportResp.data);
        const preview = text.length > 12000 ? text.slice(0, 12000) + "\n...[cắt bớt]" : text;
        return {
          content: [{ type: "text", text: `🖼️ **${name}** (Google Slides)\n\n${preview}` }],
        };
      }

      if (
        mimeType === "text/plain" ||
        mimeType === "text/csv" ||
        mimeType === "text/html" ||
        mimeType?.startsWith("text/")
      ) {
        const exportResp = await drive.files.get(
          { fileId: id, alt: "media" },
          { responseType: "text" }
        );
        const text = String(exportResp.data);
        const preview = text.length > 12000 ? text.slice(0, 12000) + "\n...[cắt bớt]" : text;
        return {
          content: [{ type: "text", text: `📝 **${name}**\n\n${preview}` }],
        };
      }

      if (mimeType === "application/pdf") {
        return {
          content: [
            {
              type: "text",
              text: `📋 **${name}** là file PDF. Hiện tại không thể đọc trực tiếp nội dung PDF qua API này. Hãy chuyển đổi sang Google Docs để đọc được.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `File **${name}** có định dạng \`${mimeType}\` chưa được hỗ trợ đọc trực tiếp. Các định dạng hỗ trợ: Google Docs, Google Sheets, Google Slides, text/CSV.`,
          },
        ],
      };
    }
  );

  server.tool(
    "gdrive_search",
    "Tìm kiếm file trong Google Drive theo nội dung hoặc tên. Trả về danh sách file phù hợp.",
    {
      query: z.string().describe("Từ khóa tìm kiếm (tên file hoặc nội dung)"),
      file_type: z
        .enum(["any", "doc", "sheet", "slide", "pdf", "text"])
        .optional()
        .default("any")
        .describe("Lọc theo loại file: any, doc (Docs), sheet (Sheets), slide (Slides), pdf, text"),
      max_results: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Số kết quả tối đa (mặc định 10)"),
    },
    async ({ query, file_type, max_results }) => {
      const { drive } = getDriveClient();

      const mimeMap: Record<string, string> = {
        doc: "application/vnd.google-apps.document",
        sheet: "application/vnd.google-apps.spreadsheet",
        slide: "application/vnd.google-apps.presentation",
        pdf: "application/pdf",
        text: "text/plain",
      };

      const conditions = [
        "trashed = false",
        `(name contains '${query.replace(/'/g, "\\'")}' or fullText contains '${query.replace(/'/g, "\\'")}')`,
      ];

      if (file_type && file_type !== "any" && mimeMap[file_type]) {
        conditions.push(`mimeType = '${mimeMap[file_type]}'`);
      }

      const resp = await drive.files.list({
        q: conditions.join(" and "),
        pageSize: max_results,
        fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
      });

      const files = resp.data.files ?? [];
      if (files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Không tìm thấy file nào khớp với "${query}". Đảm bảo file đã được chia sẻ với Service Account.`,
            },
          ],
        };
      }

      const mimeLabel: Record<string, string> = {
        "application/vnd.google-apps.document": "Google Docs",
        "application/vnd.google-apps.spreadsheet": "Google Sheets",
        "application/vnd.google-apps.presentation": "Google Slides",
        "application/pdf": "PDF",
        "text/plain": "Text",
      };

      const lines = files.map((f, i) => {
        const type = mimeLabel[f.mimeType ?? ""] ?? f.mimeType ?? "Không rõ";
        return `${i + 1}. **${f.name}**\n   Loại: ${type} | ID: \`${f.id}\`\n   Link: ${f.webViewLink ?? "N/A"}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Kết quả tìm kiếm "${query}" (${files.length} file):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );
}
