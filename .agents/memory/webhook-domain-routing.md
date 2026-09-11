---
name: Webhook domain routing
description: Environment-specific public URL selection for inbound webhooks
---

Development webhook registrations must use the currently running public development domain. A configured production URL may exist but still return an unpublished-app page, which makes third-party webhooks silently never arrive.

**Why:** Telegram successfully accepted the webhook registration but could not deliver updates to a production URL that was not live, while the public development domain routed to the running API.

**How to apply:** Prefer the public development domain when running in development; use the production URL only in production. Re-register existing third-party webhooks after changing the URL.