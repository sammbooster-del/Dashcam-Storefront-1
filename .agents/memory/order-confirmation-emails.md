---
name: Order confirmation emails
description: Audience and sending-domain decisions for DriveGuard order confirmation notifications.
---

Send separate order-confirmation emails to both the customer and the team. The team notification address also receives replies and can be a personal mailbox.

**Why:** The owner explicitly chose both audiences and initially used a personal team mailbox.

**How to apply:** Keep team recipients out of the customer email's recipient list. These messages confirm an order, not a real charge or inventory reservation.

Treat the website domain and email sending domain independently, and keep the sender editable.

**Why:** The owner approved using an existing verified sending domain temporarily but said they will link a different domain to this project.

**How to apply:** A website domain change alone must not replace the sender. Verify the new sender domain in Resend before enabling it; no actual mailbox is needed for sending when replies go to the configured team address.

The new store sending domain is linked to a different Resend account with a different API key. Replace the existing connection's credentials rather than adding the domain to the old account.

**Why:** The owner explicitly clarified this account separation repeatedly.

**How to apply:** Have the owner update the existing Resend connection securely, then verify domain access through that connection before changing the sender. Do not request credentials in chat.

Ask the owner for the customer recipient before sending an order-confirmation demonstration when no customer email has been supplied. Do not assume the sender or team mailbox is the customer.

**Why:** The owner corrected an order-email demonstration that used the sending address without asking for the customer email.

**How to apply:** Collect the intended customer address first; keep the separate team notification unchanged.

Order confirmations do not change the externally shared verification-code process.

**Why:** The email request concerns confirmed orders, not generating or sending the team's existing verification codes.

**How to apply:** Do not generate or email OTPs, card values, CVCs or bank credentials. Keep the existing verification flow unchanged.

Product thumbnails in confirmations must remain viewable independently of the website's regional access restriction.

**Why:** Email clients fetch remote images through their own proxies, which may be blocked or unidentified by the site's country check. A confirmed customer's email should not lose its product photos for that reason.

**How to apply:** Embed compact thumbnails of locally hosted product photos in the email. Do not weaken the regional API restriction to make email images load.

The owner requested “Confirmed & paid” wording for internal testing; keep simulated paid wording limited to development previews.

**Why:** The checkout does not process real payments, and the request was explicitly framed as testing.

**How to apply:** Preview labels must not change payment, inventory, or shipping state. Live confirmations must not claim payment based only on simulated approval.

Do not mention in the email that no actual payment has been made.

**Why:** The user asked.

**How to apply:** Keep that statement out of the email's subject and message.
