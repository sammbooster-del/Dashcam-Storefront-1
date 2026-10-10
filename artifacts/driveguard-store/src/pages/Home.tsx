import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';
import type { Product, StoreSettings } from '@workspace/api-client-react';
import { EmptyBlock } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { buildCategories, categoryLabel } from '@/lib-categories';
import { groupProducts } from '@/lib-groups';
import { DEFAULT_HERO, categoryHref, type CartLine } from '@/lib-store';

export default function Home({ products, settings, cart, onAdd }: { products: Product[]; settings: StoreSettings; cart: CartLine[]; onAdd: (product: Product, quantity: number) => void }) {
  const [q, setQ] = useState('');
  const cats = useMemo(() => buildCategories(products), [products]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter(p => `${p.name} ${p.description} ${categoryLabel(p.category)} ${p.category}`.toLowerCase().includes(t));
  }, [products, q]);
  const groups = useMemo(() => groupProducts(shown), [shown]);
  return (
    <div>
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-10 md:grid-cols-2 md:pt-16" data-testid="section-hero">
        <div className="rise">
          <p className="chip mb-5">Practical things, picked daily</p>
          <h1 className="display text-5xl font-semibold leading-[1.02] md:text-7xl" data-testid="text-hero-title">{settings.heroTitle}</h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">{settings.heroDescription}</p>
          <div className="relative mt-8 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="field" style={{ paddingLeft: 44 }} type="search" placeholder="Search products and categories" value={q} onChange={e => setQ(e.target.value)} data-testid="input-search-products" aria-label="Search catalog" />
          </div>
        </div>
        <div className="rise overflow-hidden rounded-[2rem] bg-muted" style={{ animationDelay: '120ms' }}>
          <img src={settings.heroImageUrl || DEFAULT_HERO} alt="" className="aspect-[4/3] w-full object-cover" />
        </div>
      </section>
      {cats.length > 0 && <section className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-8">{cats.map(c => <Link key={c.key} href={categoryHref(c.key)} className="btn btn-ghost btn-sm" data-testid={`button-filter-${c.key}`}>{c.label}</Link>)}</section>}
      <section id="shop" className="mx-auto max-w-6xl px-4">
        <h2 className="mb-6 text-3xl font-semibold">{q ? `Results for "${q}"` : 'Everything in stock'}</h2>
        {groups.length === 0 ? <EmptyBlock title={q ? 'Nothing matches that' : 'The shelves are empty'} text={q ? 'Try a shorter word or browse a category.' : 'Products will appear here once the store adds them.'}>{q && <button type="button" className="btn btn-ghost" onClick={() => setQ('')} data-testid="button-clear-search">Clear search</button>}</EmptyBlock> :
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4" data-testid="text-collection-count">{groups.map((g, i) => <ProductCard key={g.key} g={g} i={i} onAdd={onAdd} quantityInCart={cart.find(line => line.productId === g.lead.id)?.quantity ?? 0} />)}</div>}
      </section>
    </div>
  );
}
