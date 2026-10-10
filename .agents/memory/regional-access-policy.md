---
name: Regional access policy
description: Owner-requested India access restriction, independent of shipping-country options.
---

The owner requested that the site not open when someone accesses it from India.

**Why:** The user asked.

**How to apply:** Block IP locations identified as India before showing the storefront and enforce the same restriction on backend requests. Do not confuse visitor location with a selected delivery country, nationality, or browser language.

When location verification fails, show a retry screen instead of silently permitting access.

**Why:** Allowing unknown locations would bypass the requested restriction when geolocation fails.

**How to apply:** Preserve the temporary-unavailable behavior; health checks must remain accessible. Explain that IP geolocation is approximate and VPNs can bypass regional restrictions.

The development preview proxy can hide the visitor's public IP even for external preview requests.

**Why:** The preview returned a local-only access result through its public proxy; server-side IP simulation alone did not exercise the browser's real location.

**How to apply:** Retain an independent browser location check in both preview and production, and verify actual forwarded-IP handling after publishing. Do not mistake an allowed local request for proof of the visitor's country.

The rightmost public forwarded IP can belong to a hosting proxy, not the visitor.

**Why:** A live request originating in India was reported as Singapore when the server selected only the rightmost public address.

**How to apply:** Do not let a proxy's allowed country override a blocked visitor in the forwarded chain. Keep browser verification independent of the server's reported country; unknown locations still fail closed. IP geolocation cannot identify physical location behind a foreign VPN.

Use a backup geolocation provider when the primary lookup fails, rather than removing the regional access gate.

**Why:** The preview can reach the API but still show “Unable to check availability” when its browser lookup fails. Single-provider availability must not determine whether eligible visitors can open the storefront.

**How to apply:** Both browser and server lookups need an independent fallback. Preserve India blocking and the retry screen when all providers fail.
