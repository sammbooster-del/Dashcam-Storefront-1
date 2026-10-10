import { Link } from 'wouter';
import { Minus, Plus, Trash2 } from 'lucide-react';
import type { StoreSettings } from '@workspace/api-client-react';
import { AcceptedCards } from '@/components/AcceptedCards';
import { type CartActions, type CartEntry, money } from '@/lib-store';

export const cartTotals = (cart: CartEntry[], settings: StoreSettings) => {
  const subtotal = cart.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);
  const shipping = !subtotal || subtotal >= settings.shippingThresholdCents ? 0 : settings.shippingCents;
  return { subtotal, shipping, total: subtotal + shipping };
};

export function CartLines({ cart, updateQuantity, removeItem }: { cart: CartEntry[] } & CartActions) {
  return <ul className="divide-y">{cart.map(({ product, quantity }) => (
    <li key={product.id} className="flex gap-4 py-5" data-testid={`row-cart-item-${product.id}`}>
      <Link href={`/product/${product.slug}`}><img src={product.imageUrl || product.imageUrls?.[0]} alt="" className="h-24 w-24 rounded-2xl bg-muted object-cover" data-testid="img-cart-product" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2"><div><Link href={`/product/${product.slug}`} className="font-semibold" data-testid={`link-cart-product-${product.id}`}>{product.name}</Link><p className="text-sm text-muted-foreground">{money(product.priceCents)} each</p></div><span className="font-medium" data-testid={`text-cart-item-total-${product.id}`}>{money(product.priceCents * quantity)}</span></div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex h-9 items-center rounded-full border">
            <button type="button" className="grid h-9 w-9 place-items-center" onClick={() => updateQuantity(product.id, -1)} aria-label="Decrease quantity" data-testid={`button-decrease-cart-item-${product.id}`}><Minus size={14} /></button>
            <span className="w-7 text-center text-sm font-semibold" data-testid={`text-cart-item-quantity-${product.id}`}>{quantity}</span>
            <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-40" disabled={quantity >= product.stock} onClick={() => updateQuantity(product.id, 1)} aria-label="Increase quantity" data-testid={`button-increase-cart-item-${product.id}`}><Plus size={14} /></button>
          </div>
          <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => removeItem(product.id)} aria-label={`Remove ${product.name}`} data-testid={`button-remove-cart-item-${product.id}`}><Trash2 size={14} />Remove</button>
          {quantity >= product.stock && <span className="text-xs text-muted-foreground">Max available</span>}
        </div>
      </div>
    </li>))}</ul>;
}

export function TotalsBlock({ cart, settings }: { cart: CartEntry[]; settings: StoreSettings }) {
  const { subtotal, shipping, total } = cartTotals(cart, settings);
  return <dl className="mt-5 space-y-2 text-sm">
    <div className="flex justify-between"><dt>Subtotal</dt><dd data-testid="text-cart-subtotal">{money(subtotal)}</dd></div>
    <div className="flex justify-between"><dt>Shipping</dt><dd data-testid="text-cart-shipping">{shipping ? money(shipping) : 'Free'}</dd></div>
    <div className="flex justify-between border-t pt-3 text-lg font-semibold"><dt>Total</dt><dd data-testid="text-cart-total">{money(total)}</dd></div>
    {settings.shippingThresholdCents > 0 && shipping > 0 && <p className="text-xs text-muted-foreground">Free shipping over {money(settings.shippingThresholdCents)}.</p>}
  </dl>;
}

export function CartSummary({ cart, updateQuantity, removeItem, settings }: { cart: CartEntry[]; settings: StoreSettings } & CartActions) {
  return <div className="panel p-5 sm:p-6">
    <div className="flex items-center justify-between border-b pb-4"><h2 className="text-xl font-semibold">Order summary</h2><span className="chip" data-testid="text-cart-item-count">{cart.reduce((s, i) => s + i.quantity, 0)} item(s)</span></div>
    {cart.length ? <CartLines cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} /> : <div className="py-12 text-center" data-testid="text-empty-cart"><h3 className="text-xl font-semibold">Your cart is empty</h3><p className="mt-2 text-sm text-muted-foreground">Explore the current collection to get started.</p><Link href="/" className="btn mt-6" data-testid="link-empty-cart-shop">Shop products</Link></div>}
    {cart.length > 0 && <><TotalsBlock cart={cart} settings={settings} /><div className="mt-5 border-t pt-5"><AcceptedCards location="cart" /></div></>}
  </div>;
}
