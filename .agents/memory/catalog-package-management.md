---
name: Catalog package management
description: Preserve workspace policy and existing catalog ranges when adding shared-library dependencies.
---

Adding existing catalog dependencies with pnpm add can rewrite the workspace YAML, strip comments, and replace an existing caret range with an exact resolved version.

**Why:** A shared-library dependency addition unexpectedly rewrote unrelated workspace policy documentation and pinned the existing React type catalog range.

**How to apply:** Prefer updating the package manifest to reference existing catalog entries, then installing without changing the catalog. Check workspace and lockfile diffs for unintended catalog pins or lost security/version constraints. Preserve the minimum release age and Expo's exact React versions.
