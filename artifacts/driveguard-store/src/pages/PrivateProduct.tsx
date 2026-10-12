import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useParams } from 'wouter';
import {
  getGetPrivatePaymentQueryKey,
  getGetPrivateProductQueryKey,
  useCreatePrivateCheckout,
  useGetPrivatePayment,
  useGetPrivateProduct,
} from '@workspace/api-client-react';
import { ArrowRight, Check, CircleAlert, Clock, Lock, RefreshCw, X } from 'lucide-react';
import './PrivateProduct.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const MAX_POLLS = 10;

function usePrivateMeta() {
  useEffect(() => {
    const set = (name: string, content: string) => {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (existing) { const previous = existing.content; existing.content = content; return () => { existing.content = previous; }; }
      const meta = document.createElement('meta');
      meta.name = name; meta.content = content; document.head.appendChild(meta);
      return () => meta.remove();
    };
    const restores = [set('robots', 'noindex, nofollow, noarchive'), set('referrer', 'no-referrer')];
    return () => restores.forEach(restore => restore());
  }, []);
}

const isStripeCheckout = (value: string) => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com'; } catch { return false; }
};

function Shell({ children, brand, test }: { children: ReactNode; brand?: string; test?: boolean }) {
  return <main className="pp-shell" data-testid="page-private-product"><div className="pp-card">
    <p className="pp-brand"><span data-testid="text-private-brand">{brand ?? 'Private offer'}</span>{test && <span className="pp-test" data-testid="status-private-test-mode">Stripe test mode</span>}</p>
    {children}
  </div></main>;
}

function PaymentResult({ token, sessionId, onBack }: { token: string; sessionId: string; onBack: () => void }) {
  const [polls, setPolls] = useState(0);
  const payment = useGetPrivatePayment(token, sessionId, { query: {
    queryKey: getGetPrivatePaymentQueryKey(token, sessionId), retry: 1,
    refetchInterval: query => query.state.data?.status === 'processing' && polls < MAX_POLLS ? 2000 : false,
  } });
  const status = payment.data?.status;
  const updatedAt = payment.dataUpdatedAt;
  useEffect(() => { if (status === 'processing') setPolls(count => count + 1); }, [status, updatedAt]);

  if (payment.isPending) return <><div className="pp-sk" style={{ height: 44, width: 44, borderRadius: '50%', marginBottom: 18 }} /><div className="pp-sk" style={{ height: 26, width: '70%' }} /><p className="pp-text" role="status">Confirming your payment with Stripe…</p></>;
  if (payment.isError || !payment.data) return <><span className="pp-state-icon bad"><CircleAlert size={20} /></span><h1 className="pp-name">We could not confirm this payment yet</h1>
    <p className="pp-text" role="alert" data-testid="status-private-payment-error">Your payment status is unknown right now. Please do not pay again until you have checked.</p>
    <button type="button" className="pp-pay" onClick={() => void payment.refetch()} disabled={payment.isFetching} data-testid="button-private-payment-retry"><RefreshCw size={16} className={payment.isFetching ? 'pp-spin' : ''} /> Check again</button></>;
  const p = payment.data;
  const amount = p.amountCents == null ? null : money(p.amountCents);
  if (p.status === 'paid') return <><span className="pp-state-icon ok"><Check size={22} /></span><p className="pp-label">Payment received</p>
    <h1 className="pp-name" data-testid="text-private-paid-name">{p.productName}</h1>
    {amount && <p className="pp-price" data-testid="text-private-paid-amount">{amount}<small>USD</small></p>}
    <p className="pp-text" data-testid="status-private-payment-paid">Thank you. Stripe has confirmed your payment and the store has been notified. Your receipt comes from Stripe by email.</p></>;
  if (p.status === 'processing') return <><span className="pp-state-icon"><Clock size={20} className={polls < MAX_POLLS ? 'pp-spin' : ''} /></span><h1 className="pp-name">Payment processing</h1>
    <p className="pp-text" role="status" data-testid="status-private-payment-processing">{polls < MAX_POLLS ? 'Stripe is still confirming your payment. This page updates on its own.' : 'This is taking longer than usual. You do not need to pay again; check back in a moment.'}</p>
    {polls >= MAX_POLLS && <button type="button" className="pp-pay" onClick={() => { setPolls(0); void payment.refetch(); }} data-testid="button-private-payment-recheck"><RefreshCw size={16} /> Check again</button>}</>;
  return <><span className="pp-state-icon bad"><X size={20} /></span>
    <h1 className="pp-name">{p.status === 'expired' ? 'Checkout expired' : 'Payment not completed'}</h1>
    <p className="pp-text" data-testid={`status-private-payment-${p.status}`}>No payment was taken for {p.productName}. {p.status === 'expired' ? 'That checkout session timed out.' : 'The checkout was left before paying.'}</p>
    <button type="button" className="pp-pay" onClick={onBack} data-testid="button-private-payment-back">Return to offer <ArrowRight size={16} /></button></>;
}

