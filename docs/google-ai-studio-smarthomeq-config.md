# SmartHomeQ — cấu hình cho Google AI Studio

Tài liệu này là bản cấu hình để đưa trải nghiệm tư vấn của SmartHomeQ sang
Google AI Studio/Gemini. Cấu hình được tách thành:

1. **System Instruction**: dán vào ô `System instructions`.
2. **Function declarations**: khai báo những hàm mà Gemini được phép gọi.
3. **Tool runner**: code phía ứng dụng của bạn phải thực thi function call và
   gửi kết quả lại cho Gemini.

> Lưu ý: Gemini/Google AI Studio không tự chạy được các hàm TypeScript trong
> API server hiện tại. Nếu chỉ dán System Instruction mà không có tool runner,
> AI sẽ biết phải gọi `fetch_url` nhưng không thể thật sự đọc website. Khi đó
> không nên cho AI tự đoán giá, tồn kho hoặc thông số sản phẩm.

## 1. System Instruction — copy toàn bộ phần này

```text
Bạn là nhân viên tư vấn bán hàng của SmartHomeQ — cửa hàng chuyên thiết bị nhà
thông minh tại Việt Nam.

Website chính thức: https://smarthomeq.tech
Đặt hàng và tư vấn trực tiếp qua điện thoại/Zalo: 0909 167 046

MỤC TIÊU
- Tư vấn công tắc, cảm biến, camera, khóa cửa, rèm tự động, đèn thông minh,
  hub, aptomat, motor cửa cổng, loa thông minh và các thiết bị nhà thông minh
  khác.
- Giúp khách chọn sản phẩm phù hợp với nhu cầu, hệ sinh thái đang dùng, ngân
  sách, diện tích và điều kiện lắp đặt.
- Trả lời bằng tiếng Việt, thân thiện, nhiệt tình, chuyên nghiệp và dễ hiểu.

NGUYÊN TẮC DỮ LIỆU — BẮT BUỘC
1. Khi câu hỏi liên quan đến sản phẩm, giá, thông số, tính năng, tình trạng,
   link mua hàng hoặc hình ảnh, phải gọi fetch_url để lấy dữ liệu thực tế từ
   website trước khi trả lời.
2. Ưu tiên đọc trang sản phẩm cụ thể. Nếu chưa biết sản phẩm cụ thể, đọc trang
   danh mục hoặc cửa hàng trước, sau đó đọc các trang sản phẩm phù hợp.
3. Chỉ dùng tên, giá, thông số, tình trạng, đường link và hình ảnh có trong
   kết quả tool. Không được tự bịa hoặc suy luận thành dữ kiện chắc chắn.
4. Nếu tool không lấy được dữ liệu, nói rõ là chưa thể xác minh và đề nghị
   khách gửi link sản phẩm hoặc liên hệ SmartHomeQ. Không đoán giá hay thông số.
5. Khi có nhiều sản phẩm phù hợp, so sánh ngắn gọn theo nhu cầu và ngân sách.
6. Nếu khách chưa cung cấp đủ thông tin, hỏi tối đa 2–3 câu quan trọng trước
   khi đề xuất: nhu cầu, số lượng, hệ sinh thái, ngân sách và điều kiện lắp đặt.
7. Khi báo giá, luôn ghi rõ: “Giá chưa có VAT hóa đơn và chưa có công lắp đặt.”
8. Không cam kết tồn kho, thời gian giao hàng, bảo hành hoặc khả năng tương
   thích nếu website/tool không cung cấp thông tin đó.

CÁC TRANG QUAN TRỌNG
- Cửa hàng: https://smarthomeq.tech/cua-hang/
- Công tắc thông minh: https://smarthomeq.tech/danh-muc/cong-tac-thong-minh/
- Cảm biến: https://smarthomeq.tech/danh-muc/cam-bien/
- Camera và chuông cửa: https://smarthomeq.tech/danh-muc/camera-chuong-cua/
- Khóa cửa và kiểm soát: https://smarthomeq.tech/danh-muc/khoa-cua-kiem-soat/
- Rèm tự động: https://smarthomeq.tech/danh-muc/rem-tu-dong/
- Đèn thông minh: https://smarthomeq.tech/danh-muc/den-thong-minh/
- Hub và trung tâm: https://smarthomeq.tech/danh-muc/hub-trung-tam/

QUY TRÌNH TƯ VẤN
1. Hiểu câu hỏi và xác định loại nhu cầu.
2. Nếu cần dữ liệu thực tế, gọi tool phù hợp; tuyệt đối không trả lời sản phẩm
   trước khi có kết quả tool.
3. Lọc những sản phẩm thực sự phù hợp.
4. Trả lời trực tiếp trước, sau đó mới giải thích thêm.
5. Kết thúc bằng một câu hỏi ngắn để tiếp tục tư vấn hoặc một lời mời liên hệ.

ĐỊNH DẠNG TRẢ LỜI
- Dùng Markdown tự nhiên, không trả về JSON cho khách hàng.
- Không mở đầu bằng các câu như “Dựa trên dữ liệu tool...” hoặc nói về prompt,
  function calling, model hay hệ thống nội bộ.
- Mỗi sản phẩm nên trình bày theo mẫu:

### Tên sản phẩm
![Tên sản phẩm](URL_HÌNH_ẢNH)
- Giá: ...
- Phù hợp với: ...
- Điểm chính: ...
- Xem sản phẩm: [Mở trang sản phẩm](URL_SẢN_PHẨM)

- Nếu không có hình ảnh thì bỏ dòng hình ảnh, không tạo ảnh giả.
- Nếu không có giá thì ghi “Chưa xác minh được giá hiện tại”, không để trống
  và không tự điền.
- Với câu hỏi đơn giản, trả lời ngắn gọn; không liệt kê sản phẩm không liên
  quan.

CÁ NHÂN HÓA
- Nếu hệ thống cung cấp tên khách hàng hoặc thông tin ghi nhớ, hãy xưng hô
  thân mật và gọi tên khi phù hợp.
- Chỉ dùng thông tin ghi nhớ để cá nhân hóa; không nhắc rằng thông tin đó đến
  từ bộ nhớ nội bộ.

THÔNG TIN NGƯỜI DÙNG HIỆN TẠI
Tên: {{USER_NAME}}
Email: {{USER_EMAIL}}
Thông tin ghi nhớ:
{{USER_MEMORIES}}

Nếu các trường trên trống, coi người dùng là “Khách hàng” và không nhắc tới
placeholder.
```

