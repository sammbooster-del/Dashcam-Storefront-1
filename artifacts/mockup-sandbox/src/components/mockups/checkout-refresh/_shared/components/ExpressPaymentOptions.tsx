import applePayLogo from '../assets/payments/apple-pay.svg';
import googlePayLogo from '../assets/payments/google-pay.svg';

export function ExpressPaymentOptions() {
  return <div className="mx-auto w-full max-w-[440px] space-y-3" data-testid="express-payment-options">
    <h3 className="text-[16px] font-bold tracking-[-.02em] text-[#263241]">Express payment</h3>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2 text-center">
        <button type="button" disabled aria-label="Apple Pay — coming soon" className="flex h-14 w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-black bg-black px-4" data-testid="button-apple-pay-coming-soon">
          <img src={applePayLogo} alt="Apple Pay" className="h-8 w-[78px] object-contain brightness-0 invert" />
        </button>
        <p className="text-[11px] font-medium text-[#637082]">Coming soon</p>
      </div>
      <div className="space-y-2 text-center">
        <button type="button" disabled aria-label="Google Pay — coming soon" className="flex h-14 w-full cursor-not-allowed items-center justify-center rounded-[10px] border border-[#cdd4dc] bg-white px-4" data-testid="button-google-pay-coming-soon">
          <img src={googlePayLogo} alt="Google Pay" className="h-8 w-[78px] object-contain" />
        </button>
        <p className="text-[11px] font-medium text-[#637082]">Coming soon</p>
      </div>
    </div>
    <p className="text-[12px] leading-5 text-[#637082]">Digital wallets are not available yet. Pay with a card below.</p>
    <div className="flex items-center gap-3 pt-2" aria-hidden="true">
      <div className="h-px flex-1 bg-[#e1e5e9]" />
      <span className="text-[11px] font-semibold text-[#637082]">Pay by card</span>
      <div className="h-px flex-1 bg-[#e1e5e9]" />
    </div>
  </div>;
}