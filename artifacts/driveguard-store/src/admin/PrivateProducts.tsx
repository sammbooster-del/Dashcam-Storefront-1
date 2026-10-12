import { type FormEvent, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListAdminPrivatePaymentsQueryKey,
  getListAdminPrivateProductsQueryKey,
  useCreateAdminPrivateProduct,
  useDeleteAdminPrivateProduct,
  useListAdminPrivatePayments,
  useListAdminPrivateProducts,
  useRecordAdminPrivatePayment,
  useUpdateAdminPrivateProduct,
} from '@workspace/api-client-react';
import type { PrivatePayment, PrivateProduct } from '@workspace/api-client-react';
import { Archive, ArrowRight, BadgeCheck, CircleAlert, Copy, Link2, Pause, Pencil, Play, Plus, RefreshCw, X } from 'lucide-react';
import './PrivateProducts.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : 'The request failed. Nothing was saved.';
const newId = () => crypto.randomUUID();
const isPreviewHost = () => window.location.hostname.endsWith('.replit.dev');
export const shareUrl = (path: string) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}

type Draft = { name: string; price: string; collectDelivery: boolean; active: boolean };

function LinkEditor({ product, onClose, onSaved }: { product: PrivateProduct | null; onClose: () => void; onSaved: (text: string) => void }) {
  const queryClient = useQueryClient();
  const create = useCreateAdminPrivateProduct();
  const update = useUpdateAdminPrivateProduct();
  const [draft, setDraft] = useState<Draft>(() => product
    ? { name: product.name, price: (product.priceCents / 100).toFixed(2), collectDelivery: product.collectDelivery, active: product.active }
    : { name: '', price: '', collectDelivery: false, active: true });
  const [error, setError] = useState('');
  // Idempotency intent: reused for retries of identical data, reset on change or success.
  const intent = useRef<{ key: string; requestId: string } | null>(null);
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft(previous => ({ ...previous, [key]: value })); intent.current = null; setError(''); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const name = draft.name.trim();
    const priceCents = Math.round(Number(draft.price) * 100);
    if (!name) { setError('Give the offer a name.'); return; }
    if (!Number.isFinite(priceCents) || !Number.isInteger(priceCents) || priceCents < 50) { setError('Price must be at least $0.50.'); return; }
    const key = JSON.stringify([name, priceCents, draft.collectDelivery, draft.active]);
    if (!intent.current || intent.current.key !== key) intent.current = { key, requestId: newId() };
    const requestId = intent.current.requestId;
    try {
      if (product) await update.mutateAsync({ id: product.id, data: { name, priceCents, collectDelivery: draft.collectDelivery, active: draft.active, requestId } });
      else await create.mutateAsync({ data: { name, priceCents, collectDelivery: draft.collectDelivery, requestId } });
      intent.current = null;
      await queryClient.invalidateQueries({ queryKey: getListAdminPrivateProductsQueryKey() });
      onSaved(product ? `Saved changes to ${name}.` : `Private link created for ${name}.`);
    } catch (reason) { setError(errorMessage(reason)); }
  };

  return <div className="dg-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <aside className="dg-drawer" role="dialog" aria-modal="true" aria-labelledby="pl-editor-title" data-testid="dialog-private-link-editor">
      <div className="dg-drawer-head"><div><p className="dg-eyebrow">Private links / {product ? 'Edit offer' : 'New offer'}</p><h2 id="pl-editor-title">{product ? 'Edit private offer' : 'Create a private offer'}</h2><p>Only people with the link can see it. It never appears in the store catalog.</p></div>
        <button type="button" className="dg-icon-button" aria-label="Close editor" onClick={onClose} disabled={pending} data-testid="button-private-close-editor"><X size={19} /></button>
      </div>
      <form className="dg-drawer-form" onSubmit={submit}>
        {error && <div className="dg-notice" role="alert" data-testid="status-private-save-error">{error}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}
        <div className="dg-fields">
          <label className="dg-field">Offer name<input data-testid="input-private-name" value={draft.name} maxLength={150} required onChange={event => set('name', event.target.value)} placeholder="e.g. Linen tote, set of two" /></label>
          <label className="dg-field">Price<span className="dg-money-field"><span>$</span><input data-testid="input-private-price" type="number" min="0.50" step="0.01" required value={draft.price} onChange={event => set('price', event.target.value)} /></span><small>USD. Minimum $0.50. Paid securely on Stripe.</small></label>
        </div>
        <div className="pl-switches">
          <div className="dg-switch-line"><div><strong>Ask for a delivery address</strong><small>Optional. When on, Stripe collects shipping details at payment.</small></div>
            <button type="button" role="switch" aria-checked={draft.collectDelivery} aria-label="Ask for a delivery address" className="dg-switch" onClick={() => set('collectDelivery', !draft.collectDelivery)} data-testid="switch-private-collect-delivery" /></div>
          {product && <div className="dg-switch-line"><div><strong>Link accepting payments</strong><small>Paused links show customers that the offer is unavailable.</small></div>
            <button type="button" role="switch" aria-checked={draft.active} aria-label="Link accepting payments" className="dg-switch" onClick={() => set('active', !draft.active)} data-testid="switch-private-active" /></div>}
        </div>
        <div className="dg-form-footer"><button type="button" className="dg-secondary" onClick={onClose} disabled={pending} data-testid="button-private-cancel">Cancel</button>
          <button type="submit" className="dg-primary" disabled={pending} data-testid="button-private-save">{pending ? 'Saving…' : error ? 'Retry save' : product ? 'Save changes' : 'Create link'} <ArrowRight size={15} /></button></div>
      </form>
    </aside>
  </div>;
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const methodLabel: Record<string, string> = { cash: 'Cash', bank_transfer: 'Bank transfer', other: 'Other' };
type Method = 'cash' | 'bank_transfer' | 'other';