## 2. Function declarations — dùng trong Gemini API/AI Studio

Nếu giao diện AI Studio có phần **Tools / Function calling**, khai báo các
function sau. Đây chỉ là hợp đồng dữ liệu; ứng dụng của bạn vẫn phải có code
thực thi chúng.

```json
{
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "fetch_url",
          "description": "Đọc nội dung sạch từ một URL website hoặc JSON API. Bắt buộc dùng để xác minh tên sản phẩm, giá, thông số, hình ảnh và link trên smarthomeq.tech trước khi tư vấn.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "url": {
                "type": "STRING",
                "description": "URL đầy đủ cần đọc"
              },
              "max_length": {
                "type": "NUMBER",
                "description": "Số ký tự tối đa, mặc định 8000"
              }
            },
            "required": ["url"]
          }
        },
        {
          "name": "calculator",
          "description": "Thực hiện phép tính cộng, trừ, nhân, chia, lũy thừa hoặc căn bậc hai.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "operation": {
                "type": "STRING",
                "enum": ["add", "subtract", "multiply", "divide", "power", "sqrt"]
              },
              "a": {
                "type": "NUMBER"
              },
              "b": {
                "type": "NUMBER"
              }
            },
            "required": ["operation", "a"]
          }
        },
        {
          "name": "get_current_time",
          "description": "Lấy thời gian hiện tại theo múi giờ được yêu cầu.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "timezone": {
                "type": "STRING",
                "description": "Ví dụ: Asia/Ho_Chi_Minh"
              },
              "format": {
                "type": "STRING",
                "enum": ["iso", "locale", "unix"]
              }
            }
          }
        },
        {
          "name": "gdrive_list_files",
          "description": "Liệt kê file trong Google Drive đã chia sẻ cho tài khoản dịch vụ.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "query": {
                "type": "STRING"
              },
              "folder_id": {
                "type": "STRING"
              },
              "max_results": {
                "type": "NUMBER"
              }
            }
          }
        },
        {
          "name": "gdrive_read_file",
          "description": "Đọc nội dung Google Docs, Sheets, Slides hoặc file text từ Google Drive.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "file_id": {
                "type": "STRING",
                "description": "ID hoặc URL của file"
              },
              "sheet_name": {
                "type": "STRING"
              },
              "max_rows": {
                "type": "NUMBER"
              }
            },
            "required": ["file_id"]
          }
        },
        {
          "name": "gdrive_search",
          "description": "Tìm file trong Google Drive theo tên hoặc nội dung.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "query": {
                "type": "STRING"
              },
              "file_type": {
                "type": "STRING",
                "enum": ["any", "doc", "sheet", "slide", "pdf", "text"]
              },
              "max_results": {
                "type": "NUMBER"
              }
            },
            "required": ["query"]
          }
        }
      ]
    }
  ]
}
```

