import { useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import type { Product } from '@workspace/api-client-react';
import { EmptyBlock } from '@/components/store/StoreLayout';
import { ProductCard } from '@/components/store/ProductCard';
import { BackLink } from '@/components/store/BackLink';
import { buildCategories, normalizeCategory } from '@/lib-categories';
import { groupProducts } from '@/lib-groups';
import { safeDecode, type CartLine } from '@/lib-store';

export default function Category({ products, cart, onAdd }: { products: Product[]; cart: CartLine[]; onAdd: (product: Product, quantity: number) => void }) {
  const { slug = '' } = useParams<{ slug: string }>();
  const key = normalizeCategory(safeDecode(slug));
  const [sort, setSort] = useState('featured');
  const [q, setQ] = useState('');
  const cat = useMemo(() => buildCategories(products).find(c => c.key === key), [products, key]);
  const list = useMemo(() => {
    let l = products.filter(p => normalizeCategory(p.category) === key && p.name.toLowerCase().includes(q.trim().toLowerCase()));
    const g = groupProducts(l);
    if (sort === 'low') return [...g].sort((a, b) => a.minPrice - b.minPrice);
    if (sort === 'high') return [...g].sort((a, b) => b.minPrice - a.minPrice);
    return [...g].sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [products, key, sort, q]);
  if (!cat) return <div className="px-4 py-16"><EmptyBlock title="No such category" text="It may have been renamed or has no products right now."><Link href="/" className="btn" data-testid="link-back-home">Browse everything</Link></EmptyBlock></div>;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4"><BackLink /></div>
      <h1 className="display text-5xl font-semibold" data-testid="text-category-name">{cat.label}</h1>
      <div className="my-8 flex flex-wrap gap-3">
        <input className="field max-w-xs" type="search" placeholder={`Search in ${cat.label}`} value={q} onChange={e => setQ(e.target.value)} data-testid="input-category-search" />
        <select className="field max-w-[200px]" value={sort} onChange={e => setSort(e.target.value)} data-testid="select-sort">
          <option value="featured">Featured first</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option>
        </select>
      </div>
      {list.length === 0 ? <EmptyBlock title="Nothing here yet" text="No products match in this category right now." /> :
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{list.map((g, i) => <ProductCard key={g.key} g={g} i={i} onAdd={onAdd} quantityInCart={cart.find(line => line.productId === g.lead.id)?.quantity ?? 0} />)}</div>}
    </div>
  );
}
