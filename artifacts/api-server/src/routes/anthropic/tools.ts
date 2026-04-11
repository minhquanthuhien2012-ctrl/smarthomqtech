import { google } from "googleapis";
import type Anthropic from "@anthropic-ai/sdk";
function getDriveClients() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không được cấu hình.");
  const credentials = JSON.parse(raw) as Record<string, unknown>;
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
  throw new Error(`Không thể trích xuất ID file từ: "${urlOrId}"`);
}

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Thực hiện phép tính toán học: cộng, trừ, nhân, chia, lũy thừa, căn bậc hai.",
    input_schema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", enum: ["add", "subtract", "multiply", "divide", "power", "sqrt"] },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a"],
    },
  },
  {
    name: "get_current_time",
    description: "Lấy thời gian hiện tại theo múi giờ.",
    input_schema: {
      type: "object" as const,
      properties: {
        timezone: { type: "string" },
        format: { type: "string", enum: ["iso", "locale", "unix"] },
      },
    },
  },
  {
    name: "fetch_url",
    description: "Lấy nội dung từ một URL (trang web, JSON API). Tự động loại bỏ HTML và trả về văn bản sạch. Dùng để đọc thông tin sản phẩm, danh mục, giá cả từ website smarthomeq.tech hoặc bất kỳ URL nào.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "URL đầy đủ cần lấy nội dung (ví dụ: https://smarthomeq.tech/danh-muc/cong-tac-thong-minh/)" },
        max_length: { type: "number", description: "Số ký tự tối đa trả về (mặc định 8000)" },
      },
      required: ["url"],
    },
  },
  {
    name: "gdrive_list_files",
    description: "Liệt kê file trong Google Drive. Chỉ thấy file đã chia sẻ với Service Account.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        folder_id: { type: "string" },
        max_results: { type: "number" },
      },
    },
  },
  {
    name: "gdrive_read_file",
    description: "Đọc nội dung file từ Google Drive (Docs, Sheets, Slides, text). Dùng ID hoặc URL file.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_id: { type: "string" },
        sheet_name: { type: "string" },
        max_rows: { type: "number" },
      },
      required: ["file_id"],
    },
  },
  {
    name: "gdrive_search",
    description: "Tìm kiếm file trong Google Drive theo tên hoặc nội dung.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        file_type: { type: "string", enum: ["any", "doc", "sheet", "slide", "pdf", "text"] },
        max_results: { type: "number" },
      },
      required: ["query"],
    },
  },
];

type ToolInput = Record<string, unknown>;