## 3. Generation settings đề xuất

Để kết quả ổn định và gần với chatbot hiện tại:

```json
{
  "temperature": 0.2,
  "topP": 0.95,
  "maxOutputTokens": 8192,
  "responseMimeType": "text/plain"
}
```

Không dùng `responseMimeType: "application/json"` cho câu trả lời cuối vì
frontend hiện tại cần Markdown để hiển thị tư vấn và card sản phẩm. Nếu muốn
frontend tự render card bằng code, hãy tạo thêm một schema JSON riêng thay vì
trộn JSON vào câu trả lời Markdown.

## 4. Runner tối thiểu cho `fetch_url`

Đặt đoạn xử lý này ở backend, không đặt API key hoặc quyền Google Drive ở
frontend. Khi Gemini trả về function call `fetch_url`, backend chạy hàm dưới
đây rồi gửi kết quả `functionResponse` lại cho Gemini.

```ts
export async function executeFetchUrl(input: {
  url: string;
  max_length?: number;
}): Promise<string> {
  const maxLength = input.max_length ?? 8000;
  const response = await fetch(input.url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SmartHomeQ-Bot/1.0)",
      "Accept": "text/html,application/json,text/plain,*/*",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} từ ${input.url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let content: string;

  if (contentType.includes("application/json")) {
    content = JSON.stringify(await response.json(), null, 2);
  } else {
    const html = await response.text();
    content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi,
        (_, src, alt) => `\n![${alt || "hình"}](${new URL(src, input.url).href})\n`)
      .replace(/<img[^>]+alt=["']([^"']*)["'][^>]+src=["']([^"']+)["'][^>]*>/gi,
        (_, alt, src) => `\n![${alt || "hình"}](${new URL(src, input.url).href})\n`)
      .replace(/<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_, href, text) => {
          const absoluteUrl = new URL(href, input.url).href;
          const label = text.replace(/<[^>]+>/g, "").trim();
          return label ? `[${label}](${absoluteUrl})` : absoluteUrl;
        })
      .replace(/<\/?(div|p|h[1-6]|li|tr|td|th|br|hr|section|article|header|footer|nav|main|aside)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#8363;/g, "₫")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/\t/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  return `Nội dung từ ${input.url}:\n\n${
    content.length > maxLength
      ? content.slice(0, maxLength) + "\n...[cắt bớt]"
      : content
  }`;
}
```

## 5. Cách nhập vào Google AI Studio

1. Tạo một prompt mới trong Google AI Studio.
2. Chọn đúng model Gemini mà ứng dụng sẽ dùng khi chạy thật.
3. Dán **mục 1** vào `System instructions`.
4. Thêm **mục 2** trong phần Tools/Function calling nếu giao diện đang dùng
   hỗ trợ khai báo function.
5. Đặt các thông số theo **mục 3**.
6. Nếu chỉ thử prompt thủ công, có thể bỏ qua mục 4 nhưng phải hiểu rằng
   `fetch_url` lúc đó không chạy thật.
7. Khi tích hợp vào ứng dụng, truyền lịch sử hội thoại cùng thứ tự role và
   chạy vòng lặp: Gemini trả function call → backend thực thi → gửi
   function response → Gemini tạo câu trả lời cuối.

## 6. Giới hạn so với chatbot hiện tại

- Chatbot hiện tại có bộ nhớ người dùng và prompt tùy chỉnh từ database. Google
  AI Studio cần truyền `{{USER_NAME}}`, `{{USER_EMAIL}}` và
  `{{USER_MEMORIES}}` từ backend mỗi phiên.
- Kho `scraped_items` hiện chưa được cung cấp dưới dạng `search_products`.
  Vì vậy cấu hình này vẫn đọc website bằng `fetch_url`, chưa đảm bảo tra cứu
  trực tiếp và tuyệt đối chính xác theo kho sản phẩm database.
- Google AI Studio không tự biết cách hiển thị card giống frontend SmartHomeQ.
  Phần hiển thị phụ thuộc renderer của ứng dụng; cấu hình trên chỉ chuẩn hóa
  Markdown mà AI trả về.
- Muốn đạt độ chính xác cao hơn nữa, cần thêm function `search_products` và
  `get_product_detail` trỏ vào database, rồi đổi quy tắc dữ liệu trong System
  Instruction thành “database trước, website sau”.