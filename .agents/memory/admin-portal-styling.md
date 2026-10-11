---
name: Admin portal styling
description: Keep portal-rendered admin controls readable and accessible.
---

Admin popups rendered through a portal need an explicit admin theme scope, without copying the full admin layout onto the popup.

**Why:** The admin theme variables are inherited from the page container. A portal rendered outside that container caused the Send button to display white lettering on a transparent background.

**How to apply:** When adding admin dialogs, provide their theme variables at the portal content and check enabled and disabled controls for contrast. Keep modal semantics and keyboard focus behavior intact.