export async function executeTool(name: string, input: ToolInput): Promise<string> {
  switch (name) {
    case "calculator": {
      const { operation, a, b } = input as { operation: string; a: number; b?: number };
      let result: number;
      switch (operation) {
        case "add": result = a + (b ?? 0); break;
        case "subtract": result = a - (b ?? 0); break;
        case "multiply": result = a * (b ?? 1); break;
        case "divide":
          if (!b) throw new Error("Chia cho 0");
          result = a / b;
          break;
        case "power": result = Math.pow(a, b ?? 2); break;
        case "sqrt":
          if (a < 0) throw new Error("Không thể căn bậc hai số âm");
          result = Math.sqrt(a);
          break;
        default: throw new Error(`Phép tính không hợp lệ: ${operation}`);
      }
      return `Kết quả: ${result}`;
    }

    case "get_current_time": {
      const { timezone = "UTC", format = "locale" } = input as { timezone?: string; format?: string };
      const now = new Date();
      let timeStr: string;
      if (format === "iso") timeStr = now.toISOString();
      else if (format === "unix") timeStr = String(Math.floor(now.getTime() / 1000));
      else timeStr = now.toLocaleString("vi-VN", { timeZone: timezone, dateStyle: "full", timeStyle: "long" });
      return `Thời gian hiện tại (${timezone}): ${timeStr}`;
    }

    case "fetch_url": {
      const { url, max_length = 8000 } = input as { url: string; max_length?: number };
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SmartHomeQ-Bot/1.0)",
          "Accept": "text/html,application/json,text/plain,*/*",
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} từ ${url}`);
      const ct = resp.headers.get("content-type") ?? "";
      let body: string;
      if (ct.includes("application/json")) {
        body = JSON.stringify(await resp.json(), null, 2);
      } else {
        const html = await resp.text();
        // Strip scripts and styles
        let clean = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "");
        // Replace block elements with newlines
        clean = clean
          .replace(/<\/?(div|p|h[1-6]|li|tr|td|th|br|hr|section|article|header|footer|nav|main|aside)[^>]*>/gi, "\n")
          .replace(/<[^>]+>/g, " ");
        // Decode common HTML entities
        clean = clean
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#8363;/g, "₫")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .replace(/&[a-z]+;/gi, " ");
        // Collapse whitespace
        clean = clean.replace(/\t/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        body = clean;
      }
      const limited = body.length > max_length ? body.slice(0, max_length) + "\n...[cắt bớt]" : body;
      return `Nội dung từ ${url}:\n\n${limited}`;
    }

    case "gdrive_list_files": {
      const { query, folder_id, max_results = 20 } = input as { query?: string; folder_id?: string; max_results?: number };
      const { drive } = getDriveClients();
      const conds = ["trashed = false"];
      if (query) conds.push(`name contains '${query.replace(/'/g, "\\'")}'`);
      if (folder_id) conds.push(`'${extractFileId(folder_id)}' in parents`);
      const resp = await drive.files.list({
        q: conds.join(" and "),
        pageSize: max_results,
        fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
      });
      const files = resp.data.files ?? [];
      if (!files.length) return "Không tìm thấy file nào.";
      const mimeLabel: Record<string, string> = {
        "application/vnd.google-apps.document": "Google Docs",
        "application/vnd.google-apps.spreadsheet": "Google Sheets",
        "application/vnd.google-apps.presentation": "Google Slides",
        "application/vnd.google-apps.folder": "Thư mục",
        "application/pdf": "PDF",
      };
      return `Tìm thấy ${files.length} file:\n\n` + files.map(f =>
        `- ${f.name} (${mimeLabel[f.mimeType ?? ""] ?? f.mimeType})\n  ID: ${f.id}\n  Link: ${f.webViewLink}`
      ).join("\n\n");
    }

    case "gdrive_read_file": {
      const { file_id, sheet_name, max_rows = 100 } = input as { file_id: string; sheet_name?: string; max_rows?: number };
      const id = extractFileId(file_id);
      const { drive, docs, sheets } = getDriveClients();
      const metaResp = await drive.files.get({ fileId: id, fields: "name, mimeType" });
      const { name, mimeType } = metaResp.data;

      if (mimeType === "application/vnd.google-apps.document") {
        const docResp = await docs.documents.get({ documentId: id });
        const lines: string[] = [];
        for (const block of docResp.data.body?.content ?? []) {
          if (block.paragraph) {
            const text = (block.paragraph.elements ?? []).map((el: { textRun?: { content?: string } }) => el.textRun?.content ?? "").join("");
            if (text.trim()) lines.push(text.trimEnd());
          }
        }
        const content = lines.join("\n");
        return `📄 ${name} (Google Docs)\n\n${content.length > 8000 ? content.slice(0, 8000) + "\n...[cắt bớt]" : content}`;
      }

      if (mimeType === "application/vnd.google-apps.spreadsheet") {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: id });
        const allSheets = spreadsheet.data.sheets ?? [];
        const target = sheet_name ? allSheets.find(s => s.properties?.title === sheet_name) : allSheets[0];
        if (!target) throw new Error(`Không tìm thấy sheet "${sheet_name}"`);
        const title = target.properties?.title ?? "Sheet1";
        const vals = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${title}!A1:Z${max_rows}` });
        const rows = (vals.data.values ?? []).map(r => r.join("\t")).join("\n");
        return `📊 ${name} — Sheet: ${title}\n\n${rows.length > 8000 ? rows.slice(0, 8000) + "\n...[cắt bớt]" : rows}`;
      }

      if (mimeType === "application/vnd.google-apps.presentation") {
        const exp = await drive.files.export({ fileId: id, mimeType: "text/plain" }, { responseType: "text" });
        const text = String(exp.data);
        return `🖼️ ${name} (Slides)\n\n${text.length > 8000 ? text.slice(0, 8000) + "\n...[cắt bớt]" : text}`;
      }

      if (mimeType?.startsWith("text/")) {
        const exp = await drive.files.get({ fileId: id, alt: "media" }, { responseType: "text" });
        const text = String(exp.data);
        return text.length > 8000 ? text.slice(0, 8000) + "\n...[cắt bớt]" : text;
      }

      return `File "${name}" có định dạng ${mimeType} chưa được hỗ trợ đọc trực tiếp.`;
    }

    case "gdrive_search": {
      const { query, file_type = "any", max_results = 10 } = input as { query: string; file_type?: string; max_results?: number };
      const { drive } = getDriveClients();
      const mimeMap: Record<string, string> = {
        doc: "application/vnd.google-apps.document",
        sheet: "application/vnd.google-apps.spreadsheet",
        slide: "application/vnd.google-apps.presentation",
        pdf: "application/pdf",
        text: "text/plain",
      };
      const conds = [
        "trashed = false",
        `(name contains '${query.replace(/'/g, "\\'")}' or fullText contains '${query.replace(/'/g, "\\'")}')`,
      ];
      if (file_type !== "any" && mimeMap[file_type]) conds.push(`mimeType = '${mimeMap[file_type]}'`);
      const resp = await drive.files.list({
        q: conds.join(" and "),
        pageSize: max_results,
        fields: "files(id, name, mimeType, modifiedTime, webViewLink)",
        orderBy: "modifiedTime desc",
      });
      const files = resp.data.files ?? [];
      if (!files.length) return `Không tìm thấy file nào khớp với "${query}".`;
      return `Kết quả (${files.length} file):\n\n` + files.map((f, i) =>
        `${i + 1}. ${f.name}\n   ID: ${f.id}\n   Link: ${f.webViewLink}`
      ).join("\n\n");
    }

    default:
      throw new Error(`Tool không tồn tại: ${name}`);
  }
}