function MarkPaidDialog({ product, onClose, onDone }: { product: PrivateProduct; onClose: () => void; onDone: (text: string) => void }) {
  const queryClient = useQueryClient();
  const record = useRecordAdminPrivatePayment();
  const [method, setMethod] = useState<Method>('bank_transfer');
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const intent = useRef<{ key: string; requestId: string } | null>(null);
  const touch = () => { intent.current = null; setError(''); };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    if (!confirmed) { setError('Confirm that the full amount was actually received.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Choose the date the payment arrived.'); return; }
    const ref = reference.trim();
    const key = JSON.stringify([method, date, ref, product.name, product.priceCents]);
    if (!intent.current || intent.current.key !== key) intent.current = { key, requestId: newId() };
    try {
      const saved = await record.mutateAsync({ id: product.id, data: { requestId: intent.current.requestId, method, paymentDate: date, receivedFullPayment: true, expectedName: product.name, expectedPriceCents: product.priceCents, ...(ref ? { reference: ref } : {}) } });
      intent.current = null;
      queryClient.setQueryData<PrivateProduct[]>(getListAdminPrivateProductsQueryKey(), old => old?.map(item => item.id === saved.id ? saved : item));
      void queryClient.invalidateQueries({ queryKey: getListAdminPrivateProductsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListAdminPrivatePaymentsQueryKey() });
      onDone(`${saved.invoiceReference} marked as paid. Payment recorded by seller.`);
    } catch (reason) {
      setError(errorMessage(reason));
      void queryClient.invalidateQueries({ queryKey: getListAdminPrivateProductsQueryKey() });
    }
  };

  return <div className="dg-overlay dg-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !record.isPending) onClose(); }}>
    <form className="dg-confirm pl-markpaid" role="dialog" aria-modal="true" aria-labelledby="pl-paid-title" onSubmit={submit} data-testid="dialog-private-mark-paid">
      <span className="dg-confirm-icon"><BadgeCheck size={19} /></span>
      <h2 id="pl-paid-title">Mark {product.invoiceReference} as paid</h2>
      <p>Record a payment you received outside Stripe for <strong>{product.name}</strong>. The full invoice amount of <strong>{money(product.priceCents)}</strong> will be recorded and any open Stripe checkout for it is closed.</p>
      {error && <div className="dg-notice" role="alert" data-testid="status-private-paid-error">{error}</div>}
      <div className="pl-paid-fields">
        <label className="dg-field">Method<select value={method} onChange={event => { setMethod(event.target.value as Method); touch(); }} data-testid="select-private-paid-method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
        <label className="dg-field">Date received<input type="date" required max={today()} value={date} onChange={event => { setDate(event.target.value); touch(); }} data-testid="input-private-paid-date" /></label>
        <label className="dg-field pl-paid-wide">Reference <small>Optional</small><input maxLength={160} value={reference} onChange={event => { setReference(event.target.value); touch(); }} placeholder="e.g. transfer ID or receipt number" data-testid="input-private-paid-reference" /></label>
      </div>
      <label className="pl-confirm-check"><input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setError(''); }} data-testid="checkbox-private-paid-confirm" /><span>I confirm the full {money(product.priceCents)} was actually received.</span></label>
      <div className="dg-confirm-actions"><button type="button" className="dg-secondary" onClick={onClose} disabled={record.isPending} data-testid="button-private-paid-cancel">Cancel</button>
        <button type="submit" className="dg-primary" disabled={record.isPending || !confirmed} data-testid="button-private-paid-confirm">{record.isPending ? 'Recording…' : error ? 'Retry' : 'Mark as paid'}</button></div>
    </form>
  </div>;
}

