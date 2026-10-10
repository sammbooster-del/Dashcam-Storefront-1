---
name: Preview path verification
description: Verify the exact preview-bar URL rather than assuming a successful screenshot covers the bare artifact path.
---

Check both the bare artifact base path and its trailing-slash form when investigating a preview error.

**Why:** The user's preview opened the bare base path while the screenshot helper opened its trailing-slash form. A successful screenshot therefore did not establish that the user's exact URL worked.

**How to apply:** Reproduce the literal path in the reported preview, including query parameters. Confirm redirects preserve the artifact prefix and query string and do not break nested application routes. Do not describe a preview as fixed solely because a different normalized URL rendered successfully.
