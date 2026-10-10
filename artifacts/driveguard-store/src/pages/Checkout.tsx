import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Check, ChevronLeft } from 'lucide-react';
import type { StoreSettings } from '@workspace/api-client-react';
import { DemoCardCheckout } from '@/components/DemoCardCheckout';
import { BackLink } from '@/components/store/BackLink';
import { CartSummary, cartTotals } from '@/components/store/CartSummary';
import type { CartActions, CartEntry } from '@/lib-store';

export default function Checkout({ cart, updateQuantity, removeItem, clearCart, settings }: { cart: CartEntry[]; clearCart: () => void; settings: StoreSettings } & CartActions) {
  const [submittedType, setSubmittedType] = useState<'credit' | 'debit' | null>(null);
  if (submittedType) return <div className="px-4 py-16"><div className="panel mx-auto max-w-[600px] p-8 text-center sm:p-12" data-testid="status-demo-success"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: 'var(--brand)' }}><Check size={28} /></div><h1 className="mt-5 text-4xl font-semibold">Order received</h1><p className="mt-4 text-muted-foreground">Your order has been recorded.</p><Link href="/" className="btn mt-7" data-testid="link-success-store">Continue shopping <ArrowRight size={17} /></Link></div></div>;
  const { total } = cartTotals(cart, settings);
  return <div className="mx-auto max-w-6xl px-4 py-10">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <BackLink href="/cart">Back to cart</BackLink>
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-continue-shopping"><ChevronLeft size={15} /> Continue shopping</Link>
    </div>
    <h1 className="display mt-3 text-4xl font-semibold md:text-5xl">Checkout</h1>
    <p className="mt-2 text-muted-foreground">{cart.length ? 'Check your items, add delivery details, then choose how to pay.' : 'Your cart is empty. Choose a product to get started.'}</p>
    <div className={cart.length ? 'mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8' : 'mx-auto mt-8 max-w-[700px]'}>
      <div className="order-1 lg:sticky lg:top-24 lg:order-2"><CartSummary cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} settings={settings} /></div>
      {cart.length > 0 && <div className="order-2 min-w-0 lg:order-1"><DemoCardCheckout key={String(settings.fictionalDemoMode)} cart={cart} clearCart={clearCart} onSubmitted={setSubmittedType} totalCents={total} fictionalDemoMode={settings.fictionalDemoMode} settings={settings} /></div>}
    </div>
  </div>;
}