const statusLabel: Record<string, string> = { open: 'Awaiting payment', processing: 'Processing', paid: 'Paid', expired: 'Expired' };

function Payments() {
  const payments = useListAdminPrivatePayments({ query: { queryKey: getListAdminPrivatePaymentsQueryKey(), refetchInterval: 15000 } });
  const rows: PrivatePayment[] = payments.data ?? [];
  return <section className="dg-panel pl-panel" data-testid="panel-private-payments">
    <div className="dg-panel-head"><div><h2>Latest private payments</h2><p>Stripe Checkout payments from private links. Separate from store orders.</p></div>
      <button type="button" className="dg-secondary" onClick={() => void payments.refetch()} disabled={payments.isFetching} data-testid="button-private-refresh-payments"><RefreshCw size={14} /> {payments.isFetching ? 'Checking…' : 'Refresh'}</button></div>
    {payments.isPending ? <div className="pl-pad"><div className="dg-skeleton" style={{ height: 48, marginBottom: 10 }} /><div className="dg-skeleton" style={{ height: 48 }} /></div>
      : payments.isError ? <div className="dg-empty" role="alert" data-testid="status-private-payments-error"><CircleAlert size={26} /><strong>Payments could not be loaded.</strong><p>{errorMessage(payments.error)}</p><button type="button" className="dg-secondary" onClick={() => void payments.refetch()} data-testid="button-private-retry-payments"><RefreshCw size={14} /> Try again</button></div>
      : !rows.length ? <div className="dg-empty" data-testid="status-private-payments-empty"><Link2 size={26} /><strong>No private payments yet</strong><p>Payments appear here once a customer completes Stripe Checkout.</p></div>
      : <div className="dg-table-wrap"><table className="dg-table"><thead><tr><th>Offer</th><th>Customer</th><th>Delivery</th><th>Amount</th><th>Status</th><th>Started</th></tr></thead><tbody>
        {rows.map(payment => { const a = payment.deliveryAddress; return <tr key={payment.sessionId} data-testid={`row-private-payment-${payment.sessionId}`}>
          <td data-label="Offer"><strong>{payment.productName}</strong></td>
          <td data-label="Customer">{payment.customerName || '—'}<small className="pl-sub">{payment.customerEmail || 'No email'}</small></td>
          <td data-label="Delivery">{a ? <span className="pl-address">{a.fullName}<small className="pl-sub">{[a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', ')}</small></span> : <span className="pl-sub">Not collected</span>}</td>
          <td data-label="Amount">{payment.amountCents == null ? '—' : money(payment.amountCents)}</td>
          <td data-label="Status"><span className={`pl-status pl-status-${payment.status}`} data-testid={`status-private-payment-${payment.sessionId}`}>{statusLabel[payment.status] ?? payment.status}</span></td>
          <td data-label="Started">{when(payment.createdAt)}</td>
        </tr>; })}
      </tbody></table></div>}
  </section>;
}

