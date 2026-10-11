---
name: Live catalog updates
description: Delivering product changes when preview and live catalogs use separate databases.
---

Preview catalog writes do not update the live catalog. Republishing applies application and schema changes, not newly inserted development product records.

**Why:** A product addition and subsequent stock update were visible in preview but absent from the owner's published Skincare page. The live database is separate, and the agent's production SQL access is read-only.

**How to apply:** Establish the intended catalog before changing records. For live additions, use the owner's authenticated live admin interface or provide a narrowly scoped, duplicate-safe statement for the owner to run in the production SQL runner. Do not replace production with development data or add startup database-copy routines; those can damage live orders or overwrite merchant inventory. State explicitly whether a change is preview-only or live.

When the owner explicitly asks for a listing to appear upon publishing, a narrowly scoped bundled catalog addition is acceptable application initialization—not a development-database copy.

**Why:** The owner requested a publish-triggered addition instead of manually entering production SQL. Reapplying defaults on every restart would reset merchant inventory or resurrect deleted products.

**How to apply:** Insert only the explicitly approved product if its slug is absent. Commit a durable applied receipt in the same transaction, preserve existing records, and retain the receipt after deletion. Let the normal Publish flow apply any tracking-table schema; never run schema DDL in application startup or deployment build commands. Do not generalize this into automatic synchronization of all development products.
