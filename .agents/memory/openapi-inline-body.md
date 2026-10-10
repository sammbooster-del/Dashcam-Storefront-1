---
name: OpenAPI inline-body collision
description: A generated TypeScript naming collision for parameterized API operations with inline request bodies.
---

For an operation with path parameters and a JSON request body, reference a named schema for the body rather than defining that object inline in OpenAPI.

**Why:** The code generator produced a request-body type and validation value with the same exported name from separate generated barrels. Generation itself succeeded, but the library typecheck failed on their duplicate export. Using a named schema resolved the collision.

**How to apply:** When adding parameterized operations with JSON bodies, use a component schema reference from the start; check the generated library typecheck after code generation.