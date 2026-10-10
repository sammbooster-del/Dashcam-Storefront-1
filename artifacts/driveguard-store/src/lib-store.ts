import type { Product } from '@workspace/api-client-react';

export type CartLine = { productId: number; quantity: number };
export type CartEntry = { product: Product; quantity: number };
export type CartActions = { updateQuantity: (id: number, amount: number) => void; removeItem: (id: number) => void };
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export const DEFAULT_HERO = '/images/catalog/hero.jpg';
export const categoryHref = (key: string) => `/category/${encodeURIComponent(key)}`;
export const safeDecode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
