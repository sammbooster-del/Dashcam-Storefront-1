---
name: Shared React Query context
description: Production-only provider crashes caused by pnpm peer dependency variants.
---

Ensure application providers and shared generated hooks resolve a single React Query instance in the frontend bundle.

**Why:** Different React peer resolutions created separate pnpm instances of the same React Query version. Development appeared healthy, but the published bundle included two contexts and crashed with “No QueryClient set” despite a correctly placed provider. Deduplicating React alone did not deduplicate React Query.

**How to apply:** Preserve React Query deduplication when modifying Vite configuration or workspace dependencies. For this failure, inspect package realpaths and the production bundle rather than adding another provider or changing authentication.
