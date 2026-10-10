import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { LifeBuoy, ShoppingBag } from 'lucide-react';
import type { Product, StoreSettings } from '@workspace/api-client-react';
import { buildCategories } from '@/lib-categories';
import { categoryHref } from '@/lib-store';
import { AcceptedCards } from '@/components/AcceptedCards';

const footLink = 'inline-block text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]';
const INFO_LINKS = [{ href: '/about', label: 'About' }, { href: '/contact', label: 'Contact' }, { href: '/shipping-returns', label: 'Shipping & Returns' }, { href: '/privacy', label: 'Privacy' }, { href: '/terms', label: 'Terms' }];

export function StoreLayout({ children, products, settings, cartCount }: { children: ReactNode; products: Product[]; settings: StoreSettings; cartCount: number }) {
  const [loc] = useLocation();
  const cats = buildCategories(products);
  const brand = settings.brandName || 'DriveGuard';
  const orderHelp = settings.supportEmail ? `mailto:${settings.supportEmail}?subject=${encodeURIComponent('Order help')}` : undefined;
  return (
    <div className="grain flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2" data-testid="link-home-logo">
            <span className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--brand)' }}>{brand.charAt(0)}</span>
            <span className="display text-xl font-semibold">{brand}</span>
          </Link>
          <nav className="ml-4 hidden gap-5 text-sm font-medium md:flex">
            {cats.slice(0, 6).map(c => <Link key={c.key} href={categoryHref(c.key)} className={loc === categoryHref(c.key) ? 'underline underline-offset-4' : 'text-muted-foreground hover:text-foreground'} data-testid={`button-nav-${c.key}`}>{c.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {orderHelp && <a href={orderHelp} className="btn btn-ghost btn-sm" data-testid="link-order-support"><LifeBuoy size={16} /><span className="hidden sm:inline">Order help</span></a>}
            <Link href="/cart" className="btn btn-sm" data-testid="link-cart"><ShoppingBag size={16} />Cart<span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs" data-testid="text-cart-count">{cartCount}</span></Link>
          </div>
        </div>
        {cats.length > 0 && <div className="flex gap-2 overflow-x-auto border-t px-4 py-2 md:hidden">{cats.map(c => <Link key={c.key} href={categoryHref(c.key)} className="chip whitespace-nowrap" data-testid={`button-mobile-nav-${c.key}`}>{c.label}</Link>)}</div>}
      </header>
      <main className="flex-1">{children}</main>
      <footer id="support" className="mt-16 border-t bg-card/60 text-sm" data-testid="footer-store">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="display text-xl font-semibold">{brand}</Link>
            <p className="mt-2 max-w-xs text-muted-foreground">Cameras and everyday essentials.</p>
            {settings.supportEmail ? <a href={`mailto:${settings.supportEmail}`} className="mt-3 inline-block break-all text-muted-foreground transition-colors hover:text-foreground">{settings.supportEmail}</a> : <p className="mt-3 text-muted-foreground">Support contact details are not published yet.</p>}
          </div>
          <nav aria-labelledby="footer-shop"><h2 id="footer-shop" className="text-base font-semibold">Shop</h2>
            <ul className="mt-3 space-y-2">
              <li><Link href="/" className={footLink} data-testid="link-footer-all">All products</Link></li>
              {cats.map(c => <li key={c.key}><Link href={categoryHref(c.key)} className={footLink} data-testid={`link-footer-${c.key}`}>{c.label}</Link></li>)}
            </ul></nav>
          <nav aria-labelledby="footer-info"><h2 id="footer-info" className="text-base font-semibold">Information</h2>
            <ul className="mt-3 space-y-2">
              {INFO_LINKS.map(l => <li key={l.href}><Link href={l.href} className={footLink} data-testid={`link-footer-${l.href.slice(1)}`}>{l.label}</Link></li>)}
            </ul></nav>
        </div>
        <div className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-6">
            <AcceptedCards location="footer" />
          </div>
        </div>
        <div className="border-t"><p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {brand}. All rights reserved.</p></div>
      </footer>
    </div>
  );
}

export function EmptyBlock({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="panel mx-auto max-w-md p-10 text-center" data-testid="state-empty"><div className="mx-auto mb-4 h-14 w-14 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--brand)' }} /><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p><div className="mt-5">{children}</div></div>;
}
