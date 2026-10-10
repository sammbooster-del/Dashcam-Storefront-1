import { Check } from 'lucide-react';

export type CheckoutStep = 'method' | 'delivery' | 'payment';
const stages = [
  { key: 'delivery', label: 'Delivery' },
  { key: 'method', label: 'Payment method' },
  { key: 'payment', label: 'Card & billing' },
] as const;

export function CheckoutProgress({ step }: { step: CheckoutStep }) {
  const current = stages.findIndex(stage => stage.key === step);
  return <ol className="mt-7 flex items-start justify-between gap-2" aria-label={`Checkout progress: step ${current + 1} of 3`}>
    {stages.map((stage, index) => <li key={stage.key} className="flex flex-1 flex-col gap-2" aria-current={index === current ? 'step' : undefined}>
      <span className={`h-1 w-full rounded-full ${index < current ? 'bg-[#263241]' : index === current ? 'bg-[#c92525]' : 'bg-[#e1e5e9]'}`} />
      <span className="flex items-center gap-2">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${index < current ? 'bg-[#263241] text-white' : index === current ? 'bg-[#c92525] text-white' : 'border border-[#cbd2da] bg-white text-[#758190]'}`}>
          {index < current ? <Check size={13} aria-hidden="true" /> : index + 1}
        </span>
        <span className={`text-[11px] font-bold leading-tight sm:text-[12px] ${index === current ? 'text-[#1c2734]' : 'text-[#758190]'}`}>{stage.label}</span>
      </span>
    </li>)}
  </ol>;
}
