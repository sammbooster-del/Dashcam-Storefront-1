---
name: Private product checkout scope
description: Owner-approved Stripe scope for products available only through shared links.
---
Stripe-hosted checkout is authorized only for the new link-only products, not as a migration of the existing store checkout.

**Why:** The user chose Stripe-hosted checkout and specified “only for thay particular product, dont change anything in the site.”

**How to apply:** Keep these products out of the public catalog and isolate their checkout from existing product paths. Support a per-product choice to omit delivery details. Do not change the existing catalog or checkout as part of this feature.

The owner also accepts payments privately: “sometimes client choose to pay me privately.” Private links should support invoices settled outside Stripe.

**Why:** Customers need to see their already-paid invoice when opening the shared link, without being asked to pay again.

**How to apply:** Keep seller-recorded payments distinct from Stripe-confirmed payments, retain the settled invoice amount, and do not turn a manual receipt into a claim that Stripe processed it.
