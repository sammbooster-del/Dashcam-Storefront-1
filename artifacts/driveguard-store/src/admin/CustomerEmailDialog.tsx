import { type FormEvent, useRef, useState } from 'react';
import { useSendAdminEmail, useSendAdminOrderEmail, type DemoOrder, type OrderEmailSendResult } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Mail } from 'lucide-react';
import './CustomerEmailDialog.css';

type Props = {
  order?: Pick<DemoOrder, 'id' | 'contactEmail'>;
  onClose: () => void;
  onSent: (result: OrderEmailSendResult) => void;
};

export default function CustomerEmailDialog({ order, onClose, onSent }: Props) {
  const [recipientEmail, setRecipientEmail] = useState(order?.contactEmail ?? '');
  const [subject, setSubject] = useState(order ? `Regarding your order #${order.id}` : '');
  const [message, setMessage] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const sending = useRef(false);
  const previousFocus = useRef(document.activeElement);
  const orderSend = useSendAdminOrderEmail();
  const standaloneSend = useSendAdminEmail();
  const send = order ? orderSend : standaloneSend;
  const hasButton = Boolean(buttonText.trim() || buttonUrl.trim());
  let buttonLinkValid = false;
  try {
    const url = new URL(buttonUrl.trim());
    buttonLinkValid = url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      !/[\u0000-\u0020\u007f]/.test(buttonUrl.trim()) &&
      (['checkout.stripe.com', 'buy.stripe.com'].includes(url.hostname) ||
        (url.origin === window.location.origin && /^\/private-product\/[a-f0-9]{64}$/.test(url.pathname) && !url.search && !url.hash));
  } catch { /* Incomplete input is shown below, never used as a preview link. */ }
  const buttonReady = !hasButton || Boolean(buttonText.trim() && !/[\r\n]/.test(buttonText) && buttonLinkValid);
  const ready = Boolean(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()) && subject.trim() && message.trim() && !/[\r\n]/.test(subject) && buttonReady);

  const change = (field: 'recipientEmail' | 'subject' | 'message' | 'buttonText' | 'buttonUrl', value: string) => {
    if (sending.current) return;
    if (field === 'recipientEmail') setRecipientEmail(value);
    else if (field === 'subject') setSubject(value);
    else if (field === 'message') setMessage(value);
    else if (field === 'buttonText') setButtonText(value);
    else setButtonUrl(value);
    setRequestId(crypto.randomUUID());
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || sending.current) return;
    sending.current = true;
    setError('');
    try {
      const data = {
        subject: subject.trim(), message: message.trim(), requestId,
        ...(hasButton ? { buttonText: buttonText.trim(), buttonUrl: buttonUrl.trim() } : {}),
      };
      const result = order
        ? await orderSend.mutateAsync({ id: order.id, data })
        : await standaloneSend.mutateAsync({ data: { ...data, recipientEmail: recipientEmail.trim() } });
      onSent(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this email. Please try again.');
    } finally { sending.current = false; }
  };

  return <Dialog open onOpenChange={open => { if (!open && !sending.current) onClose(); }}>
    <DialogContent aria-modal={true} className="dg-email-dialog max-h-[90dvh] overflow-y-auto rounded-lg bg-white sm:max-w-xl"
      onEscapeKeyDown={event => { if (sending.current) event.preventDefault(); }}
      onInteractOutside={event => { if (sending.current) event.preventDefault(); }}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
      }}>
      <DialogTitle className="flex items-center gap-2"><Mail size={20} />{order ? `Email customer · Order #${order.id}` : 'Send custom email'}</DialogTitle>
      <DialogDescription>{order ? 'Write a message to this order’s customer using your store’s email sender.' : 'Email any recipient using your store’s verified sender. No order is required.'}</DialogDescription>
      <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={send.isPending}>
        <label className="dg-field">To
          <input type="email" required maxLength={254} readOnly={Boolean(order)} value={recipientEmail}
            disabled={send.isPending} onChange={event => change('recipientEmail', event.target.value)}
            placeholder="customer@example.com" data-testid="input-admin-email-recipient" />
        </label>
        <fieldset className="dg-email-button-fields">
          <legend>Button (optional)</legend>
          <label className="dg-field">Button text
            <input maxLength={80} value={buttonText} disabled={send.isPending} required={hasButton}
              placeholder="View your private offer" onChange={event => change('buttonText', event.target.value)}
              data-testid="input-admin-email-button-text" />
          </label>
          <label className="dg-field">Button link
            <input type="url" maxLength={2048} value={buttonUrl} disabled={send.isPending} required={hasButton}
              placeholder="https://…" onChange={event => change('buttonUrl', event.target.value)}
              aria-describedby="admin-email-button-help" data-testid="input-admin-email-button-url" />
          </label>
          <small id="admin-email-button-help">Paste an active link from Private links, or a Stripe-hosted payment link. Leave both fields empty to send without a button.</small>
          {hasButton && !buttonReady && <p className="dg-email-button-error" role="status">Add both button text and a valid HTTPS private Stripe or Stripe-hosted payment link.</p>}
        </fieldset>
        <button type="button" className="dg-secondary" onClick={() => setShowPreview(value => !value)}
          aria-expanded={showPreview} aria-controls="admin-customer-email-preview" data-testid="button-admin-email-preview">
          {showPreview ? 'Hide preview' : 'Preview email'}
        </button>
        {showPreview && <section id="admin-customer-email-preview" className="dg-email-preview" aria-label="Email preview" data-testid="preview-admin-customer-email">
          <header>To: {recipientEmail}<strong>{subject.trim() || 'Your email subject'}</strong></header>
          <p>{message.trim() || 'Your message will appear here.'}</p>
          {hasButton && buttonReady && <div className="dg-email-preview-action">
            <span className="dg-email-preview-button" data-testid="preview-admin-email-button">{buttonText.trim()}</span>
            <small>{buttonUrl.trim()}</small>
          </div>}
          <footer>Questions? Reply to this email.</footer>
        </section>}
        <label className="dg-field">Subject
          <input required maxLength={200} value={subject} disabled={send.isPending}
            onChange={event => change('subject', event.target.value)} data-testid="input-admin-email-subject" />
        </label>
        <label className="dg-field">Message
          <textarea required maxLength={10000} rows={8} value={message} disabled={send.isPending}
            onChange={event => change('message', event.target.value)} data-testid="input-admin-email-message"
            placeholder="Write your message here…" style={{ minHeight: 180, resize: 'vertical' }} />
          <small>{message.length.toLocaleString()} / 10,000 characters</small>
        </label>
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="text-admin-email-error">{error}</p>}
        <p className="text-xs text-muted-foreground">{order
          ? 'This sends an email only. It does not change the order or payment status.'
          : 'This sends an email only. It does not create an order or change any payment status.'}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="dg-secondary" disabled={send.isPending} onClick={onClose} data-testid="button-admin-email-cancel">Cancel</button>
          <button type="submit" className="dg-primary" disabled={!ready || send.isPending} data-testid="button-admin-email-send">
            {send.isPending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
