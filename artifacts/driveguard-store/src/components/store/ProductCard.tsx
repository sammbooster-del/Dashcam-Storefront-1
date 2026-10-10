import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import type { ProductGroup } from '@/lib-groups';
import { money } from '@/lib-store';

export function ProductCard({ g, i = 0, onAdd, quantityInCart = 0 }: { g: ProductGroup; i?: number; onAdd: (product: Product, quantity: number) => void; quantityInCart?: number }) {
  const p = g.lead;
  const out = g.stock <= 0;
  const img = p.imageUrl || p.imageUrls?.[0];
  const [added, setAdded] = useState(false);
  const feedbackTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);
  const atLimit = quantityInCart >= p.stock;
  const add = () => {
    if (out || atLimit || g.multi) return;
    onAdd(p, 1);
    setAdded(true);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAdded(false), 2200);
  };
  return (
    <article className="rise flex h-full flex-col" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }} data-testid={`card-product-${p.slug}`}>
      <Link href={`/product/${p.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {img ? <img src={img} alt={g.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>}
        {out && <span className="chip absolute left-3 top-3 bg-background">Sold out</span>}
        {!out && g.featured && <span className="chip absolute left-3 top-3 text-white" style={{ background: 'var(--brand)' }}>Featured</span>}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold leading-tight" data-testid="text-product-name">{g.name}</h3>
        <span className="whitespace-nowrap text-sm font-medium" data-testid="text-product-price">{g.multi ? 'From ' : ''}{money(g.minPrice)}</span>
      </div>
      </Link>
      <div className="mt-auto pt-4">
        {out ? <button type="button" disabled className="btn btn-ghost w-full" data-testid={`button-quick-add-${p.id}`}>Sold out</button>
          : g.multi ? <Link href={`/product/${p.slug}`} className="btn btn-ghost w-full" data-testid={`button-choose-options-${p.id}`}>Choose options</Link>
          : <button type="button" onClick={add} disabled={atLimit} className="btn btn-ghost w-full" data-testid={`button-quick-add-${p.id}`}>
            {added ? <><Check size={16} aria-hidden="true" /> Added</> : atLimit ? 'Cart limit reached' : <><ShoppingBag size={16} aria-hidden="true" /> Add to cart</>}
          </button>}
        <span role="status" aria-live="polite" className="sr-only">{added ? `${g.name} added to cart.` : ''}</span>
      </div>
    </article>
  );
}
