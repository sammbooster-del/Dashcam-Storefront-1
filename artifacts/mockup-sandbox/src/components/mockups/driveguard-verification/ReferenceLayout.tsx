import { useEffect, useState } from 'react';
import { Check, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import './_group.css';

type VerificationMethod = 'email' | 'phone';

type VerificationAppearance = {
  verificationTitle?: string;
  verificationMerchantName?: string;
  verificationCountry?: string;
  verificationPrompt?: string;
  verificationEmailLabel?: string;
  verificationPhoneLabel?: string;
  verificationNextLabel?: string;
  verificationAccentColor?: string;
  verificationButtonColor?: string;
};

type TestVerificationScreenProps = {
  orderId: number;
  cardLast4: string;
  totalCents: number;
  brandName: string;
  appearance: VerificationAppearance;
  orderCreatedAt?: string;
  method: VerificationMethod | null;
  code: string;
  phase: 'choose' | 'enter' | 'waiting' | 'approved';
  busy: boolean;
  error: string;
  onChoose: (method: VerificationMethod) => void;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
};

const disclosure = 'Internal demonstration only. No email or SMS is sent, and no payment is charged.';

function TestVerificationScreen({
  orderId,
  cardLast4,
  totalCents,
  brandName,
  appearance,
  orderCreatedAt,
  method,
  code,
  phase,
  busy,
  error,
  onChoose,
  onCodeChange,
  onSubmit,
  onContinue,
}: TestVerificationScreenProps) {
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod | null>(method);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const last4 = cardLast4.replace(/\D/g, '').slice(-4) || '••••';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCents / 100);
  const merchant = appearance?.verificationMerchantName?.trim() || brandName;
  const country = appearance?.verificationCountry?.trim();
  const parsedDate = orderCreatedAt ? new Date(orderCreatedAt) : null;
  const orderDate = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsedDate)
    : null;
  const accent = appearance?.verificationAccentColor || '#54448b';
  const buttonColor = appearance?.verificationButtonColor || '#e18a23';
  const buttonClass = 'inline-flex min-h-10 items-center justify-center rounded-md px-6 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-verification-title"
      data-testid="screen-test-verification"
      className="driveguard-verification-root fixed inset-0 z-[100] min-h-screen overflow-y-auto overscroll-contain bg-white text-[#20242d] md:bg-[#f4f5f7]"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[620px] flex-col bg-white px-5 pb-6 pt-7 sm:px-9 md:my-8 md:min-h-[calc(100dvh-4rem)] md:border md:border-[#e5e7eb] md:px-10 md:shadow-[0_12px_38px_rgba(27,36,51,.06)]">
        <header>
          <h1 id="test-verification-title" className="text-[22px] font-medium leading-tight tracking-[-.035em] sm:text-[24px]">
            {appearance?.verificationTitle?.trim() || 'Verify test order'}
          </h1>
          <div className="mt-7 grid grid-cols-2 items-center gap-3 border-b border-[#e6e8ec] pb-7 sm:mt-9 sm:pb-9">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[#243b54] text-white" aria-hidden="true">
                <ShieldCheck size={22} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold leading-tight tracking-[-.04em]">{brandName}</p>
                <p className="text-[10px] leading-tight text-[#737d89]">Test verification</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="border-l border-[#e6e8ec] pl-3 text-right sm:pl-6">
                <span className="inline-block rounded-[3px] border border-[#d8cfa7] bg-[#fff8df] px-2 py-0.5 text-[11px] font-extrabold tracking-[.14em] text-[#705715]">DEMO</span>
                <p className="mt-1 text-[10px] leading-tight text-[#737d89]">No real transaction</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-6">
          <div className="divide-y divide-[#dfe2e7] border-y border-[#dfe2e7] text-[13px] leading-5 sm:text-[14px]">
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Merchant name</span><span className="min-w-0 break-words" data-testid="text-verification-merchant">{merchant}</span></div>
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Test card</span><span data-testid="text-verification-card">•••• •••• •••• {last4}</span></div>
            {country && <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Country</span><span data-testid="text-verification-country">{country}</span></div>}
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order amount</span><span data-testid="text-verification-total">{amount} USD</span></div>
            {orderDate && <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order date</span><span data-testid="text-verification-date">{orderDate}</span></div>}
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order reference</span><span data-testid="text-verification-order">#{orderId}</span></div>
          </div>

          {phase === 'choose' && (
            <div className="pt-7">
              <h2 className="text-[15px] font-bold uppercase leading-[1.35] tracking-[.015em] sm:text-[17px]" style={{ color: accent }}>
                {appearance?.verificationPrompt?.trim() || 'Select a test verification method'}
              </h2>
              <fieldset className="mt-4 space-y-1">
                <legend className="sr-only">Test verification method</legend>
                {(['email', 'phone'] as const).map(option => (
                  <label
                    key={option}
                    data-testid={`button-choose-${option}`}
                    className="flex min-h-9 cursor-pointer items-center gap-3 rounded-sm py-1 text-[14px] font-semibold leading-5 hover:bg-[#f7f7f9] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
                    style={{ outlineColor: accent }}
                  >
                    <input
                      type="radio"
                      name="test-verification-method"
                      value={option}
                      checked={selectedMethod === option}
                      onChange={() => setSelectedMethod(option)}
                      disabled={busy}
                      data-testid={`radio-choose-${option}`}
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer"
                      style={{ accentColor: accent }}
                    />
                    <span>{option === 'email'
                      ? (appearance?.verificationEmailLabel?.trim() || 'Email (test path)')
                      : (appearance?.verificationPhoneLabel?.trim() || 'Phone (test path)')}</span>
                  </label>
                ))}
              </fieldset>
              {error && <p role="alert" data-testid="text-verification-error" className="mt-3 text-[12px] font-medium text-[#b42335]">{error}</p>}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={busy || !selectedMethod}
                  onClick={() => { if (selectedMethod) onChoose(selectedMethod); }}
                  data-testid="button-verification-method-next"
                  className={buttonClass}
                  style={{ backgroundColor: buttonColor }}
                >
                  {busy ? 'Continuing…' : (appearance?.verificationNextLabel?.trim() || 'Next')}
                </button>
              </div>
            </div>
          )}

          {phase === 'enter' && (
            <div className="pt-7">
              <h2 className="text-[16px] font-bold uppercase leading-[1.35]" style={{ color: accent }}>Enter your test code</h2>
              <p className="mt-3 text-[13px] leading-5 text-[#5d6572]">Enter the six-digit code for the {method === 'phone' ? 'phone' : 'email'} test path. No message is sent.</p>
              <form className="mt-6" onSubmit={event => { event.preventDefault(); if (!busy && /^\d{6}$/.test(code)) onSubmit(); }}>
                <label htmlFor="test-verification-code" className="mb-2 block text-[13px] font-semibold">Six-digit test code</label>
                <input
                  id="test-verification-code"
                  data-testid="input-test-verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={event => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy}
                  placeholder="000000"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'test-verification-error' : 'test-verification-note'}
                  className="h-12 w-full rounded-[4px] border border-[#cbd0d7] bg-white px-4 font-mono text-[21px] tracking-[.3em] outline-none focus:border-[#54448b] disabled:opacity-50"
                />
                {error && <p id="test-verification-error" role="alert" data-testid="text-verification-error" className="mt-2 text-[12px] font-medium text-[#b42335]">{error}</p>}
                <p id="test-verification-note" className="mt-2 text-[12px] leading-5 text-[#69727e]">Simulation only. Nothing is delivered to an email address or phone number.</p>
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={busy || !/^\d{6}$/.test(code)} data-testid="button-test-verification-submit" className={buttonClass} style={{ backgroundColor: buttonColor }}>
                    {busy ? <><LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" /> Checking…</> : 'Submit test code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {phase === 'waiting' && (
            <div className="pt-8" role="status" data-testid="status-verification-waiting">
              <LoaderCircle size={27} className="mb-4 animate-spin" style={{ color: accent }} aria-hidden="true" />
              <h2 className="text-[16px] font-bold uppercase" style={{ color: accent }}>Verification in progress</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#5d6572]">Your test code was submitted. This page will update when the review is complete.</p>
              {error && <p role="alert" data-testid="text-verification-error" className="mt-3 text-[12px] font-medium text-[#b42335]">{error}</p>}
            </div>
          )}

          {phase === 'approved' && (
            <div className="pt-8" data-testid="status-verification-approved">
              <CheckCircle2 size={29} className="mb-4 text-[#36815c]" aria-hidden="true" />
              <h2 className="text-[16px] font-bold uppercase text-[#28734f]">Verification complete</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#5d6572]">Your simulated verification is complete. You can continue to your order confirmation.</p>
              <div className="mt-5 flex items-center gap-2 border-l-[3px] border-[#36815c] bg-[#eff6f1] px-3 py-3 text-[12px] font-semibold text-[#28734f]"><Check size={15} aria-hidden="true" /> Approved for this test order</div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={onContinue} disabled={busy} data-testid="button-test-verification-next" className={buttonClass} style={{ backgroundColor: buttonColor }}>
                  {busy ? 'Continuing…' : 'Continue to confirmation'}
                </button>
              </div>
              {error && <p role="alert" data-testid="text-verification-error" className="mt-3 text-[12px] font-medium text-[#b42335]">{error}</p>}
            </div>
          )}
        </main>

        <footer className="mt-12 border-t border-[#e6e8ec] pt-4 text-[11px] leading-[1.55] text-[#626b78]" data-testid="text-verification-disclosure">
          {disclosure}
        </footer>
      </div>
    </section>
  );
}

export function ReferenceLayout() {
  return (
    <TestVerificationScreen
      orderId={1001}
      cardLast4="6637"
      totalCents={32900}
      brandName="DriveGuard"
      appearance={{
        verificationTitle: 'Verify test checkout',
        verificationMerchantName: 'DriveGuard',
        verificationCountry: '',
        verificationPrompt: 'SELECT A METHOD FOR YOUR TEST CODE',
        verificationEmailLabel: 'Email',
        verificationPhoneLabel: 'Phone',
        verificationNextLabel: 'Next',
        verificationAccentColor: '#603b89',
        verificationButtonColor: '#e59119',
      }}
      orderCreatedAt="2026-09-25T12:00:00.000Z"
      method={null}
      code=""
      phase="choose"
      busy={false}
      error=""
      onChoose={() => undefined}
      onCodeChange={() => undefined}
      onSubmit={() => undefined}
      onContinue={() => undefined}
    />
  );
}