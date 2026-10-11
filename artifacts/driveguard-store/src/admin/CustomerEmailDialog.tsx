import { type FormEvent, useRef, useState } from 'react';
import { useSendAdminOrderEmail, type DemoOrder, type OrderEmailSendResult } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Mail } from 'lucide-react';
import './CustomerEmailDialog.css';

type Props = {
  order: Pick<DemoOrder, 'id' | 'contactEmail'>;
  onClose: () => void;
  onSent: (result: OrderEmailSendResult) => void;
};

export default function CustomerEmailDialog({ order, onClose, onSent }: Props) {
  const [subject, setSubject] = useState(`Regarding your order #${order.id}`);
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const sending = useRef(false);
  const previousFocus = useRef(document.activeElement);
  const send = useSendAdminOrderEmail();
  const ready = Boolean(order.contactEmail && subject.trim() && message.trim() && !/[\r\n]/.test(subject));

  const change = (field: 'subject' | 'message', value: string) => {
    if (sending.current) return;
    if (field === 'subject') setSubject(value); else setMessage(value);
    setRequestId(crypto.randomUUID());
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || sending.current) return;
    sending.current = true;
    setError('');
    try {
      const result = await send.mutateAsync({
        id: order.id, data: { subject: subject.trim(), message: message.trim(), requestId },
      });
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
      <DialogTitle className="flex items-center gap-2"><Mail size={20} />Email customer · Order #{order.id}</DialogTitle>
      <DialogDescription>Write a message to this order’s customer using your store’s email sender.</DialogDescription>
      <form onSubmit={event => void submit(event)} className="space-y-4" aria-busy={send.isPending}>
        <label className="dg-field">To
          <input type="email" readOnly value={order.contactEmail ?? ''} data-testid="input-admin-email-recipient" />
        </label>
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
        <p className="text-xs text-muted-foreground">This sends an email only. It does not change the order or payment status.</p>
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
