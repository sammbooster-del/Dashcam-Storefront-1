import type { InsertStoreProduct } from "@workspace/db";

export interface CatalogAddition {
  key: string;
  product: InsertStoreProduct;
}

// Explicit, owner-requested additions only. This is not a copy of the
// development database, and these defaults never overwrite an existing row.
export const publishedCatalogAdditions: readonly CatalogAddition[] = [{
  key: "patchface-full-face-pimple-patch-4-masks",
  product: {
    slug: "patchface-full-face-pimple-patch-4-masks",
    name: "Patchface Full-Face Pimple Patch — 4 Masks",
    description: `Full-face coverage. A simpler overnight routine.

4 hydrocolloid masks per box • Two-piece fit • 6–8 hour wear

Cover multiple breakout-prone areas without placing dozens of tiny dots. Hydrocolloid helps absorb surface fluid from active spots, while the protective layer helps keep fingers away from picking.

WHY YOU’LL LOVE IT
• Upper and lower pieces for comfortable full-face coverage
• Translucent finish designed for overnight wear
• Fragrance-free and alcohol-free, according to Patchface
• No salicylic acid, benzoyl peroxide or retinol, according to the brand

YOUR NIGHTTIME ROUTINE
Cleanse and dry your face fully. Skip serums, moisturizer, retinol and acids underneath. Apply both pieces, smooth the edges, wear for 6–8 hours, then gently peel away. The brand recommends 2–3 uses per week. Each mask is single-use.

Patch test first and stop if irritation occurs. Best suited to small, surface-level, fluid-containing spots—not deep cystic acne. Results vary; this is not an acne cure.`,
    imageUrl: "/api/storage/objects/uploads/be59168f-2181-4756-b864-19a4f616c91d",
    imageUrls: [
      "/api/storage/objects/uploads/be59168f-2181-4756-b864-19a4f616c91d",
      "/api/storage/objects/uploads/97ba8095-78e8-4be6-8b88-c03a0111c883",
    ],
    priceCents: 2800,
    stock: 265,
    category: "skincare",
    featured: true,
    active: true,
  },
}];
