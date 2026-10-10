import type { Product } from '@workspace/api-client-react';

const FRIENDLY: Record<string, string> = { front: 'Front cameras', dual: 'Dual-channel cameras', everyday: 'Everyday essentials' };
export const KNOWN_CATEGORY_EXAMPLES = ['skincare', 'bags', 'stationery', 'drinkware', 'front', 'dual', 'everyday', 'general'];
export const normalizeCategory = (value: string) => value.trim().toLocaleLowerCase();
export const productVisible = (product: Product, disabledCategories: readonly string[] = []) =>
  product.active && !disabledCategories.includes(normalizeCategory(product.category));
export const categoryLabel = (value: string) => {
  const key = normalizeCategory(value);
  if (Object.hasOwn(FRIENDLY, key)) return FRIENDLY[key];
  return key.split(/[\s_-]+/).filter(Boolean).map(word => word.charAt(0).toLocaleUpperCase() + word.slice(1)).join(' ') || 'General';
};
export type CategoryEntry = { key: string; label: string; count: number };
export const buildCategories = (products: Product[]): CategoryEntry[] => {
  const map = new Map<string, CategoryEntry>();
  products.forEach(product => {
    const key = normalizeCategory(product.category);
    if (!key) return;
    const entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, { key, label: categoryLabel(key), count: 1 });
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};
