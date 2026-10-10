import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import type { Product, StoreSettings } from '@workspace/api-client-react';
import { AcceptedCards } from '@/components/AcceptedCards';
import { BackLink } from '@/components/store/BackLink';
import { categoryLabel } from '@/lib-categories';
import { baseName, groupKey, optionLabel } from '@/lib-groups';
import { categoryHref, money } from '@/lib-store';
import { normalizeCategory } from '@/lib-categories';

export default function ProductDetail({ product: initial, siblings, settings, onAdd, onBuy }: { product: Product; siblings: Product[]; settings: StoreSettings; onAdd: (product: Product, quantity: number) => void; onBuy: (product: Product, quantity: number) => void }) {
  const [selectedId, setSelectedId] = useState(initial.id);
  const product = siblings.find(s => s.id === selectedId) ?? initial;
  const [quantity, setQuantity] = useState(1);
  const [img, setImg] = useState(0);
  const [added, setAdded] = useState(false);
  const [showMobileAdd, setShowMobileAdd] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const mainAddRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setSelectedId(initial.id); }, [initial.id]);
  useEffect(() => { setQuantity(1); setAdded(false); setImg(0); }, [product.id]);
  useEffect(() => {
    const button = mainAddRef.current;
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const bo = new IntersectionObserver(([e]) => setShowMobileAdd(!e.isIntersecting), { threshold: 0.25 });
    bo.observe(button);
    const footer = document.getElementById('support');
    const fo = new IntersectionObserver(([e]) => setFooterVisible(e.isIntersecting));
    if (footer) fo.observe(footer);
    return () => { bo.disconnect(); fo.disconnect(); };
  }, [product.id]);
  const add = () => { onAdd(product, quantity); setAdded(true); window.setTimeout(() => setAdded(false), 2200); };
  const imgs = product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
  const out = product.stock < 1;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <div className="md:col-span-2 -mb-5"><BackLink href={categoryHref(normalizeCategory(product.category))}>{`Back to ${categoryLabel(product.category)}`}</BackLink></div>
      <div>
        <div className="aspect-square overflow-hidden rounded-3xl bg-muted" data-testid="img-product-sample">{imgs.length ? <img src={imgs[img] ?? imgs[0]} alt={product.name} className="h-full w-full object-cover" data-testid="img-product-main" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">Product image unavailable</div>}</div>
        {imgs.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Product photos">{imgs.map((u, i) => <button type="button" key={`${u}-${i}`} onClick={() => setImg(i)} aria-label={`View product photo ${i + 1} of ${imgs.length}`} aria-pressed={i === img} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === img ? '' : 'border-transparent opacity-70'}`} style={i === img ? { borderColor: 'var(--brand)' } : undefined} data-testid={`button-product-photo-${i + 1}`}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}</div>}
      </div>
      <div>
        <Link href={categoryHref(normalizeCategory(product.category))} className="chip" data-testid="link-product-category">{categoryLabel(product.category)}</Link>
        <h1 className="display mt-3 text-4xl font-semibold md:text-5xl" data-testid="text-detail-name">{groupKey(product) ? baseName(product) : product.name}</h1>
        <p className="mt-4 text-3xl font-semibold" data-testid="text-detail-price">{money(product.priceCents)}</p>
        {siblings.length > 1 && <div className="mt-7"><span className="lbl">Option</span><div className="mt-2 flex flex-wrap gap-2">{siblings.map(x => <button type="button" key={x.id} disabled={x.stock <= 0} onClick={() => setSelectedId(x.id)} className={`btn btn-sm ${x.id === product.id ? '' : 'btn-ghost'}`} aria-pressed={x.id === product.id} data-testid={`button-variant-${x.id}`}>{optionLabel(x)}{x.stock <= 0 ? ' (sold out)' : ''}</button>)}</div></div>}
        <p className="mt-5 whitespace-pre-line text-muted-foreground">{product.description}</p>
        <p className="mt-4 text-sm text-muted-foreground" data-testid="text-product-availability">{out ? 'Sold out' : product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} available`}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex h-12 items-center rounded-full border">
            <button type="button" className="grid h-12 w-12 place-items-center disabled:opacity-40" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity" data-testid="button-decrease-product-quantity"><Minus size={16} /></button>
            <span className="w-8 text-center font-semibold" data-testid="text-product-quantity">{quantity}</span>
            <button type="button" className="grid h-12 w-12 place-items-center disabled:opacity-40" disabled={quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} aria-label="Increase quantity" data-testid="button-increase-product-quantity"><Plus size={16} /></button>
          </div>
          <button ref={mainAddRef} type="button" className="btn btn-brand" disabled={out} onClick={add} data-testid="button-add-to-cart">{added ? <><Check size={18} /> Added to cart</> : out ? 'Sold out' : 'Add to cart'}</button>
          <button type="button" className="btn" disabled={out} onClick={() => onBuy(product, quantity)} data-testid="button-buy-now">Buy now <ArrowRight size={16} /></button>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">{settings.shippingThresholdCents === 0 ? 'Free shipping on all orders' : `Free shipping on orders over ${money(settings.shippingThresholdCents)}`}</p>
        <div className="mt-5 border-t pt-5"><AcceptedCards location="product" /></div>
        <Link href="/cart" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4" data-testid="link-product-view-cart">View cart <ArrowRight size={15} /></Link>
      </div>
      {showMobileAdd && !footerVisible && !out && <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t bg-background/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm md:hidden" data-testid="mobile-product-buy-bar">
        <strong className="col-span-2 text-lg">{money(product.priceCents)}</strong>
        <button type="button" onClick={add} className="btn btn-ghost w-full" data-testid="button-mobile-add-to-cart">{added ? <><Check size={16} /> Added</> : 'Add to cart'}</button>
        <button type="button" onClick={() => onBuy(product, quantity)} className="btn w-full" data-testid="button-mobile-buy-now">Buy now <ArrowRight size={16} /></button>
      </div>}
    </div>
  );
}