export default function PrivateProducts() {
  const queryClient = useQueryClient();
  const list = useListAdminPrivateProducts({ query: { queryKey: getListAdminPrivateProductsQueryKey(), refetchInterval: 15000 } });
  const update = useUpdateAdminPrivateProduct();
  const remove = useDeleteAdminPrivateProduct();
  const [editor, setEditor] = useState<PrivateProduct | null | undefined>(undefined);
  const [marking, setMarking] = useState<PrivateProduct | null>(null);
  const [archiving, setArchiving] = useState<PrivateProduct | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const preview = isPreviewHost();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListAdminPrivateProductsQueryKey() });

  const toggle = async (product: PrivateProduct) => {
    setBusyId(product.id); setNotice(null);
    try {
      await update.mutateAsync({ id: product.id, data: { active: !product.active, requestId: newId() } });
      await refresh();
      setNotice({ type: 'success', text: `${product.name} is ${product.active ? 'paused' : 'accepting payments again'}.` });
    } catch (reason) { setNotice({ type: 'error', text: `Could not ${product.active ? 'pause' : 'resume'} ${product.name}: ${errorMessage(reason)}` }); }
    finally { setBusyId(null); }
  };
  const archive = async () => {
    if (!archiving) return;
    const product = archiving;
    try {
      await remove.mutateAsync({ id: product.id });
      setArchiving(null);
      await refresh();
      setNotice({ type: 'success', text: `${product.name} was archived. Its link no longer works.` });
    } catch (reason) { setArchiving(null); setNotice({ type: 'error', text: `Could not archive ${product.name}: ${errorMessage(reason)}` }); }
  };
  const copy = async (product: PrivateProduct) => {
    const url = shareUrl(product.sharePath);
    if (await copyText(url)) { setManualCopy(null); setNotice({ type: 'success', text: preview ? 'Preview link copied. It only works in this development preview, not on your live store.' : 'Link copied.' }); }
    else { setManualCopy(url); setNotice({ type: 'error', text: 'Clipboard is unavailable. Copy the link from the box below.' }); }
  };
  const items = list.data ?? [];

  return <div className="pl-root" data-testid="section-private-links">
    {preview && <div className="pl-preview-banner" data-testid="status-private-preview-only"><CircleAlert size={16} /><span><strong>Development preview.</strong> Links copied here are preview-only and will not reach customers until the store is published.</span></div>}
    {notice && <div className={`dg-notice ${notice.type === 'success' ? 'success' : ''}`} role={notice.type === 'error' ? 'alert' : 'status'} data-testid="status-private-notice"><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}
    {manualCopy && <label className="dg-field pl-manual">Share link<input readOnly value={manualCopy} onFocus={event => event.currentTarget.select()} data-testid="input-private-manual-copy" /></label>}
    <section className="dg-panel pl-panel" data-testid="panel-private-links">
      <div className="dg-panel-head"><div><h2>Link-only offers</h2><p>Send a private link. Customers pay on Stripe. Never listed in the public catalog.</p></div>
        <button type="button" className="dg-primary" onClick={() => setEditor(null)} data-testid="button-private-add"><Plus size={16} /> New private link</button></div>
      {list.isPending ? <div className="pl-pad" data-testid="status-private-loading"><div className="dg-skeleton" style={{ height: 56, marginBottom: 10 }} /><div className="dg-skeleton" style={{ height: 56, marginBottom: 10 }} /><div className="dg-skeleton" style={{ height: 56 }} /></div>
        : list.isError ? <div className="dg-empty" role="alert" data-testid="status-private-load-error"><CircleAlert size={26} /><strong>Private links could not be loaded.</strong><p>{errorMessage(list.error)}</p><button type="button" className="dg-secondary" onClick={() => void list.refetch()} data-testid="button-private-retry"><RefreshCw size={14} /> Try again</button></div>
        : !items.length ? <div className="dg-empty" data-testid="status-private-empty"><Link2 size={26} /><strong>No private links yet</strong><p>Create an offer with just a name and a price, then share its link with a customer.</p><button type="button" className="dg-secondary" onClick={() => setEditor(null)} data-testid="button-private-add-empty"><Plus size={14} /> Create the first link</button></div>
        : <ul className="pl-list">{items.map(product => <li key={product.id} className={`pl-item ${product.active ? '' : 'is-paused'}`} data-testid={`row-private-product-${product.id}`}>
          <div className="pl-item-main">
            <strong data-testid={`text-private-name-${product.id}`}><span className="pl-ref">{product.invoiceReference}</span>{product.name}</strong>
            <div className="pl-tags">
              {product.invoiceStatus === 'paid'
                ? <span className="pl-status pl-status-paid" data-testid={`status-private-invoice-${product.id}`}>Paid{product.paidAt ? ` on ${new Date(product.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(product.paymentSource === 'seller' ? { timeZone: 'UTC' } : {}) })}` : ''}</span>
                : <span className="pl-status pl-status-open" data-testid={`status-private-invoice-${product.id}`}>Unpaid</span>}
              {product.invoiceStatus === 'paid' && <span className="pl-tag" data-testid={`text-private-source-${product.id}`}>{product.paymentSource === 'stripe' ? 'Paid through Stripe' : `Payment recorded by seller${product.paymentMethod ? ` / ${methodLabel[product.paymentMethod]}` : ''}`}</span>}
              {product.invoiceStatus !== 'paid' && <span className={`pl-status ${product.active ? 'pl-status-paid' : 'pl-status-expired'}`} data-testid={`status-private-active-${product.id}`}>{product.active ? 'Live link' : 'Paused'}</span>}
              {product.collectDelivery && <span className="pl-tag">Collects delivery</span>}
              {!product.livemode && (product.invoiceStatus !== 'paid' || product.paymentSource === 'stripe') && <span className="pl-tag pl-tag-test" data-testid={`status-private-testmode-${product.id}`}>Stripe test mode</span>}
              <span className="pl-sub">Created {when(product.createdAt)}</span>
            </div>
            <code className="pl-url" title={shareUrl(product.sharePath)}>{shareUrl(product.sharePath)}{preview && <em> preview only</em>}</code>
          </div>
          <div className="pl-price" data-testid={`text-private-price-${product.id}`}>{money(product.priceCents)}</div>
          <div className="dg-row-actions">
            <button type="button" className="dg-secondary" onClick={() => void copy(product)} data-testid={`button-private-copy-${product.id}`}><Copy size={14} /> {preview ? 'Copy preview link' : 'Copy link'}</button>
            {product.invoiceStatus !== 'paid' && <button type="button" className="dg-secondary" onClick={() => setMarking(product)} data-testid={`button-private-mark-paid-${product.id}`}><BadgeCheck size={14} /> Mark as paid</button>}
            {product.invoiceStatus !== 'paid' && <><button type="button" className="dg-icon-button" title={product.active ? 'Pause link' : 'Resume link'} aria-label={`${product.active ? 'Pause' : 'Resume'} ${product.name}`} disabled={busyId === product.id} onClick={() => void toggle(product)} data-testid={`button-private-toggle-${product.id}`}>{product.active ? <Pause size={16} /> : <Play size={16} />}</button>
            <button type="button" className="dg-icon-button" title="Edit" aria-label={`Edit ${product.name}`} onClick={() => setEditor(product)} data-testid={`button-private-edit-${product.id}`}><Pencil size={16} /></button></>}
            <button type="button" className="dg-icon-button dg-icon-danger" title="Archive" aria-label={`Archive ${product.name}`} onClick={() => setArchiving(product)} data-testid={`button-private-archive-${product.id}`}><Archive size={16} /></button>
          </div>
        </li>)}</ul>}
    </section>
    <Payments />
    {editor !== undefined && <LinkEditor key={editor?.id ?? 'new'} product={editor} onClose={() => setEditor(undefined)} onSaved={text => { setEditor(undefined); setNotice({ type: 'success', text }); }} />}
    {marking && <MarkPaidDialog key={marking.id} product={marking} onClose={() => setMarking(null)} onDone={text => { setMarking(null); setNotice({ type: 'success', text }); }} />}
    {archiving && <div className="dg-overlay dg-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !remove.isPending) setArchiving(null); }}>
      <div className="dg-confirm" role="alertdialog" aria-modal="true" aria-labelledby="pl-archive-title" data-testid="dialog-private-archive">
        <span className="dg-confirm-icon"><Archive size={19} /></span><h2 id="pl-archive-title">Archive this private link?</h2>
        <p>{archiving.name} will stop accepting payments and anyone holding the link will see it as unavailable. Past payments stay in the list.</p>
        <div className="dg-confirm-actions"><button type="button" className="dg-secondary" onClick={() => setArchiving(null)} disabled={remove.isPending} data-testid="button-private-archive-cancel">Keep link</button>
          <button type="button" className="dg-primary" onClick={() => void archive()} disabled={remove.isPending} data-testid="button-private-archive-confirm">{remove.isPending ? 'Archiving…' : 'Archive link'}</button></div>
      </div>
    </div>}
  </div>;
}
