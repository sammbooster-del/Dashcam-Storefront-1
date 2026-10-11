import { db, storeCatalogAdditionsTable, storeProductsTable } from "@workspace/db";
import { publishedCatalogAdditions, type CatalogAddition } from "./publishedCatalog";

type CatalogDatabase = Pick<typeof db, "transaction">;
export interface CatalogAdditionResult {
  key: string;
  state: "added" | "already_present" | "already_applied";
}

export async function applyCatalogAdditions(
  database: CatalogDatabase = db,
  additions: readonly CatalogAddition[] = publishedCatalogAdditions,
): Promise<CatalogAdditionResult[]> {
  const results: CatalogAdditionResult[] = [];
  for (const addition of additions) {
    const result = await database.transaction(async tx => {
      // Claim and insertion commit together. The unique key also serializes
      // simultaneous starts of multiple deployment instances.
      const [receipt] = await tx.insert(storeCatalogAdditionsTable)
        .values({ key: addition.key })
        .onConflictDoNothing()
        .returning({ key: storeCatalogAdditionsTable.key });
      if (!receipt) return { key: addition.key, state: "already_applied" as const };

      const [product] = await tx.insert(storeProductsTable)
        .values(addition.product)
        .onConflictDoNothing({ target: storeProductsTable.slug })
        .returning({ id: storeProductsTable.id });
      return {
        key: addition.key,
        state: product ? "added" as const : "already_present" as const,
      };
    });
    results.push(result);
  }
  return results;
}
