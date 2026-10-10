import { ArrowLeft, ArrowRight, CreditCard } from 'lucide-react';
import { AcceptedCards } from './AcceptedCards';
import { ExpressPaymentOptions } from './ExpressPaymentOptions';

export function CheckoutPaymentMethod({ selected, onSelect, onContinue, onBack, unavailable }: {
  selected: boolean;
  onSelect: () => void;
  onContinue: () => void;
  onBack: () => void;
  unavailable: boolean;
}) {
  return <form className="space-y-6 px-5 py-7 sm:px-8 sm:py-8" data-testid="form-payment-method" onSubmit={event => {
    event.preventDefault();
    if (selected && !unavailable) onContinue();
  }}>
    <div className="mx-auto w-full max-w-[440px]">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#344255] hover:text-[#c92525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c92525]" data-testid="button-method-back-delivery">
        <ArrowLeft size={16} aria-hidden="true" />Back to delivery
      </button>
      <h2 className="mt-3 text-[20px] font-bold tracking-[-.02em] text-[#1c2734]">Choose how to pay</h2>
    </div>
    <ExpressPaymentOptions />
    <label className={`mx-auto block w-full max-w-[440px] cursor-pointer rounded-xl border-2 p-4 transition focus-within:ring-2 focus-within:ring-[#c92525]/20 ${selected ? 'border-[#c92525] bg-[#fff8f7]' : 'border-[#dfe3e8] bg-white hover:border-[#aab3bf]'}`}>
      <div className="flex items-center gap-3">
        <input type="radio" name="payment-method" value="card" checked={selected} onChange={onSelect} className="h-5 w-5 shrink-0 accent-[#c92525]" data-testid="radio-payment-card" />
        <CreditCard size={22} className="text-[#344255]" aria-hidden="true" />
        <span className="text-[15px] font-bold text-[#263241]">Credit or debit card</span>
      </div>
      <div className="mt-4 pl-8"><AcceptedCards location="payment-method" /></div>
    </label>
    <div className="mx-auto w-full max-w-[440px] space-y-3">
      <p className="text-[12px] leading-5 text-[#637082]">{selected ? 'Card selected. Click Next to enter your card and billing details.' : 'Select credit or debit card to continue.'}</p>
      {unavailable && <p role="alert" className="text-[12px] text-[#a61c1c]">Update your cart before continuing. One or more items are unavailable.</p>}
      <button type="submit" disabled={!selected || unavailable} className="red-button red-button--wide" data-testid="button-payment-method-next">
        <span>Next</span><ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  </form>;
}