export default function PrivateProduct() {
  usePrivateMeta();
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search));
  const sessionId = search.get('session_id') ?? '';
  const cancelled = search.has('cancelled') || search.has('canceled');
  const product = useGetPrivateProduct(token, { query: { queryKey: getGetPrivateProductQueryKey(token), enabled: !!token && !sessionId, retry: 1 } });
  const checkout = useCreatePrivateCheckout();
  const requestId = useRef<string>(crypto.randomUUID());
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const clearQuery = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setSearch(new URLSearchParams());
  };

  const pay = async () => {
    setError('');
    try {
      const result = await checkout.mutateAsync({ token, data: { requestId: requestId.current } });
      if (!isStripeCheckout(result.url)) { setError('The payment page address was not recognised, so we stopped for your safety. Please try again.'); return; }
      requestId.current = crypto.randomUUID();
      setRedirecting(true);
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? `Could not open payment: ${reason.message}` : 'Could not open payment. Please try again.');
    }
  };

  if (sessionId) return <Shell><PaymentResult token={token} sessionId={sessionId} onBack={clearQuery} /></Shell>;
  if (product.isPending) return <Shell><div role="status" aria-label="Loading offer"><div className="pp-sk" style={{ height: 14, width: '30%', marginBottom: 14 }} /><div className="pp-sk" style={{ height: 30, width: '80%' }} /><div className="pp-sk" style={{ height: 36, width: '40%', marginTop: 20 }} /><div className="pp-sk" style={{ height: 50, marginTop: 28 }} /></div></Shell>;
  if (product.isError || !product.data) {
    const status = (product.error as { status?: number } | null)?.status;
    const missing = status === 404 || status === 410;
    return <Shell><span className="pp-state-icon bad"><CircleAlert size={20} /></span><h1 className="pp-name">{missing ? 'This offer is unavailable' : 'We could not load this offer'}</h1>
      <p className="pp-text" data-testid="status-private-unavailable">{missing ? 'The link may have been archived or mistyped. Ask the store for a new link.' : 'Check your connection and try again.'}</p>
      {!missing && <button type="button" className="pp-pay" onClick={() => void product.refetch()} data-testid="button-private-retry"><RefreshCw size={16} /> Try again</button>}</Shell>;
  }
  const offer = product.data;
  if (!offer.active) return <Shell brand={offer.brandName} test={!offer.livemode}><span className="pp-state-icon"><Clock size={20} /></span><h1 className="pp-name">{offer.name}</h1>
    <p className="pp-text" data-testid="status-private-paused">This offer is not accepting payments right now. Please check with the store.</p></Shell>;
  const busy = checkout.isPending || redirecting;
  return <Shell brand={offer.brandName} test={!offer.livemode}>
    {cancelled && <p className="pp-note" data-testid="status-private-cancelled" style={{ marginTop: 0, marginBottom: 20 }}>You returned from checkout. You can try again below.</p>}
    <p className="pp-label">A private offer for you</p>
    <h1 className="pp-name" data-testid="text-private-product-name">{offer.name}</h1>
    <p className="pp-price" data-testid="text-private-product-price">{money(offer.priceCents)}<small>USD</small></p>
    {offer.collectDelivery && <p className="pp-note" data-testid="text-private-delivery-note">Stripe will ask for your delivery address during payment so the store can send your order.</p>}
    {error && <p className="pp-error" role="alert" data-testid="status-private-checkout-error">{error}</p>}
    <button type="button" className="pp-pay" onClick={() => void pay()} disabled={busy} data-testid="button-private-pay">
      {busy ? <><RefreshCw size={16} className="pp-spin" /> Opening Stripe…</> : <><Lock size={15} /> {error ? 'Try again' : `Pay ${money(offer.priceCents)} with Stripe`}</>}
    </button>
    <p className="pp-fine">You will be taken to Stripe's secure checkout. This page never asks for card details.</p>
  </Shell>;
}
