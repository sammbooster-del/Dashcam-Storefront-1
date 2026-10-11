import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { db, storeCatalogAdditionsTable, storeProductsTable } from "@workspace/db";
import { applyCatalogAdditions } from "./catalogAdditions";
import { publishedCatalogAdditions, type CatalogAddition } from "./publishedCatalog";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
class TestRollback extends Error {}

// Every integration test uses a rolled-back outer transaction. Fixtures can
// never modify merchant inventory or leave products/receipts behind.
async function isolated(run: (tx: Transaction, addition: CatalogAddition) => Promise<void>) {
  const slug = `catalog-addition-check-${randomUUID()}`;
  const addition: CatalogAddition = {
    key: slug,
    product: { ...publishedCatalogAdditions[0].product, slug, active: false },
  };
  try {
    await db.transaction(async tx => {
      await run(tx, addition);
      throw new TestRollback();
    });
  } catch (error) {
    if (!(error instanceof TestRollback)) throw error;
  }
}

test("the bundled listing matches the requested product, price and inventory", () => {
  assert.equal(publishedCatalogAdditions.length, 1);
  const { product } = publishedCatalogAdditions[0];
  assert.equal(product.slug, "patchface-full-face-pimple-patch-4-masks");
  assert.equal(product.stock, 265);
  assert.equal(product.priceCents, 2800);
  assert.equal(product.category, "skincare");
  assert.equal(product.active, true);
  assert.equal(product.featured, true);
  assert.equal(product.imageUrls?.length, 2);
  assert.equal(product.imageUrl, product.imageUrls?.[0]);
});

test("a missing listing is inserted once and marked as applied", async () => {
  await isolated(async (tx, addition) => {
    assert.equal((await applyCatalogAdditions(tx, [addition]))[0].state, "added");
    assert.equal((await applyCatalogAdditions(tx, [addition]))[0].state, "already_applied");
    const rows = await tx.select().from(storeProductsTable)
      .where(eq(storeProductsTable.slug, addition.product.slug));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].stock, 265);
    const receipts = await tx.select().from(storeCatalogAdditionsTable)
      .where(eq(storeCatalogAdditionsTable.key, addition.key));
    assert.equal(receipts.length, 1);
  });
});

test("an existing listing's merchant edits are preserved on first application", async () => {
  await isolated(async (tx, addition) => {
    await tx.insert(storeProductsTable).values({
      ...addition.product, name: "Merchant title", stock: 17, priceCents: 1999,
      active: false, featured: false,
    });
    assert.equal((await applyCatalogAdditions(tx, [addition]))[0].state, "already_present");
    const [row] = await tx.select().from(storeProductsTable)
      .where(eq(storeProductsTable.slug, addition.product.slug));
    assert.equal(row.name, "Merchant title");
    assert.equal(row.stock, 17);
    assert.equal(row.priceCents, 1999);
    assert.equal(row.active, false);
    assert.equal(row.featured, false);
  });
});

test("later applications do not reset sold-out stock, prices or visibility", async () => {
  await isolated(async (tx, addition) => {
    await applyCatalogAdditions(tx, [addition]);
    await tx.update(storeProductsTable).set({ stock: 0, priceCents: 3100, active: false })
      .where(eq(storeProductsTable.slug, addition.product.slug));
    await applyCatalogAdditions(tx, [addition]);
    const [row] = await tx.select().from(storeProductsTable)
      .where(eq(storeProductsTable.slug, addition.product.slug));
    assert.equal(row.stock, 0);
    assert.equal(row.priceCents, 3100);
    assert.equal(row.active, false);
  });
});

test("a deleted listing is not resurrected on a later application", async () => {
  await isolated(async (tx, addition) => {
    await applyCatalogAdditions(tx, [addition]);
    await tx.delete(storeProductsTable).where(eq(storeProductsTable.slug, addition.product.slug));
    assert.equal((await applyCatalogAdditions(tx, [addition]))[0].state, "already_applied");
    const rows = await tx.select().from(storeProductsTable)
      .where(eq(storeProductsTable.slug, addition.product.slug));
    assert.equal(rows.length, 0);
  });
});

test("an insertion failure rolls back its receipt and allows a safe retry", async () => {
  await isolated(async (tx, addition) => {
    await assert.rejects(applyCatalogAdditions(tx, [{
      ...addition, product: { ...addition.product, name: null as unknown as string },
    }]));
    const receipts = await tx.select().from(storeCatalogAdditionsTable)
      .where(eq(storeCatalogAdditionsTable.key, addition.key));
    assert.equal(receipts.length, 0);
    assert.equal((await applyCatalogAdditions(tx, [addition]))[0].state, "added");
  });
});

test.after(async () => { await db.$client.end(); });
