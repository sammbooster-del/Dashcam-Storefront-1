---
name: Tool sandbox globals
description: A limitation encountered when downloading catalog assets through the JavaScript tool sandbox.
---

Do not assume that an impure function in the tool sandbox exposes every Node or browser global just because it exposes fetch.

**Why:** A catalog image download using AbortSignal.timeout failed with AbortSignal not defined even inside an impure function; the download itself worked without that option.

**How to apply:** Use only documented sandbox globals. For downloads requiring Node-specific timeout APIs, execute them through the normal shell rather than changing the workspace runtime to fix the sandbox.
