import { useEffect, useState } from 'react';
import { Check, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';

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
  waitingForCode: boolean;
  busy: boolean;
  error: string;
  onChoose: (method: VerificationMethod) => void;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onContinue: () => void;
};

function contrastText(hex: string) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 0.18 ? '#1c2835' : '#ffffff';
}

export function TestVerificationScreen({
  orderId,
  cardLast4,
  totalCents,
  brandName,
  appearance,
  orderCreatedAt,
  method,
  code,
  phase,
  waitingForCode,
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
  const buttonClass = 'inline-flex min-h-10 items-center justify-center rounded-md px-6 py-2 text-[13px] font-semibold shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const buttonStyle = { backgroundColor: buttonColor, color: contrastText(buttonColor) };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-verification-title"
      data-testid="screen-test-verification"
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-white text-[#20242d] md:bg-[#f4f5f7]"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[620px] flex-col bg-white px-5 pb-6 pt-7 sm:px-9 md:my-8 md:min-h-[calc(100dvh-4rem)] md:border md:border-[#e5e7eb] md:px-10 md:shadow-[0_12px_38px_rgba(27,36,51,.06)]">
        <header>
          <h1 id="test-verification-title" className="text-[22px] font-medium leading-tight tracking-[-.035em] sm:text-[24px]">
            {appearance?.verificationTitle?.trim() || 'Verify your order'}
          </h1>
          <div className="mt-7 flex items-center border-b border-[#e6e8ec] pb-7 sm:mt-9 sm:pb-9">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-[#243b54] text-white" aria-hidden="true">
                <ShieldCheck size={22} strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold leading-tight tracking-[-.04em]">{brandName}</p>
                <p className="text-[10px] leading-tight text-[#737d89]">Order verification</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-6">
          <div className="divide-y divide-[#dfe2e7] border-y border-[#dfe2e7] text-[13px] leading-5 sm:text-[14px]">
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Merchant name</span><span className="min-w-0 break-words" data-testid="text-verification-merchant">{merchant}</span></div>
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Card ending in</span><span data-testid="text-verification-card">•••• •••• •••• {last4}</span></div>
            {country && <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Country</span><span data-testid="text-verification-country">{country}</span></div>}
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order amount</span><span data-testid="text-verification-total">{amount} USD</span></div>
            {orderDate && <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order date</span><span data-testid="text-verification-date">{orderDate}</span></div>}
            <div className="flex gap-2 py-2"><span className="w-[112px] shrink-0 font-semibold sm:w-[145px]">Order reference</span><span data-testid="text-verification-order">#{orderId}</span></div>
          </div>

          {phase === 'choose' && (
            <div className="pt-7">
              <h2 className="text-[15px] font-bold uppercase leading-[1.35] tracking-[.015em] sm:text-[17px]" style={{ color: accent }}>
                {appearance?.verificationPrompt?.trim() || 'Select how to receive your one-time code'}
              </h2>
              <fieldset className="mt-4 space-y-1">
                <legend className="sr-only">Code delivery method</legend>
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
                      ? (appearance?.verificationEmailLabel?.trim() || 'Email')
                      : (appearance?.verificationPhoneLabel?.trim() || 'Phone')}</span>
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
                  style={buttonStyle}
                >
                  {busy ? 'Continuing…' : (appearance?.verificationNextLabel?.trim() || 'Next')}
                </button>
              </div>
            </div>
          )}

          {phase === 'enter' && (
            <div className="pt-7">
              <h2 className="text-[16px] font-bold uppercase leading-[1.35]" style={{ color: accent }}>Enter your code</h2>
              <p className="mt-3 text-[13px] leading-5 text-[#5d6572]">Enter the six-digit code provided by {method === 'phone' ? 'phone' : 'email'}.</p>
              <form className="mt-6" onSubmit={event => { event.preventDefault(); if (!busy && /^\d{6}$/.test(code)) onSubmit(); }}>
                <label htmlFor="test-verification-code" className="mb-2 block text-[13px] font-semibold">Six-digit code</label>
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
                <p id="test-verification-note" className="mt-2 text-[12px] leading-5 text-[#69727e]">You’ll see an update after submitting your code.</p>
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={busy || !/^\d{6}$/.test(code)} data-testid="button-test-verification-submit" className={buttonClass} style={buttonStyle}>
                    {busy ? <><LoaderCircle size={15} className="mr-2 animate-spin" aria-hidden="true" /> Submitting…</> : 'Submit code'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {phase === 'waiting' && (
            <div className="pt-8" role="status" data-testid="status-verification-waiting">
              <LoaderCircle size={27} className="mb-4 animate-spin" style={{ color: accent }} aria-hidden="true" />
              <h2 className="text-[16px] font-bold uppercase" style={{ color: accent }}>{waitingForCode ? 'Waiting for your code' : 'Verification in progress'}</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#5d6572]">{waitingForCode
                ? 'Please wait. Code entry will appear when your code is ready.'
                : 'Your code was submitted. This page will update when verification is complete.'}</p>
              {error && <p role="alert" data-testid="text-verification-error" className="mt-3 text-[12px] font-medium text-[#b42335]">{error}</p>}
            </div>
          )}

          {phase === 'approved' && (
            <div className="pt-8" data-testid="status-verification-approved">
              <CheckCircle2 size={29} className="mb-4 text-[#36815c]" aria-hidden="true" />
              <h2 className="text-[16px] font-bold uppercase text-[#28734f]">Verification complete</h2>
              <p className="mt-3 text-[13px] leading-6 text-[#5d6572]">Your code was approved. You can continue to your order confirmation.</p>
              <div className="mt-5 flex items-center gap-2 border-l-[3px] border-[#36815c] bg-[#eff6f1] px-3 py-3 text-[12px] font-semibold text-[#28734f]"><Check size={15} aria-hidden="true" /> Approved for this order</div>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={onContinue} disabled={busy} data-testid="button-test-verification-next" className={buttonClass} style={buttonStyle}>
                  {busy ? 'Continuing…' : 'Continue to confirmation'}
                </button>
              </div>
              {error && <p role="alert" data-testid="text-verification-error" className="mt-3 text-[12px] font-medium text-[#b42335]">{error}</p>}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}