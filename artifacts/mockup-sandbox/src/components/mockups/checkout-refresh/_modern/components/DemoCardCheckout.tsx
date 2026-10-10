import { type FormEvent, useEffect, useRef, useState } from 'react';
import { cancelDemoOrder, checkDemoOrderVerification, chooseDemoVerificationMethod, sendDeliveryAlert, submitDemoVerificationCode, useCreateDemoOrder, useSaveDemoDraft } from '../stubs';
import type { DemoCheckoutDraftInput, OrderAddress, Product, StoreSettings } from '../types';
import { ArrowLeft, ArrowRight, Check, CircleX, CreditCard, LockKeyhole, Pencil } from 'lucide-react';
import { TestVerificationScreen } from './TestVerificationScreen';
import { CheckoutAddressFields, emptyAddress } from './CheckoutAddressFields';
import { CheckoutBillingFields } from './CheckoutBillingFields';
import { AcceptedCards, CardBrandLogo, detectCardBrand } from './AcceptedCards';
import { CheckoutPaymentMethod } from './CheckoutPaymentMethod';
import { CheckoutProgress, type CheckoutStep } from './CheckoutProgress';

type DemoBrand = 'visa' | 'mastercard';
type CardType = 'credit' | 'debit';
type PendingVerification = { id: number; draftId: string; last4: string; totalCents: number; cardType: CardType; createdAt?: string };
const pendingKey = 'driveguard-pending-test-verification';
function forgetPending() {
  try { sessionStorage.removeItem(pendingKey); } catch { /* In-memory flow still works. */ }
}
function restorePending(): PendingVerification | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
    return saved && Number.isInteger(saved.id) && saved.id > 0 &&
      typeof saved.draftId === 'string' && /^[0-9a-f-]{36}$/i.test(saved.draftId) &&
      typeof saved.last4 === 'string' && /^\d{4}$/.test(saved.last4) &&
      Number.isSafeInteger(saved.totalCents) && (saved.cardType === 'credit' || saved.cardType === 'debit') ? saved : null;
  } catch { return null; }
}
const fieldClass = 'mt-2 block h-[52px] w-full rounded-xl border border-[#d5dbe3] bg-[#fafbfc] px-3.5 text-[16px] text-[#17212f] outline-none transition placeholder:text-[#9aa4b2] focus:border-[#c92525] focus:bg-white focus:ring-[3px] focus:ring-[#c92525]/10 sm:text-[15px]';
function previewStep(): CheckoutStep {
  if (typeof window === 'undefined') return 'delivery';
  const requested = new URLSearchParams(window.location.search).get('step');
  return requested === 'delivery' || requested === 'method' || requested === 'payment' ? requested : 'delivery';
}
const validName = (name: string) => /^[\p{L}\p{M}\p{N} .'-]+$/u.test(name.trim()) && name.trim().length <= 80;
const formatNumber = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const validNumber = (number: string) => /^\d{13,19}$/.test(number.replace(/\s/g, ''));
const validExpiry = (expiry: string) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
const validCvc = (cvc: string) => /^\d{3,4}$/.test(cvc);
const validPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return /^[+()\d.\s-]+$/.test(phone) &&
    (digits.length === 10 || (digits.length === 11 && digits.startsWith('1')));
};

