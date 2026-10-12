import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getGetStorefrontQueryKey, useGetStorefront, type Product } from '@workspace/api-client-react';
import { AdminAccess, SignInPage, SignUpPage, StoreClerkProvider } from '@/admin/Auth';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StoreLayout } from '@/components/store/StoreLayout';
import { RegionalAccessGate } from '@/components/RegionalAccessGate';
import { siblingsOf } from '@/lib-groups';
import { errorMessage, type CartLine } from '@/lib-store';
import NotFound from '@/pages/not-found';
import Home from '@/pages/Home';
import Category from '@/pages/Category';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import UnavailableLink from '@/pages/UnavailableLink';
import PrivateProduct from '@/pages/PrivateProduct';
import { AboutPage, ContactPage, PrivacyPage, ShippingReturnsPage, TermsPage } from '@/pages/info/InfoPages';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { useState } from 'react';

const CART_STORAGE_KEY = 'driveguard-cart-v1';
const queryClient = new QueryClient();
const readCart = (): CartLine[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((line): line is CartLine => Boolean(line && Number.isInteger(line.productId) && line.productId > 0 && Number.isInteger(line.quantity) && line.quantity > 0));
  } catch {
    return [];
  }
};

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Store({ cart, add, updateQuantity, removeItem, clearCart }: { cart: CartLine[]; add: (product: Product, quantity: number) => void; updateQuantity: (id: number, amount: number) => void; removeItem: (id: number) => void; clearCart: () => void }) {
  const [location, navigate] = useLocation();
  const directCheckoutRef = useRef(false);
  const storefront = useGetStorefront({ query: { queryKey: getGetStorefrontQueryKey(), refetchInterval: 5000 } });
  const products = storefront.data?.products.filter(product => product.active) ?? [];
  const settings = storefront.data?.settings;
  useEffect(() => {
    if (location === '/checkout' && directCheckoutRef.current) {
      directCheckoutRef.current = false;
      const frame = window.requestAnimationFrame(() => {
        document.getElementById('checkout-start')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
    return undefined;
  }, [location]);
  const buyNow = (product: Product, quantity: number) => {
    if (product.stock < 1) return;
    add(product, quantity);
    directCheckoutRef.current = true;
    navigate('/checkout');
  };
  useEffect(() => {
    if (storefront.isSuccess) {
      const availableIds = new Set(products.map(product => product.id));
      cart.forEach(line => { if (!availableIds.has(line.productId)) removeItem(line.productId); });
    }
  }, [storefront.isSuccess, storefront.data, cart, removeItem]);
  if (storefront.isError) return <div className="min-h-screen bg-background"><div className="container-store py-24 text-center"><h1 className="text-2xl font-extrabold">Store unavailable</h1><p className="mt-3 text-[#666]" role="alert">We couldn’t load the store data: {errorMessage(storefront.error)}</p><button type="button" onClick={() => void storefront.refetch()} className="btn mt-6">Try again</button></div></div>;
  if (storefront.isPending || !settings) return <div className="min-h-screen bg-background"><div className="container-store py-24 text-center" role="status">Loading {storefront.data?.settings.brandName ?? 'store'}…</div></div>;
  const cartProducts = cart.flatMap(line => {
    const product = products.find(item => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return <StoreLayout products={products} settings={settings} cartCount={cartCount}><RoutedErrorBoundary><Switch>
    <Route path="/"><Home products={products} settings={settings} cart={cart} onAdd={add} /></Route>
    <Route path="/category/:slug"><Category products={products} cart={cart} onAdd={add} /></Route>
    <Route path="/product/:slug">{params => {
      const product = products.find(item => item.slug === params.slug);
      return product ? <ProductDetail product={product} siblings={siblingsOf(product, products)} settings={settings} onAdd={add} onBuy={buyNow} /> : <NotFound />;
    }}</Route>
    <Route path="/cart"><Cart cart={cartProducts} settings={settings} updateQuantity={updateQuantity} removeItem={removeItem} /></Route>
    <Route path="/checkout"><Checkout cart={cartProducts} updateQuantity={updateQuantity} removeItem={removeItem} clearCart={clearCart} settings={settings} /></Route>
    <Route path="/about"><AboutPage settings={settings} /></Route>
    <Route path="/contact"><ContactPage settings={settings} /></Route>
    <Route path="/shipping-returns"><ShippingReturnsPage settings={settings} /></Route>
    <Route path="/privacy"><PrivacyPage settings={settings} /></Route>
    <Route path="/terms"><TermsPage settings={settings} /></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary></StoreLayout>;
}

function App() {
  const [cart, setCart] = useState<CartLine[]>(readCart);
  useEffect(() => { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }, [cart]);
  const add = (product: Product, quantity: number) => setCart(items => {
    const found = items.find(item => item.productId === product.id);
    const nextQuantity = Math.min(product.stock, (found?.quantity ?? 0) + quantity);
    return found ? items.map(item => item.productId === product.id ? { ...item, quantity: nextQuantity } : item) : [...items, { productId: product.id, quantity: nextQuantity }];
  });
  const updateQuantity = (id: number, amount: number) => setCart(items => items.flatMap(item => item.productId === id ? (item.quantity + amount > 0 ? [{ ...item, quantity: item.quantity + amount }] : []) : [item]));
  const removeItem = (id: number) => setCart(items => items.filter(item => item.productId !== id));
  const clearCart = () => setCart([]);
  return <QueryClientProvider client={queryClient}><RegionalAccessGate><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><StoreClerkProvider><Switch>
    <Route path="/admin" component={AdminAccess} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/shipping-simulation/:token" component={UnavailableLink} />
    <Route path="/private-product/:token" component={PrivateProduct} />
    <Route><Store cart={cart} add={add} updateQuantity={updateQuantity} removeItem={removeItem} clearCart={clearCart} /></Route>
  </Switch></StoreClerkProvider></WouterRouter><Toaster /></TooltipProvider></RegionalAccessGate></QueryClientProvider>;
}

export default App;