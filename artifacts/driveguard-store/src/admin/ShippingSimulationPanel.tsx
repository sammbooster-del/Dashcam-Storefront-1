import { useState } from 'react';
import { Copy, ExternalLink, Loader2, Mail, Truck } from 'lucide-react';
import { useCreateShippingSimulation, useSendShippingSimulation, type ShippingSimulationLink } from '@workspace/api-client-react';
import { errorMessage } from '@/lib-store';

const shippingMessage = (amount: string) => `A shipping calculation glitch applied free shipping to this order. Free shipping applies only to the US and Canada. Shipping these products to India is $${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}.`;
const initialMessage = shippingMessage('340');

export function ShippingSimulationPanel() {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('340.00');
  const [orderReference, setOrderReference] = useState('#8');
  const [message, setMessage] = useState(initialMessage);
  const [link, setLink] = useState<ShippingSimulationLink | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const create = useCreateShippingSimulation();
  const send = useSendShippingSimulation();
  const busy = create.isPending || send.isPending;
  const change = (update: () => void) => { update(); setLink(null); setNotice(''); setError(''); };
  const field = 'mt-2 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700 disabled:opacity-60';

  return <section className="dg-panel" data-testid="admin-shipping-simulation">
    <div className="dg-panel-head"><div><h2 className="flex items-center gap-2"><Truck size={18} />Shipping simulation</h2><p>Create and email an internal shipping update using a dummy reference.</p></div><span className="dg-badge hidden">Internal simulation</span></div>
    <div className="p-5 sm:p-6">
      <p className="mb-5 rounded-xl border border-emerald-900/10 bg-emerald-50 p-3 text-sm text-emerald-950">Uses <strong>SIM-TEST</strong> only. Links expire in seven days. Simulated completion does not change orders or inventory. Country restrictions still apply.</p>
      <form onSubmit={async event => {
        event.preventDefault(); setNotice(''); setError(''); setLink(null);
        const amountCents = Math.round(Number(amount) * 100);
        if (!/^\d+(\.\d{1,2})?$/.test(amount) || amountCents < 1 || amountCents > 1000000) {
          setError('Enter an amount between $0.01 and $10,000.00, with at most two decimal places.'); return;
        }
        try { setLink(await create.mutateAsync({ data: { recipientEmail: recipientEmail.trim(), amountCents, orderReference: orderReference.trim(), message: message.trim() } })); }
        catch (e) { setError(errorMessage(e)); }
      }}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Recipient email<input required type="email" maxLength={254} className={field} value={recipientEmail} onChange={e => change(() => setRecipientEmail(e.target.value))} placeholder="team@example.com" data-testid="shipping-recipient" /></label>
          <label className="text-sm font-medium">Shipping amount (USD)<input required type="text" inputMode="decimal" className={field} value={amount} onChange={e => change(() => {
            if (message === shippingMessage(amount) && Number.isFinite(Number(e.target.value))) setMessage(shippingMessage(e.target.value));
            setAmount(e.target.value);
          })} data-testid="shipping-amount" /></label>
          <label className="text-sm font-medium sm:col-span-2">Order reference<input required maxLength={80} className={field} value={orderReference} onChange={e => change(() => setOrderReference(e.target.value))} data-testid="shipping-order-reference" /></label>
          <label className="text-sm font-medium sm:col-span-2">Email message<textarea required rows={4} maxLength={1500} className={field} value={message} onChange={e => change(() => setMessage(e.target.value))} data-testid="shipping-message" /></label>
        </fieldset>
        <button className="btn mt-5" type="submit" disabled={busy} data-testid="shipping-create">{create.isPending && <Loader2 className="animate-spin" size={16} />}Create simulation link</button>
      </form>
      {link && <div className="mt-5 rounded-xl border bg-stone-50 p-4">
        <h3 className="font-semibold">Ready to preview</h3>
        <p className="mt-1 text-sm text-muted-foreground">{recipientEmail} · ${Number(amount).toFixed(2)} USD · Order {orderReference}</p>
        <p className="mt-3 whitespace-pre-line text-sm">{message}</p>
        <p className="mt-3 text-xs text-muted-foreground">Expires {new Date(link.expiresAt).toLocaleString()}. Republish before sending a newly added feature.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-ghost btn-sm" type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(link.url); setNotice('Link copied.'); setError(''); }
            catch { setError('Copy failed. Select and copy the link below.'); }
          }}><Copy size={15} />Copy link</button>
          <a className="btn btn-ghost btn-sm" href={`${import.meta.env.BASE_URL}shipping-simulation/${link.token}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Preview</a>
          <button className="btn btn-sm" type="button" disabled={busy} data-testid="shipping-send" onClick={async () => {
            setNotice(''); setError('');
            try { const result = await send.mutateAsync({ data: { token: link.token } }); setNotice(`Email accepted for ${result.recipientEmail}.`); }
            catch (e) { setError(errorMessage(e)); }
          }}>{send.isPending ? <Loader2 className="animate-spin" size={15} /> : <Mail size={15} />}Send simulation email</button>
        </div>
        <input readOnly aria-label="Simulation link" value={link.url} className={`${field} mt-4 text-xs`} onFocus={e => e.target.select()} />
      </div>}
      {notice && <p role="status" className="mt-4 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  </section>;
}
