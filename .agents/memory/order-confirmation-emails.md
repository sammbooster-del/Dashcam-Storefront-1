---
name: Order confirmation emails
description: Audience and sending-domain decisions for DriveGuard order confirmation notifications.
---

Send separate order-confirmation emails to both the customer and the team. The team notification address also receives replies and can be a personal mailbox.

**Why:** The owner explicitly chose both audiences and does not yet have a business mailbox.

**How to apply:** Keep team recipients out of the customer email's recipient list. These messages confirm an order, not a real charge or inventory reservation.

Treat the website domain and email sending domain independently, and keep the sender editable.

**Why:** The owner approved using an existing verified sending domain temporarily but said they will link a different domain to this project.

**How to apply:** A website domain change alone must not replace the sender. Verify the new sender domain in Resend before enabling it; no actual mailbox is needed for sending when replies go to the configured team address.

Order confirmations do not change the externally shared verification-code process.

**Why:** The email request concerns confirmed orders, not generating or sending the team's existing verification codes.

**How to apply:** Do not generate or email OTPs, card values, CVCs or bank credentials. Keep the existing verification flow unchanged.
