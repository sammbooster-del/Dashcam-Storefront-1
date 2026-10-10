---
name: Checkout arrival alert
description: Notification behavior the store owner selected for checkout activity.
---

Use a repeating Pushover emergency-priority notification when a shopper first starts entering contact or shipping details, rather than placing a phone call. Do not include shopper details or card values in the notification.

**Why:** The owner explicitly chose a Pushover repeated alert after learning that Pushover cannot make actual phone calls. The alert starts before order submission; firing on every keystroke would create excessive alerts and could be abused.

**How to apply:** Keep it one event per checkout start, with server-side bounds on anonymous traffic. Treat Pushover credentials as server-side secrets and report clearly when they have not been configured.