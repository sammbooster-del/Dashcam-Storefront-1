import { useEffect } from 'react';
import { ArrowRight, Check, CheckCircle2, ChevronRight, CreditCard, LoaderCircle, LockKeyhole, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import './_group.css';

type VerificationMethod = 'email' | 'phone';

type TestVerificationScreenProps = {
  orderId: number;
  cardLast4: string;
  totalCents: number;
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

function TestVerificationScreen({
  orderId,
  cardLast4,
  totalCents,
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
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  const last4 = cardLast4.replace(/\D/g, '').slice(-4) || '••••';
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalCents / 100);
  const step = phase === 'choose' ? 1 : phase === 'enter' ? 2 : 3;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-verification-title"
      data-testid="screen-test-verification"
      className="driveguard-verification-root fixed inset-0 z-[100] min-h-screen overflow-y-auto bg-[#f5f5f2] text-[#1e2933] overscroll-contain"
    >
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(340px,40%)_1fr]">
        <aside className="relative isolate flex flex-col overflow-hidden bg-[#1b2731] px-6 pb-7 pt-7 text-[#f8f7f2] sm:px-10 lg:min-h-[100dvh] lg:px-[clamp(40px,5vw,90px)] lg:pb-14 lg:pt-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-1/4 -z-10 h-[520px] w-[520px] rounded-full border border-white/[.06] shadow-[0_0_0_70px_rgba(255,255,255,.025),0_0_0_140px_rgba(255,255,255,.018)]" />
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-[#c5252b]">
              <ShieldCheck size={22} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="text-[19px] font-extrabold tracking-[-.055em]">DriveGuard<span className="text-[#e74548]">.</span></span>
            <span className="ml-auto border border-white/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[.17em] text-[#c1cbd1] lg:hidden">Test mode</span>
          </div>

          <div className="mt-10 hidden lg:block">
            <div className="mb-8 h-px w-12 bg-[#e04a4d]" />
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#e56769]">Test verification</p>
            <h2 className="mt-5 max-w-[450px] text-[clamp(39px,4vw,66px)] font-bold leading-[1.05] tracking-[-.065em]">
              One last check.<br /><span className="text-[#a5b3bb]">Then you’re on your way.</span>
            </h2>
            <p className="mt-6 max-w-[370px] text-[14px] leading-7 text-[#aab7bf]">
              You’re reviewing a simulated checkout. Follow the on-screen steps to complete this test order.
            </p>
          </div>

          <div className="mt-8 lg:mt-auto lg:pt-16">
            <div className="border-t border-white/15 pt-5 lg:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8f9ea8]">Order reference</p>
                  <p className="mt-1 text-[15px] font-semibold" data-testid="text-verification-order">#{orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8f9ea8]">Test total</p>
                  <p className="mt-1 text-[17px] font-bold" data-testid="text-verification-total">{amount}</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[12px] text-[#aebbc3]">
                <CreditCard size={15} aria-hidden="true" />
                <span>Card ending in {last4}</span>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-[.14em] text-[#e98284]">Simulation</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col px-6 pb-10 pt-8 sm:px-10 lg:px-[clamp(48px,7vw,120px)] lg:py-12">
          <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#b5222a]">Secure checkout · Demo</p>
              <p className="text-[11px] font-semibold text-[#82909a]">STEP {step} / 3</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map(item => (
                <span key={item} className={`h-1 rounded-full ${item <= step ? 'bg-[#c5252b]' : 'bg-[#dce1e1]'}`} />
              ))}
            </div>

            <div className="flex flex-1 flex-col justify-center py-10 lg:py-14">
              {phase === 'choose' && (
                <div>
                  <span className="mb-7 flex h-14 w-14 items-center justify-center rounded-[4px] border border-[#ecd9d7] bg-[#f8eae7] text-[#bc252b]">
                    <LockKeyhole size={25} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#b5222a]">Verification method</p>
                  <h1 id="test-verification-title" className="mt-3 text-[clamp(32px,4vw,52px)] font-bold leading-[1.08] tracking-[-.055em] text-[#1b2731]">
                    How would you like to verify?
                  </h1>
                  <p className="mt-4 max-w-[470px] text-[14px] leading-6 text-[#687682]">
                    Pick a simulated delivery method to continue with this test checkout.
                  </p>

                  <div className="mt-9 space-y-3">
                    <button
                      type="button"
                      onClick={() => onChoose('email')}
                      disabled={busy}
                      data-testid="button-choose-email"
                      className="group flex w-full items-center gap-4 rounded-[5px] border border-[#dce1e2] bg-[#fbfbf9] p-4 text-left transition-colors hover:border-[#c5252b] hover:bg-[#fffafa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5252b] disabled:opacity-50 sm:p-5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-[#edf0ef] text-[#344650]"><Mail size={20} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-[#1b2731]">Email</span><span className="mt-0.5 block text-[12px] text-[#788590]">Use the email test path</span></span>
                      <ChevronRight size={19} className="text-[#9ba6ac] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChoose('phone')}
                      disabled={busy}
                      data-testid="button-choose-phone"
                      className="group flex w-full items-center gap-4 rounded-[5px] border border-[#dce1e2] bg-[#fbfbf9] p-4 text-left transition-colors hover:border-[#c5252b] hover:bg-[#fffafa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5252b] disabled:opacity-50 sm:p-5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] bg-[#edf0ef] text-[#344650]"><MessageSquare size={20} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold text-[#1b2731]">Phone</span><span className="mt-0.5 block text-[12px] text-[#788590]">Use the phone test path</span></span>
                      <ChevronRight size={19} className="text-[#9ba6ac] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </button>
                  </div>
                  {error && <p role="alert" data-testid="text-verification-error" className="mt-4 text-[13px] font-medium text-[#b5222a]">{error}</p>}
                </div>
              )}

              {phase === 'enter' && (
                <div>
                  <span className="mb-7 flex h-14 w-14 items-center justify-center rounded-[4px] border border-[#ecd9d7] bg-[#f8eae7] text-[#bc252b]">
                    <LockKeyhole size={25} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#b5222a]">Step 02 · Test code</p>
                  <h1 id="test-verification-title" className="mt-3 text-[clamp(32px,4vw,52px)] font-bold leading-[1.08] tracking-[-.055em] text-[#1b2731]">
                    Enter the test code.
                  </h1>
                  <p className="mt-4 max-w-[470px] text-[14px] leading-6 text-[#687682]">
                    Enter the six-digit test OTP for the {method === 'phone' ? 'phone' : 'email'} path. No message is sent.
                  </p>

                  <form className="mt-9" onSubmit={event => { event.preventDefault(); if (!busy && /^\d{6}$/.test(code)) onSubmit(); }}>
                    <label htmlFor="test-verification-code" className="mb-2.5 block text-[12px] font-bold text-[#34434d]">Six-digit test code</label>
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
                      className="h-16 w-full rounded-[4px] border border-[#cfd7d9] bg-[#fbfbf9] px-5 font-mono text-[25px] font-semibold tracking-[.38em] text-[#1b2731] outline-none placeholder:text-[#bec7c8] focus:border-[#bd292d] focus:ring-2 focus:ring-[#bd292d]/10 disabled:opacity-60"
                    />
                    {error && <p id="test-verification-error" role="alert" data-testid="text-verification-error" className="mt-3 text-[13px] font-medium text-[#b5222a]">{error}</p>}
                    <p id="test-verification-note" className="mt-3 text-[12px] leading-5 text-[#859098]">This is a simulation. Nothing is sent to an email address or phone number.</p>
                    <button
                      type="submit"
                      disabled={busy || !/^\d{6}$/.test(code)}
                      data-testid="button-test-verification-submit"
                      className="mt-7 flex min-h-14 w-full items-center justify-between rounded-[4px] bg-[#c5252b] px-5 text-[14px] font-bold text-[#fffaf7] transition-colors hover:bg-[#a91e24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5252b] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{busy ? 'Checking test code…' : 'Submit test code'}</span>
                      {busy ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}
                    </button>
                  </form>
                </div>
              )}

              {phase === 'waiting' && (
                <div role="status" data-testid="status-verification-waiting">
                  <span className="mb-7 flex h-16 w-16 items-center justify-center rounded-[4px] border border-[#ecd9d7] bg-[#f8eae7] text-[#bc252b]">
                    <LoaderCircle size={30} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#b5222a]">Step 03 · Review pending</p>
                  <h1 id="test-verification-title" className="mt-3 text-[clamp(32px,4vw,52px)] font-bold leading-[1.08] tracking-[-.055em] text-[#1b2731]">
                    Verifying your details.
                  </h1>
                  <p className="mt-4 max-w-[470px] text-[14px] leading-7 text-[#687682]">
                    Your test code was submitted. This page will update automatically when the review is complete.
                  </p>
                  <div className="mt-9 flex items-center gap-3 border-l-[3px] border-[#c5252b] bg-[#e9eeec] px-5 py-4 text-[13px] font-medium text-[#465760]">
                    <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="absolute inset-0 animate-ping rounded-full bg-[#c5252b] opacity-30" /><span className="relative h-2.5 w-2.5 rounded-full bg-[#c5252b]" /></span>
                    Processing verification
                  </div>
                  {error && <p role="alert" data-testid="text-verification-error" className="mt-4 text-[13px] font-medium text-[#b5222a]">{error}</p>}
                </div>
              )}

              {phase === 'approved' && (
                <div data-testid="status-verification-approved">
                  <span className="mb-7 flex h-16 w-16 items-center justify-center rounded-[4px] border border-[#cbded2] bg-[#e6f0e8] text-[#30704b]">
                    <CheckCircle2 size={32} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#30704b]">Step 03 · Approved</p>
                  <h1 id="test-verification-title" className="mt-3 text-[clamp(32px,4vw,52px)] font-bold leading-[1.08] tracking-[-.055em] text-[#1b2731]">
                    Verification complete.
                  </h1>
                  <p className="mt-4 max-w-[470px] text-[14px] leading-7 text-[#687682]">
                    Your simulated verification is complete. You can continue to your order confirmation.
                  </p>
                  <div className="mt-9 flex items-center gap-3 border-l-[3px] border-[#3c8060] bg-[#e7f0e9] px-5 py-4 text-[13px] font-semibold text-[#306949]">
                    <Check size={17} aria-hidden="true" /> Approved for this test order
                  </div>
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={busy}
                    data-testid="button-test-verification-next"
                    className="mt-7 flex min-h-14 w-full items-center justify-between rounded-[4px] bg-[#c5252b] px-5 text-[14px] font-bold text-[#fffaf7] transition-colors hover:bg-[#a91e24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c5252b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{busy ? 'Continuing…' : 'Continue to confirmation'}</span>
                    <ArrowRight size={19} aria-hidden="true" />
                  </button>
                  {error && <p role="alert" data-testid="text-verification-error" className="mt-4 text-[13px] font-medium text-[#b5222a]">{error}</p>}
                </div>
              )}
            </div>

            <footer className="border-t border-[#dce1e1] pt-5 text-[11px] leading-5 text-[#87939a]">
              Internal demonstration only. No email or SMS is sent, and no payment is charged.
            </footer>
          </div>
        </main>
      </div>
    </section>
  );
}

export function Current() {
  return (
    <TestVerificationScreen
      orderId={1001}
      cardLast4="6637"
      totalCents={32900}
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