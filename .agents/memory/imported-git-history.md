---
name: Imported Git history
description: Missing ancestry when pushing an imported shallow repository to an empty GitHub repository.
---

A shallow imported repository can pass local integrity checks yet fail its first push to an empty GitHub repository with “did not receive expected object.” Do not assume the generic push-rejected banner means remote commits conflict.

**Why:** The failed upload referenced a missing parent beyond the import's shallow boundary. Disabling thin packs did not fix it, and fetching older history from the Replit Git backup did not recover that ancestor.

**How to apply:** Check authentication, live remote branches, shallow boundaries and whether the named missing object is an ancestor. A successful backup fetch is not proof of recovery; verify the parent exists. If no source can supply the ancestry, obtain consent before starting a new main-branch history from the current files, retain the imported history as a local backup, and never force-push over existing remote work.

Native Git-provider connections can report healthy while command-line pushes reject authentication. Generic integration reconnect cards may also reject these source-control connections rather than opening an OAuth form.

**Why:** Both reconnect and initial-connect forms rejected the native Git-provider connection despite its reported OAuth authorization.

**How to apply:** Do not loop through generic integration forms or ask for credentials in chat. Use the Git Providers account settings for authorization recovery, or let the owner perform the prepared push in their already-authenticated Shell session. Clearly distinguish a completed local history repair from a successful remote upload.
