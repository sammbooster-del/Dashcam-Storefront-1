import { useState } from 'react';
import { ChevronLeft, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { AcceptedCards } from './_modern/components/AcceptedCards';
import { DemoCardCheckout } from './_modern/components/DemoCardCheckout';
import { LocalLink as Link } from './_modern/LocalLink';
import type { Product, StoreSettings } from './_modern/types';
import './_group.css';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const roadView: Product = {
  id: 1,
  slug: 'roadview-4k-dual',
  name: 'RoadView 4K Dual',
  description: '4K front and rear dash camera with dual-channel recording.',
  category: 'dual',
  priceCents: 32900,
  stock: 18,
  imageUrl: '/__mockup/images/roadview-sample.jpg',
};

const settings: StoreSettings = {
  brandName: 'DriveGuard',
  trustDescription: 'A focused selection of driving cameras, with clear product details and helpful support.',
  supportEmail: 'support@driveguard.example',
  shippingCents: 995,
  shippingThresholdCents: 50000,
  fictionalDemoMode: true,
  verificationTitle: 'Verify your order',
  verificationMerchantName: 'DriveGuard',
  verificationCountry: 'United States',
  verificationPrompt: 'Select how to receive your one-time code',
  verificationEmailLabel: 'Email',
  verificationPhoneLabel: 'Phone',
  verificationNextLabel: 'Next',
  verificationAccentColor: '#54448b',
  verificationButtonColor: '#e18a23',
};

function ProductImage({ product, small = false, src }: { product: Product; small?: boolean; src?: string }) {
  const imageUrl = src ?? product.imageUrl;
  return <div className={`relative flex items-center justify-center overflow-hidden bg-[#f8f8f8] ${small ? 'h-[84px] w-[84px] shrink-0 rounded-xl border border-[#ececec] bg-white' : 'h-[320px] w-full sm:h-[430px]'}`} data-testid={small ? 'img-cart-product' : 'img-product-sample'}>
    {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-contain" /> : <div className="px-4 text-center text-sm text-[#777]">Product image unavailable</div>}
  </div>;
}

function CartSummary({ cart, updateQuantity, removeItem, settings }: { cart: { product: Product; quantity: number }[]; updateQuantity: (id: number, amount: number) => void; removeItem: (id: number) => void; settings: StoreSettings }) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const shipping = !subtotal || subtotal >= settings.shippingThresholdCents ? 0 : settings.shippingCents;
  return <div className="rounded-2xl border border-[#dde1e6] bg-white p-4 shadow-[0_24px_60px_-40px_rgba(28,37,50,.45)] sm:p-6">
    <div className="flex items-center justify-between border-b border-[#e8e8e8] pb-4"><h2 className="text-[20px] font-extrabold tracking-[-.03em]">Order summary</h2><span className="rounded-full bg-[#f3f4f6] px-3 py-1 text-[12px] font-semibold text-[#555]" data-testid="text-cart-item-count">{cart.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span></div>
    {cart.length ? cart.map(({ product, quantity }) => <div key={product.id} className="flex gap-3 border-b border-[#e8e8e8] py-4 sm:gap-4" data-testid={`row-cart-item-${product.id}`}><ProductImage product={product} small /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div className="min-w-0"><Link href={`/product/${product.slug}`} className="text-[14px] font-bold hover:text-[#c92525]" data-testid={`link-cart-product-${product.id}`}>{product.name}</Link><p className="mt-1 text-[11px] text-[#777]">{product.stock} available · {money(product.priceCents)} each</p></div><button type="button" onClick={() => removeItem(product.id)} className="grid h-10 w-10 shrink-0 place-items-center self-start text-[#777] hover:text-[#c92525]" aria-label={`Remove ${product.name}`} data-testid={`button-remove-cart-item-${product.id}`}><Trash2 size={17} /></button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex h-10 items-center rounded-lg border border-[#ddd] bg-[#fafafa]"><button type="button" onClick={() => updateQuantity(product.id, -1)} className="grid h-full w-10 place-items-center" aria-label="Decrease quantity" data-testid={`button-decrease-cart-item-${product.id}`}><Minus size={13} /></button><span className="w-7 text-center text-xs font-bold" data-testid={`text-cart-item-quantity-${product.id}`}>{quantity}</span><button type="button" disabled={quantity >= product.stock} onClick={() => updateQuantity(product.id, 1)} className="grid h-full w-10 place-items-center disabled:opacity-40" aria-label="Increase quantity" data-testid={`button-increase-cart-item-${product.id}`}><Plus size={13} /></button></div><strong className="text-[14px]" data-testid={`text-cart-item-total-${product.id}`}>{money(product.priceCents * quantity)}</strong></div></div></div>) : <div className="py-12 text-center" data-testid="text-empty-cart"><ShoppingBag className="mx-auto text-[#777]" size={33} /><h3 className="mt-4 text-[21px] font-bold">Your cart is empty</h3><p className="mt-2 text-[13px] text-[#666]">Explore the current camera collection to get started.</p><Link href="/" className="red-button mt-6" data-testid="link-empty-cart-shop">Shop cameras</Link></div>}
    {cart.length > 0 && <div className="space-y-3 rounded-xl bg-[#f6f7f9] p-4 mt-4 text-[14px]"><div className="flex justify-between"><span className="text-[#666]">Subtotal</span><span data-testid="text-cart-subtotal">{money(subtotal)}</span></div><div className="flex justify-between"><span className="text-[#666]">Shipping</span><span data-testid="text-cart-shipping">{shipping ? money(shipping) : 'Free'}</span></div><div className="flex justify-between border-t border-[#d9dce1] pt-3 text-[20px] font-extrabold"><span>Total</span><span data-testid="text-cart-total">{money(subtotal + shipping)}</span></div></div>}
    {cart.length > 0 && <div className="mt-5 border-t border-[#e8e8e8] pt-5"><AcceptedCards location="cart" /></div>}
  </div>;
}

function CheckoutPage({ cart, updateQuantity, removeItem, clearCart, settings }: { cart: { product: Product; quantity: number }[]; updateQuantity: (id: number, amount: number) => void; removeItem: (id: number) => void; clearCart: () => void; settings: StoreSettings }) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0);
  const totalCents = subtotal + (subtotal > 0 && subtotal < settings.shippingThresholdCents ? settings.shippingCents : 0);
  return <main className="min-h-screen bg-[#f1f2f4] py-7 sm:py-12"><div className="mx-auto w-[min(100%-32px,1120px)]">
    <Link href="/" className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-[#555] hover:text-[#c92525]" data-testid="link-continue-shopping"><ChevronLeft size={15} /> Continue shopping</Link>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-2"><div><h1 className="text-[32px] font-extrabold leading-none tracking-[-.05em] sm:text-[44px]">Checkout</h1>
    <p className="mt-2 text-[14px] text-[#666]">{cart.length ? 'Check your cameras, add delivery details, then choose how to pay.' : 'Your cart is empty. Choose a camera to get started.'}</p></div></div>
    <div className={`${cart.length ? 'mx-auto mt-6 grid max-w-[680px] items-start gap-5 lg:mt-8 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8' : 'mx-auto mt-8 max-w-[700px]'}`}>
      <div className="order-1 lg:sticky lg:top-4 lg:order-2">
        <CartSummary cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} settings={settings} />
      </div>
      {cart.length > 0 && <div className="order-2 min-w-0 lg:order-1"><DemoCardCheckout key={String(settings.fictionalDemoMode)} cart={cart} clearCart={clearCart} onSubmitted={() => undefined} totalCents={totalCents} fictionalDemoMode={settings.fictionalDemoMode} settings={settings} /></div>}
    </div>
  </div><Footer settings={settings} /></main>;
}

function Footer({ settings }: { settings: StoreSettings }) {
  return <footer id="support" className="bg-[#252525] py-11 text-white"><div className="container-store grid gap-9 sm:grid-cols-[1.2fr_1fr_1fr]"><div><div className="text-[24px] font-extrabold tracking-[-.06em]">{settings.brandName}</div><p className="mt-3 max-w-[320px] text-[13px] leading-6 text-[#bbb]">{settings.trustDescription}</p>{settings.supportEmail && <a className="mt-3 inline-block text-[13px] text-[#ddd] hover:text-white" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>}</div><div><h2 className="text-[13px] font-bold">Explore</h2><div className="mt-3 grid gap-2 text-[13px] text-[#bbb]"><Link href="/" data-testid="link-footer-home" className="hover:text-white">Shop cameras</Link><Link href="/checkout" data-testid="link-footer-checkout" className="hover:text-white">Cart &amp; checkout</Link></div></div><div><h2 className="text-[13px] font-bold">Support</h2><p className="mt-3 text-[13px] leading-6 text-[#bbb]">Questions about your order? Get in touch with our team.</p>{settings.supportEmail && <a className="mt-2 inline-block text-[13px] text-[#ddd] hover:text-white" href={`mailto:${settings.supportEmail}`}>Contact support</a>}</div></div><div className="container-store mt-9 flex flex-wrap items-center justify-between gap-5 border-t border-[#555] pt-5"><span className="text-[11px] text-[#aaa]">© {settings.brandName}.</span><AcceptedCards location="footer" dark /></div></footer>;
}

export function Modern() {
  const [cart, setCart] = useState(() => [{ product: roadView, quantity: 1 }]);
  const updateQuantity = (id: number, amount: number) => setCart(items => items.flatMap(item => {
    if (item.product.id !== id) return [item];
    const nextQuantity = item.quantity + amount;
    return nextQuantity > 0 ? [{ ...item, quantity: Math.min(item.product.stock, nextQuantity) }] : [];
  }));
  const removeItem = (id: number) => setCart(items => items.filter(item => item.product.id !== id));
  return <div className="min-h-screen bg-white"><CheckoutPage cart={cart} updateQuantity={updateQuantity} removeItem={removeItem} clearCart={() => setCart([])} settings={settings} /></div>;
}