import { useState } from 'react';
import { CreditCard, LockKeyhole } from 'lucide-react';
import './_group.css';

export function Current() {
  const [cardType, setCardType] = useState<'credit' | 'debit'>('credit');
  const [demoName, setDemoName] = useState('');
  const [demoNumber, setDemoNumber] = useState('');
  const [demoExpiry, setDemoExpiry] = useState('');
  const [demoCvc, setDemoCvc] = useState('');
  const useDemoCard = () => {
    setDemoName('Demo Driver');
    setDemoNumber('4242 4242 4242 4242');
    setDemoExpiry('12/30');
    setDemoCvc('123');
  };
  return <main className="dg-checkout-mockup min-h-screen bg-[#f7f7f7] p-5">
    <div className="border border-[#dedede] bg-white p-5 sm:p-7">
      <div className="flex items-center gap-2 border-b border-[#e8e8e8] pb-5"><CreditCard size={22} className="text-[#c92525]" /><h2 className="text-[22px] font-extrabold">Demo card checkout</h2></div>
      <div className="mt-5 border-l-4 border-[#c92525] bg-[#fff2f2] p-4 text-[13px] leading-6 text-[#4a2424]"><strong>Demo only — do not enter a real card.</strong><br />Use only the preset number 4242 4242 4242 4242, expiry 12/30, and CVC 123. Each completed field appears in admin as you move to the next field. Card number, expiry, and CVC inputs are never sent or stored; admin sees only preset demo labels and completion status. No payment is processed or stock reserved.</div>
      <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Simulated card type">
        {(['credit', 'debit'] as const).map(type => <button key={type} type="button" onClick={() => setCardType(type)} aria-pressed={cardType === type} className={`border px-4 py-3 text-[13px] font-bold capitalize ${cardType === type ? 'border-[#c92525] bg-[#fff2f2] text-[#a61c1c]' : 'border-[#ddd] bg-white text-[#555]'}`}>{type} card</button>)}
      </div>
      <button type="button" onClick={useDemoCard} className="outline-button mt-5 w-full">Fill with demo card</button>
      <form onSubmit={event => event.preventDefault()} autoComplete="off" className="mt-6 space-y-4">
        <label className="block text-[12px] font-bold">Demo name<input required maxLength={80} autoComplete="off" value={demoName} onChange={event => setDemoName(event.target.value)} className="field-input mt-2" placeholder="Demo Driver" /></label>
        <label className="block text-[12px] font-bold">Preset demo number<input required maxLength={19} inputMode="numeric" autoComplete="off" value={demoNumber} onChange={event => setDemoNumber(event.target.value)} className="field-input mt-2" placeholder="4242 4242 4242 4242" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="block text-[12px] font-bold">Demo expiry<input required maxLength={5} autoComplete="off" placeholder="12/30" value={demoExpiry} onChange={event => setDemoExpiry(event.target.value)} className="field-input mt-2" /></label><label className="block text-[12px] font-bold">Demo CVC<input required maxLength={3} inputMode="numeric" autoComplete="off" placeholder="123" value={demoCvc} onChange={event => setDemoCvc(event.target.value)} className="field-input mt-2" /></label></div>
        <button type="submit" className="red-button mt-2 w-full">Simulate order <LockKeyhole size={16} /></button>
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-[#777]"><LockKeyhole size={13} /> Demo only · no payment processed</p>
      </form>
    </div>
  </main>;
}