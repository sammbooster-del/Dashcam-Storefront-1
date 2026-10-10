---
name: Imported preview setup
description: Preserve the distinction between starting an imported app and restoring its previous state.
---

Treat restoring an imported preview and restoring the original site's data and identity accounts as separate operations. Do not imply that a working preview contains the original records or sign-in accounts.

**Why:** This import included application source but an empty development database and no configured authentication tenant. Installing dependencies alone could not restore the storefront.

**How to apply:** When addressing import startup failures, check the independent dependency, schema, and authentication prerequisites. Preserve authorization and original application behavior; explain any fresh development identity setup and obtain separate authorization before restoring external records.
