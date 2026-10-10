import type { Product } from '@workspace/api-client-react';

const VARIANT_RE = /^(everyday-.*)-variant-[0-9]+$/;
export type ProductGroup = { key: string; name: string; items: Product[]; lead: Product; minPrice: number; stock: number; featured: boolean; multi: boolean };

export const groupKey = (p: Product) => VARIANT_RE.exec(p.slug)?.[1] ?? null;
export const baseName = (p: Product) => groupKey(p) ? p.name.split(' — ')[0].trim() || p.name : p.name;
export const optionLabel = (p: Product) => groupKey(p) ? (p.name.includes(' — ') ? p.name.split(' — ').slice(1).join(' — ').trim() : p.name) : p.name;

export function groupProducts(products: Product[]): ProductGroup[] {
  const map = new Map<string, Product[]>();
  const order: string[] = [];
  products.forEach(p => {
    const k = groupKey(p) ?? `solo:${p.id}`;
    if (!map.has(k)) { map.set(k, []); order.push(k); }
    map.get(k)!.push(p);
  });
  return order.map(k => {
    const items = map.get(k)!;
    const lead = items.find(i => i.stock > 0) ?? items[0];
    return { key: k, name: baseName(lead), items, lead, minPrice: Math.min(...items.map(i => i.priceCents)), stock: items.reduce((s, i) => s + Math.max(0, i.stock), 0), featured: items.some(i => i.featured), multi: items.length > 1 };
  });
}

export const siblingsOf = (product: Product, all: Product[]) => {
  const k = groupKey(product);
  return k ? all.filter(p => groupKey(p) === k) : [product];
};
