---
name: AI cá nhân webapp design
description: Full product spec for the SmartHomeQ "AI cá nhân" web app (artifacts/webapp). Covers chat naming, tool/skill request flow, and 4-tab Quản lý Web Site tool.
---

# AI cá nhân — Web App Design Spec

## Core Rules
1. AI on web app = same backend as admin chatbot (same /api/anthropic/* endpoints, same model/system prompt)
2. Default chat name: "AI cá nhân". When user sets a business site → name becomes "AI nhân viên bán hàng [tên doanh nghiệp/domain]"
3. Tool & Skill list pulled from admin API (/api/admin/tools + /api/admin/skills). Admin creates tool → web app sees it immediately.

## Chat Page
- Uses /api/anthropic/conversations (same as admin)
- Header name: stored in localStorage key "ai_business_name", default "AI cá nhân"
- Updated automatically when user saves a site in Tab 1 of Webscraper tool

## Tool & Skill Page (Bottom Nav)
- Pull all tools from /api/admin/tools, all skills from /api/admin/skills
- Show each with icon, name, description
- Status per user stored in tool_requests table: pending | approved | rejected
- Flow: See all → "Xin dùng" → wait for admin → approved → "Cấu hình" button appears
- "Cấu hình" opens tool-specific config UI

## Tool "Quản lý Web Site" — 4 Tabs

### Tab 1: Web bán hàng (chính)
- Input URL → "AI Phân tích" button → auto-detect site type (WooCommerce/Shopify/HTML/etc.)
- If WooCommerce: show Consumer Key + Consumer Secret fields
- "Lấy thông tin" → scrape products → display list on Tab 1
- Each product: [Xem] (original link) | [Sửa] (popup, direct publish, editable multiple times) | [Tạo sản phẩm mới]
- "Tạo sản phẩm mới": AI creates form fields + "AI nhập nhanh" button → submit → goes to Tab 3
- When site saved: extract business name → update chat header to "AI nhân viên bán hàng [name]"

### Tab 2: Web nguồn (viết bài)
- Input source URL → AI analyze + scrape products
- Select 1 or all → AI copies existing info into form, asks for missing info → goes to Tab 3

### Tab 3: Chờ duyệt & đăng
- List of products from Tab 1 + Tab 2
- After admin approval → ask "Đăng lên đâu?" → show categories from Tab 4 → user selects → publish to WooCommerce

### Tab 4: Danh mục & Biểu mẫu
- Editable list of categories/menus fetched from main site
- Editable list of AI-generated form templates

## WooCommerce Bug Note
- Edit product (PUT /wp-json/wc/v3/products/{id}) was reported to only work once — need to verify and fix. Likely a caching or state issue in the frontend.

## DB Tables Used
- tool_requests: stores user tool request status (pending/approved/rejected)
- scraped_sites: stores configured sites (isMain flag)
- scraped_items: products fetched from sites
- content_templates: AI-generated form templates
- draft_posts: products waiting for approval (Tab 3)