function CheckoutTransition({ title, description, testId }: { title: string; description: string; testId: string }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#f8f9fa]/95 px-6 text-center backdrop-blur-sm" role="status" aria-live="polite" data-testid={testId}>
    <div className="flex w-full max-w-[320px] flex-col items-center rounded-xl border border-[#e4e8ed] bg-white px-6 py-10 shadow-[0_20px_70px_-35px_rgba(28,37,50,.38)]">
      <div className="relative grid h-16 w-16 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-[3px] border-[#e3e8ed]" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-[#c92525] border-t-[#c92525] [animation-duration:700ms] motion-reduce:animate-none" />
        <span className="h-8 w-8 rounded-full border border-[#eef0f2] bg-white" />
      </div>
      <p className="mt-7 text-[17px] font-bold tracking-[-.025em] text-[#263241]">{title}</p>
      <p className="mt-1.5 text-[13px] text-[#637082]">{description}</p>
    </div>
  </div>;
}

function BrandLogo({ brand, small = false }: { brand: DemoBrand; small?: boolean }) {
  return brand === 'visa'
    ? <svg viewBox="0 0 24 24" width={small ? 34 : 40} height="26" fill="#1A1F71" aria-label="Visa" role="img"><path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"/></svg>
    : <svg viewBox="0 0 44 28" width={small ? 36 : 41} height="26" aria-label="Mastercard" role="img"><circle cx="17" cy="14" r="11" fill="#EB001B"/><circle cx="27" cy="14" r="11" fill="#F79E1B"/><path d="M22 4.2a11 11 0 010 19.6 11 11 0 010-19.6" fill="#FF5F00"/></svg>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function DemoCardCheckout({
  cart, clearCart, onSubmitted, totalCents, fictionalDemoMode, settings,
}: {
  cart: { product: Product; quantity: number }[];
  clearCart: () => void;
  onSubmitted: (type: CardType) => void;
  totalCents: number;
  fictionalDemoMode: boolean;
  settings: StoreSettings;
}) {
  const requestedStep = previewStep();
  const paymentScreenshot = requestedStep === 'payment';
  const [cardType, setCardType] = useState<CardType>('credit');
  const [demoName, setDemoName] = useState('');
  const [demoNumber, setDemoNumber] = useState('');
  const [demoExpiry, setDemoExpiry] = useState('');
  const [demoCvc, setDemoCvc] = useState('');
  const [shippingAddress, setShippingAddress] = useState<OrderAddress>(() => paymentScreenshot ? {
    ...emptyAddress(), fullName: 'Test Shopper', line1: '123 Test Street', city: 'Seattle', region: 'WA', postalCode: '98101',
  } : emptyAddress());
  const [billingAddress, setBillingAddress] = useState<OrderAddress>(emptyAddress);
  const [billingStarted, setBillingStarted] = useState(false);
  const [step, setStep] = useState<CheckoutStep>(requestedStep);
  const [cardSelected, setCardSelected] = useState(false);
  const [transitioningToPayment, setTransitioningToPayment] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [contactEmail, setContactEmail] = useState(() => paymentScreenshot ? 'test@example.com' : '');
  const [contactPhone, setContactPhone] = useState(() => paymentScreenshot ? '(206) 555-0101' : '');
  const [draftError, setDraftError] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [previewComplete, setPreviewComplete] = useState(false);
  const [verificationState, setVerificationState] = useState<'waiting' | 'requested' | 'method_selected' | 'code_ready' | 'code_submitted' | 'invalid_code' | 'approved'>('waiting');
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'phone' | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [pollError, setPollError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [declineVisible, setDeclineVisible] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const checkoutRef = useRef<HTMLElement>(null);
  const previousStepRef = useRef(step);
  const declineRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef<DemoCheckoutDraftInput['completedFields']>([]);
  const pendingDraft = useRef<Promise<unknown>>(Promise.resolve());
  const draftSequence = useRef(0);
  const placingOrderRef = useRef(false);
  const deliveryAlertSentRef = useRef(false);
  const stepTransitionTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (stepTransitionTimer.current !== null) window.clearTimeout(stepTransitionTimer.current);
  }, []);
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    const frame = window.requestAnimationFrame(() => checkoutRef.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }));
    return () => window.cancelAnimationFrame(frame);
  }, [step]);
  const order = useCreateDemoOrder();
  const saveDemoDraft = useSaveDemoDraft();
  const stopWaiting = (message: string) => {
    forgetPending();
    setPending(null);
    setVerificationState('waiting');
    setVerificationMethod(null);
    setVerificationCode('');
    setVerificationError('');
    setPollError('');
    setDemoName('');
    setDemoNumber('');
    setDemoExpiry('');
    setDemoCvc('');
    setShippingAddress(emptyAddress());
    setBillingAddress(emptyAddress());
    setBillingStarted(false);
    setContactEmail('');
    setContactPhone('');
    setCardSelected(false);
    setStep('delivery');
    completedRef.current = [];
    setDraftId(crypto.randomUUID());
    deliveryAlertSentRef.current = false;
    setFormError(message);
  };
  const cancelPendingOrder = async () => {
    if (!pending || cancelling) return;
    setCancelling(true);
    setPollError('');
    try {
      await cancelDemoOrder(pending.id, { draftId: pending.draftId });
      forgetPending();
      setPending(null);
      setVerificationState('waiting');
      setVerificationMethod(null);
      setVerificationCode('');
      setVerificationError('');
      completedRef.current = [];
      setDraftId(crypto.randomUUID());
      setStep('payment');
      setFormError('Order cancelled. Your billing details are still here.');
    } catch (error) {
      setPollError(`Couldn’t cancel this order: ${errorMessage(error)}`);
    } finally {
      setCancelling(false);
    }
  };
  useEffect(() => {
    if (!declineVisible) return;
    declineRef.current?.focus();
    const timeout = window.setTimeout(() => setDeclineVisible(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [declineVisible]);
  useEffect(() => {
    if (!pending || verificationState === 'approved') return;
    let active = true;
    let inFlight = false;
    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await checkDemoOrderVerification(pending.id, { draftId: pending.draftId });
        if (!active) return;
        setPollError('');
        if (result.state === 'requested' || result.state === 'method_selected' || result.state === 'code_ready' || result.state === 'code_submitted' || result.state === 'invalid_code' || result.state === 'approved') {
          setVerificationState(result.state);
          if (result.method) setVerificationMethod(result.method);
          if (result.state === 'invalid_code' && verificationState !== 'invalid_code') {
            setVerificationError('Invalid OTP. Please try again.');
            setVerificationCode('');
          }
        }
        if (result.state === 'cancelled') {
          forgetPending();
          setPending(null);
          setVerificationState('waiting');
          setFormError('This order was cancelled. Please try again.');
        }
        if (result.state === 'declined') {
          forgetPending();
          setPending(null);
          setVerificationState('waiting');
          setVerificationMethod(null);
          setVerificationCode('');
          setVerificationError('');
          setFormError('Your payment was declined. Please check your details and try again.');
          setStep('payment');
          setDeclineVisible(true);
        }
      } catch (error) {
        if (!active) return;
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          stopWaiting('This order is no longer available. Please try again.');
        } else {
          setPollError('Connection interrupted. Reconnecting…');
        }
      } finally { inFlight = false; }
    };
    void check();
    const interval = window.setInterval(() => void check(), 1500);
    return () => { active = false; window.clearInterval(interval); };
  }, [pending, verificationState]);

  const chooseMethod = async (method: 'email' | 'phone') => {
    if (!pending || verificationBusy) return;
    setVerificationBusy(true);
    setVerificationError('');
    try {
      const result = await chooseDemoVerificationMethod(pending.id, { draftId: pending.draftId, method });
      setVerificationMethod(result.method);
      setVerificationState('method_selected');
    } catch {
      setVerificationError('We couldn’t open verification. Please try again.');
    } finally { setVerificationBusy(false); }
  };
  const submitCode = async () => {
    if (!pending || verificationBusy) return;
    if (!/^\d{6}$/.test(verificationCode)) {
      setVerificationError('Enter the six-digit code.');
      return;
    }
    setVerificationBusy(true);
    setVerificationError('');
    try {
      await submitDemoVerificationCode(pending.id, { draftId: pending.draftId, code: verificationCode });
      setVerificationCode('');
      setVerificationState('code_submitted');
    } catch {
      setVerificationError('Could not submit your code. Please try again.');
    } finally { setVerificationBusy(false); }
  };

  const queueDraft = (name: string, type: CardType, completedFields: DemoCheckoutDraftInput['completedFields'], testDetails?: { demoCardNumber?: string; demoExpiry?: string; demoCvc?: string }) => {
    const sequence = ++draftSequence.current;
    setDraftError('');
    pendingDraft.current = pendingDraft.current.catch(() => {}).then(() => saveDemoDraft.mutateAsync({
      id: draftId, data: {
        displayName: validName(name) ? name.trim() : '', cardType: type, completedFields, ...testDetails,
        ...(billingStarted ? { billingAddress: { ...billingAddress, fullName: validName(name) ? name.trim() : '' } } : {}),
      },
    }));
    void pendingDraft.current.catch(() => {
      if (sequence === draftSequence.current) setDraftError('Order preview is temporarily unavailable. You can still place your order.');
    });
  };
  useEffect(() => {
    if (pending || !fictionalDemoMode || (!demoName && !demoNumber && !demoExpiry && !demoCvc && !billingStarted)) return;
    const timeout = window.setTimeout(() => {
      const fields: DemoCheckoutDraftInput['completedFields'] = [
        ...(validName(demoName) ? ['name' as const] : []),
        ...(validNumber(demoNumber) ? ['number' as const] : []),
        ...(validExpiry(demoExpiry) ? ['expiry' as const] : []),
        ...(validCvc(demoCvc) ? ['cvc' as const] : []),
      ];
      queueDraft(demoName, cardType, fields, {
        ...(demoNumber ? { demoCardNumber: demoNumber } : {}),
        ...(demoExpiry ? { demoExpiry } : {}),
        ...(demoCvc ? { demoCvc } : {}),
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [pending, fictionalDemoMode, demoName, demoNumber, demoExpiry, demoCvc, cardType, billingAddress, billingStarted]);
  useEffect(() => {
    if (pending || fictionalDemoMode || !billingStarted) return;
    const timeout = window.setTimeout(() => queueDraft(demoName, cardType, completedRef.current), 250);
    return () => window.clearTimeout(timeout);
  }, [pending, fictionalDemoMode, billingAddress, billingStarted, demoName, cardType]);
  const completeField = (field: DemoCheckoutDraftInput['completedFields'][number], valid: boolean) => {
    if (fictionalDemoMode) return;
    const hadCompletedField = completedRef.current.length > 0;
    const next = completedRef.current.filter(item => item !== field);
    if (valid) next.push(field);
    completedRef.current = next;
    if (next.length || hadCompletedField) queueDraft(demoName, cardType, next);
  };
  const alertDeliveryStarted = (hasText: boolean) => {
    if (!hasText || !cart.length || pending || deliveryAlertSentRef.current) return;
    deliveryAlertSentRef.current = true;
    // Alert failures are logged by the API and must not interrupt checkout.
    void sendDeliveryAlert({ draftId }).catch(() => {});
  };
  const updateShippingAddress = (value: OrderAddress) => {
    setShippingAddress(value);
    alertDeliveryStarted(Boolean(
      value.fullName.trim() || value.line1.trim() || value.line2.trim() ||
      value.city.trim() || value.region.trim() || value.postalCode.trim(),
    ));
  };
  const continueToPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (transitioningToPayment || !cart.length || cart.some(line => line.quantity > line.product.stock)) return;
    if (!validPhone(contactPhone.trim())) {
      setFormError('Enter a valid US or Canadian 10-digit phone number.');
      return;
    }
    setFormError('');
    setTransitioningToPayment(true);
    stepTransitionTimer.current = window.setTimeout(() => {
      stepTransitionTimer.current = null;
      setStep('method');
      setTransitioningToPayment(false);
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 850);
  };
  const editDelivery = () => {
    setFormError('');
    setStep('delivery');
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (placingOrderRef.current || order.isPending) return;
    if (!cart.length || cart.some(line => line.product.stock < line.quantity)) return;
    if (!contactEmail.trim() || !contactPhone.trim()) {
      setFormError('Complete your contact details before placing your order.');
      setStep('delivery');
      return;
    }
    if (!validName(demoName) || !validNumber(demoNumber) || !validExpiry(demoExpiry) || !validCvc(demoCvc)) {
      setFormError('Enter a name, 13–19 card digits, an MM/YY expiry, and a 3–4 digit CVC.');
      return;
    }
    setFormError('');
    setFormError('');
    setPreviewComplete(true);
  };
  const stockError = cart.some(line => line.quantity > line.product.stock);
  const displayedBrand = detectCardBrand(demoNumber);
  const deliverySummary = `${shippingAddress.line1}${shippingAddress.line2 ? `, ${shippingAddress.line2}` : ''}, ${shippingAddress.city}, ${shippingAddress.region} ${shippingAddress.postalCode}, ${shippingAddress.country === 'CA' ? 'Canada' : 'United States'}`;

  if (previewComplete) return <section className="rounded-2xl border border-[#dde1e6] border-t-4 border-t-[#c92525] bg-white p-7 text-center shadow-[0_24px_60px_-36px_rgba(28,37,50,.45)] sm:p-9" data-testid="status-local-preview-complete">
    <Check size={34} className="mx-auto text-[#4e6a3b]" aria-hidden="true" />
    <h2 className="mt-4 text-[22px] font-extrabold text-[#1c2734]">Checkout preview complete</h2>
    <p className="mt-2 text-[13px] leading-6 text-[#637082]">This is a local design preview. No order was placed and no payment information was sent.</p>
    <button type="button" onClick={() => setPreviewComplete(false)} className="mt-5 min-h-11 px-4 text-[13px] font-semibold text-[#a62020] hover:underline" data-testid="button-return-to-checkout">Return to checkout</button>
  </section>;

  if (declineVisible) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17212f]/75 px-5 py-8" data-testid="screen-order-declined">
    <div ref={declineRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="decline-title" aria-describedby="decline-description" onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); }} className="w-full max-w-md rounded-xl bg-white px-7 py-10 text-center shadow-2xl outline-none sm:px-10">
      <CircleX size={52} className="mx-auto text-[#c92525]" aria-hidden="true" />
      <h2 id="decline-title" className="mt-5 text-[26px] font-bold text-[#1c2734]">Your payment was declined</h2>
      <p id="decline-description" className="mt-3 text-[14px] leading-6 text-[#637082]">Please check your payment details and try again.</p>
      <p className="mt-5 text-[12px] font-medium text-[#637082]">Returning to checkout in 3 seconds…</p>
    </div>
  </div>;
  if (pending && verificationState !== 'waiting') return <TestVerificationScreen orderId={pending.id} cardLast4={pending.last4} totalCents={pending.totalCents} orderCreatedAt={pending.createdAt}
    brandName={settings.brandName} appearance={settings}
    method={verificationMethod} code={verificationCode}
    phase={verificationState === 'approved' ? 'approved' : verificationState === 'code_submitted' || verificationState === 'method_selected' ? 'waiting' : verificationState === 'code_ready' || verificationState === 'invalid_code' ? 'enter' : 'choose'}
    waitingForCode={verificationState === 'method_selected'}
    busy={verificationBusy} error={verificationError}
    onChoose={method => void chooseMethod(method)}
    onCodeChange={code => { setVerificationCode(code.replace(/\D/g, '').slice(0, 6)); setVerificationError(''); }}
    onSubmit={() => void submitCode()} onContinue={() => {
    forgetPending();
    setPending(null);
    clearCart();
    onSubmitted(pending.cardType);
  }} />;
  if (pending) return <section className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#f8f9fa] px-5 py-8 text-center" role="status" aria-live="polite" data-testid="status-waiting-for-admin">
    <div className="flex w-full max-w-[380px] flex-col items-center rounded-xl border border-[#e4e8ed] bg-white px-7 py-10 shadow-[0_20px_70px_-35px_rgba(28,37,50,.38)]">
      <div className="relative grid h-16 w-16 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-[3px] border-[#e3e8ed]" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-[#c92525] border-t-[#c92525] [animation-duration:700ms] motion-reduce:animate-none" />
        <LockKeyhole size={19} className="text-[#536172]" />
      </div>
      <h2 className="mt-7 text-[19px] font-bold tracking-[-.025em] text-[#263241]">Waiting for verification</h2>
      <p className="mt-2 text-[13px] leading-5 text-[#637082]">Keep this page open. The next step will appear here when it’s ready.</p>
      <p className="mt-4 text-[12px] font-medium text-[#798594]">Order #{pending.id}</p>
      {pollError && <p className="mt-4 text-[12px] text-[#a61c1c]">{pollError}</p>}
      <button type="button" disabled={cancelling} className="mt-6 min-h-11 rounded-lg border border-[#d5dbe3] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#263241] hover:bg-[#f5f6f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c92525] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void cancelPendingOrder()} data-testid="button-cancel-order">
        {cancelling ? 'Cancelling…' : 'Cancel'}
      </button>
    </div>
  </section>;

  return <section id="checkout-start" ref={checkoutRef} style={{ borderTopColor: '#c92525' }} className="scroll-mt-4 overflow-hidden rounded-2xl border border-[#dde1e6] border-t-4 bg-white shadow-[0_24px_60px_-36px_rgba(28,37,50,.45)]" data-testid="panel-demo-card-checkout">
    <header className="border-b border-[#e9edf0] bg-[linear-gradient(180deg,#fbf6f5,#fff)] px-5 pb-6 pt-6 sm:px-8 sm:pt-8">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#a62020]"><LockKeyhole size={13} aria-hidden="true" /> Secure checkout</div>
      <h2 className="mt-2 text-[27px] font-extrabold tracking-[-.045em] text-[#1c2734] sm:text-[32px]">{transitioningToPayment ? 'Just a moment.' : step === 'method' ? 'How would you like to pay?' : step === 'delivery' ? 'Where should it go?' : 'Almost there.'}</h2>
      <p className="mt-1.5 text-[14px] leading-5 text-[#637082]">{transitioningToPayment ? 'Opening your payment options.' : step === 'method' ? 'Choose a payment method, then click Next.' : step === 'delivery' ? 'Add your contact and delivery details.' : 'Review your delivery and complete your local preview.'}</p>
      <CheckoutProgress step={step} />
    </header>
    {placingOrder && <CheckoutTransition title={fictionalDemoMode ? 'Connecting to verification' : 'Completing your order'} description="Please keep this page open while we prepare the next step." testId="status-placing-order" />}
    {transitioningToPayment ? <CheckoutTransition title="Opening payment options" description="Your delivery details are ready." testId="status-opening-payment" /> : step === 'method' ? <CheckoutPaymentMethod selected={cardSelected} onSelect={() => setCardSelected(true)} onContinue={() => { setFormError(''); setStep('payment'); }} onBack={editDelivery} unavailable={!cart.length || stockError} /> : step === 'delivery' ? <form onSubmit={continueToPayment} autoComplete="on" className="space-y-7 px-5 py-7 sm:px-8 sm:py-8" data-testid="form-delivery">
      <div>
        <div className="mb-4 flex items-baseline justify-between gap-3"><h3 className="text-[18px] font-extrabold tracking-[-.03em] text-[#1c2734]">Contact details</h3><span className="text-[11px] text-[#818b97]">For order updates</span></div>
        <div className="grid gap-4 min-[480px]:grid-cols-2">
          <label className="block text-[13px] font-semibold text-[#344255]">Email address<input type="email" required maxLength={254} autoComplete="email" value={contactEmail} onChange={event => { setContactEmail(event.target.value); alertDeliveryStarted(Boolean(event.target.value.trim())); }} className={fieldClass} data-testid="input-contact-email" placeholder="you@example.com" /></label>
          <label className="block text-[13px] font-semibold text-[#344255]">Phone number<input type="tel" required maxLength={30} inputMode="tel" autoComplete="tel" value={contactPhone} onChange={event => { setContactPhone(event.target.value); setFormError(''); alertDeliveryStarted(Boolean(event.target.value.trim())); }} className={fieldClass} data-testid="input-contact-phone" placeholder="(555) 123-4567" /></label>
        </div>
        {formError && <p role="alert" className="mt-3 text-[12px] font-semibold text-[#a61c1c]">{formError}</p>}
      </div>
      <div className="border-t border-[#e9edf0] pt-6">
        <h3 className="mb-4 text-[18px] font-extrabold tracking-[-.03em] text-[#1c2734]">Shipping address</h3>
        <CheckoutAddressFields kind="shipping" value={shippingAddress} onChange={updateShippingAddress} />
      </div>
      {stockError && <p role="alert" className="text-[12px] text-[#a61c1c]">One or more items exceed current availability. Update your cart before checkout.</p>}
      <button type="submit" disabled={!cart.length || stockError} className="red-button red-button--wide" data-testid="button-continue-payment"><span>Continue to payment</span><ArrowRight size={18} aria-hidden="true" /></button>
    </form> : <form onSubmit={submit} autoComplete="on" inert={placingOrder} className="space-y-6 px-5 py-7 sm:px-8 sm:py-8" data-testid="form-payment">
      <div className="rounded-2xl border border-[#e1e5e9] bg-[#f6f7f9] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8a949f]">Delivering to</p>
            <p className="mt-2 text-[14px] font-bold text-[#263241]" data-testid="text-delivery-name">{shippingAddress.fullName}</p>
            <p className="mt-0.5 text-[12px] leading-5 text-[#637082]" data-testid="text-delivery-address">{deliverySummary}</p>
            <p className="mt-2 break-words text-[12px] text-[#637082]" data-testid="text-delivery-contact">{contactEmail} · {contactPhone}</p>
          </div>
          <button type="button" onClick={editDelivery} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-bold text-[#b52121] hover:text-[#861717] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c92525]" data-testid="button-edit-delivery"><Pencil size={13} aria-hidden="true" /> Edit</button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[540px] space-y-4">
        <h3 className="text-[18px] font-extrabold tracking-[-.03em] text-[#1c2734]">Credit or debit card</h3>
        <AcceptedCards location="payment" />
        <label className="relative block">
          <span className="sr-only">Card number</span>
          <input id="demo-card-number" required maxLength={23} pattern="[0-9 ]{13,23}" inputMode="numeric" autoComplete="off" value={demoNumber} onChange={event => setDemoNumber(formatNumber(event.target.value))} onBlur={() => completeField('number', validNumber(demoNumber))} className="h-[52px] w-full rounded-xl border border-[#cdd4dc] bg-white px-3.5 pr-14 text-[15px] text-[#17212f] outline-none placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]" data-testid="input-card-number" placeholder="Card number" />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">{displayedBrand === 'visa' || displayedBrand === 'mastercard' ? <BrandLogo brand={displayedBrand} small /> : displayedBrand ? <CardBrandLogo brand={displayedBrand} /> : <CreditCard size={19} className="mr-2.5 text-[#9aa4b2]" aria-hidden="true" />}</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0"><span className="sr-only">Expiration date</span><input required maxLength={5} pattern="(0[1-9]|1[0-2])/[0-9]{2}" inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={demoExpiry} onChange={event => setDemoExpiry(formatExpiry(event.target.value))} onBlur={() => completeField('expiry', validExpiry(demoExpiry))} className="h-[52px] w-full min-w-0 rounded-xl border border-[#cdd4dc] bg-white px-3.5 text-[15px] text-[#17212f] outline-none placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]" data-testid="input-card-expiry" /></label>
          <label className="block min-w-0"><span className="sr-only">Security code</span><input required maxLength={4} pattern="[0-9]{3,4}" type="password" inputMode="numeric" autoComplete="new-password" name="demo-card-security-code" placeholder="Security code" value={demoCvc} onChange={event => setDemoCvc(event.target.value.replace(/\D/g, '').slice(0, 4))} onBlur={() => completeField('cvc', validCvc(demoCvc))} className="h-[52px] w-full min-w-0 rounded-xl border border-[#cdd4dc] bg-white px-3.5 text-[15px] text-[#17212f] outline-none placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]" data-testid="input-card-cvc" /></label>
        </div>
        <label className="block"><span className="sr-only">Cardholder name</span><input required maxLength={80} autoComplete="off" value={demoName} onChange={event => setDemoName(event.target.value)} onBlur={() => completeField('name', validName(demoName))} className="h-[52px] w-full rounded-xl border border-[#cdd4dc] bg-white px-3.5 text-[15px] text-[#17212f] outline-none placeholder:text-[#788493] focus:border-[#c92525] focus:ring-1 focus:ring-[#c92525]" data-testid="input-card-name" placeholder="Cardholder name" /></label>
        <CheckoutBillingFields value={billingAddress} onChange={value => { setBillingAddress(value); setBillingStarted(true); }} />
        <div className="flex items-center justify-between gap-3 pt-2">
          <span className="text-[12px] font-semibold text-[#344255]">Card type</span>
          <div className="flex rounded-lg border border-[#d9dee5] bg-[#f7f8fa] p-0.5" role="group" aria-label="Card type">
            {(['credit', 'debit'] as const).map(type => <button key={type} type="button" aria-pressed={cardType === type} onClick={() => { setCardType(type); if (!fictionalDemoMode && completedRef.current.length) queueDraft(demoName, type, completedRef.current); }} className={`rounded-md px-3.5 py-1.5 text-[12px] font-semibold capitalize transition ${cardType === type ? 'bg-white text-[#263241] shadow-sm' : 'text-[#73808e] hover:text-[#263241]'}`} data-testid={`button-card-type-${type}`}>{type}</button>)}
          </div>
        </div>
        {formError && <p role="alert" className="text-[12px] font-semibold text-[#a61c1c]">{formError}</p>}
        {draftError && <p role="status" className="text-[12px] text-[#a61c1c]">{draftError}</p>}
        {order.isError && <p role="alert" className="text-[12px] font-semibold text-[#a61c1c]" data-testid="text-checkout-error">We couldn’t place your order: {errorMessage(order.error)} Your cart is unchanged; please try again.</p>}
        {stockError && <p role="alert" className="text-[12px] text-[#a61c1c]">One or more items exceed current availability. Update your cart before checkout.</p>}
        <button type="submit" disabled={!cart.length || placingOrder || order.isPending || stockError} className="red-button red-button--wide" data-testid="button-submit-checkout"><span>Complete local preview</span><span className="flex items-center gap-2">{totalCents ? `$${(totalCents / 100).toFixed(2)}` : ''}<ArrowRight size={17} aria-hidden="true" /></span></button>
        <button type="button" onClick={() => { setFormError(''); setStep('method'); }} className="mx-auto flex min-h-11 items-center gap-2 px-3 text-[13px] font-semibold text-[#637082] hover:text-[#263241] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c92525]" data-testid="button-change-payment-method"><ArrowLeft size={15} aria-hidden="true" /> Change payment method</button>
      </div>
    </form>}
  </section>;
}