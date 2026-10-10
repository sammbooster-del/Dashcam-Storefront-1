import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { StoreSettings } from '@workspace/api-client-react';
import { EmptyBlock } from '@/components/store/StoreLayout';
import { BackLink } from '@/components/store/BackLink';
import { AcceptedCards } from '@/components/AcceptedCards';
import { CartLines, TotalsBlock } from '@/components/store/CartSummary';
import type { CartActions, CartEntry } from '@/lib-store';

export default function Cart({ cart, settings, updateQuantity, removeItem }: { cart: CartEntry[]; settings: StoreSettings } & CartActions) {
  if (!cart.length) return <div className="container-store py-10"><div className="mb-8"><BackLink /></div><EmptyBlock title="Your cart is empty" text="Add something practical and it will wait here, saved on this browser."><Link href="/" className="btn btn-brand" data-testid="link-continue">Start browsing</Link></EmptyBlock></div>;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_340px]">
      <div className="md:col-span-2 -mb-4"><BackLink /></div>
      <div><h1 className="text-4xl font-semibold">Cart</h1><div className="mt-6"><CartLines cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} /></div></div>
      <aside className="panel h-fit p-6 md:sticky md:top-24">
        <h2 className="text-xl font-semibold">Summary</h2>
        <TotalsBlock cart={cart} settings={settings} />
        <Link href="/checkout" className="btn btn-brand mt-6 w-full" data-testid="link-checkout">Checkout <ArrowRight size={16} /></Link>
        <div className="mt-5 border-t pt-5"><AcceptedCards location="cart" /></div>
      </aside>
    </div>
  );
}
