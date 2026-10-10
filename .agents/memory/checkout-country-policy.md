---
name: Checkout country policy
description: Merchant control of enabled countries and the boundaries of automatic country selection.
---

Country management is an opt-in control, not an instruction to automatically enable worldwide checkout.

**Why:** The owner asked for admin options to add individual countries and add all countries. Automatically enabling every country would expand checkout eligibility without their choice.

**How to apply:** Preserve the existing enabled list when adding or changing these controls. Do not automatically add a visitor's detected country to that list.

Country detection is a convenience, not proof of the visitor's delivery address.

**Why:** IP location can reflect a VPN or network exit point, and a visitor can ship to another country. Failure of an external location service must not prevent checkout.

**How to apply:** Use approximate country only, allow manual selection, preserve shopper edits, and fall back to an enabled country when detection is unavailable or unsupported. Precise GPS location is unnecessary for this feature.
