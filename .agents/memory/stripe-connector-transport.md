---
name: Stripe connector setup
description: Why the private-link feature uses the connected Stripe API proxy rather than assuming the older native integration credential layout.
---

The Stripe connection supplied for this project uses an authenticated connector API proxy. Do not assume it exposes the older native integration's secret-key credential layout.

**Why:** The actual connection setup provided the connector SDK, and Stripe SDK requests through that proxy were verified against Stripe. Older integration templates describe a different connection shape. The owner authorized Stripe only for the new private-link feature, not a migration of the existing store.

**How to apply:** Follow the current connected integration's setup when extending private Stripe payments. Preserve authenticated proxy transport and provider-side idempotency. Keep Stripe's catalog and payment status authoritative; app-side link relationships are separate from the public catalog. Do not introduce global Stripe initialization or a payment-system migration that makes the unchanged storefront depend on Stripe availability.
