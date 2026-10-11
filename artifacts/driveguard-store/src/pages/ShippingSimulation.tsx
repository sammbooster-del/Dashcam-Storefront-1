import { useEffect, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, Check, Loader2, Package, Truck } from 'lucide-react';
import { getGetShippingSimulationQueryKey, useCompleteShippingSimulation, useGetShippingSimulation } from '@workspace/api-client-react';
import { errorMessage } from '@/lib-store';

export default function ShippingSimulation() {
  const { token = '' } = useParams<{ token: string }>();
  const query = useGetShippingSimulation(token, { query: { queryKey: getGetShippingSimulationQueryKey(token), retry: false, refetchOnWindowFocus: true, staleTime: 0 } });
  const complete = useCompleteShippingSimulation();
  const [step, setStep] = useState<'review' | 'reference' | 'complete'>('review');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.title;
    document.title = 'Shipping simulation | Everyday Finds';
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow';
    document.head.append(meta, robots);
    return () => { document.title = previous; meta.remove(); robots.remove(); };
  }, []);
  useEffect(() => { setStep('review'); setReference(''); setError(''); }, [token]);
  const data = query.data;
  const amount = data ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.amountCents / 100) : '';
  return <div className="grain flex min-h-[100dvh] flex-col bg-background">
    <header className="border-b bg-background/90"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5"><Link href="/" className="display text-xl font-semibold">Everyday Finds</Link><span className="rounded-full border border-emerald-900/15 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-950">Internal simulation</span></div></header>
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} />Back to store</Link>
      {query.isPending ? <section aria-busy="true" className="panel p-10 text-center"><Loader2 className="mx-auto animate-spin" /><p className="mt-4" role="status">Loading shipping simulation…</p></section>
        : query.isError || !data ? <section className="panel p-8 text-center" role="alert"><h1 className="display text-2xl">This link isn’t available</h1><p className="mt-3 text-sm text-muted-foreground">{query.error ? errorMessage(query.error) : 'The link may be invalid or expired.'}</p><button type="button" className="btn mt-5" onClick={() => void query.refetch()}>Try again</button></section>
        : <section className="panel overflow-hidden">
          <div className="border-b bg-stone-50 px-6 py-7 sm:px-9">
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Truck size={15} />Shipping update</div>
            <h1 className="display text-3xl sm:text-4xl">{step === 'complete' ? 'Simulation complete' : step === 'reference' ? 'Complete your simulation' : 'Review your shipping'}</h1>
            <p className="mt-3 text-sm text-muted-foreground">Order {data.orderReference}</p>
          </div>
          <div className="px-6 py-7 sm:px-9">
            <ol aria-label="Simulation progress" className="mb-7 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {['Review', 'Dummy reference', 'Complete'].map((label, i) => <li key={label} className={(['review', 'reference', 'complete'].indexOf(step) === i) ? 'font-semibold text-foreground' : ''}>{i + 1}. {label}</li>)}
            </ol>
            <p className="mb-6 whitespace-pre-line text-sm leading-7">{data.message}</p>
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border bg-stone-50 p-5"><span className="flex items-center gap-2 text-sm"><Package size={18} />Shipping amount</span><strong className="text-2xl">{amount}</strong></div>
            {step === 'review' && <><p className="text-sm leading-6 text-muted-foreground">This internal simulation uses the dummy reference SIM-TEST. Continue to review and complete the simulation.</p><button type="button" className="btn mt-6 w-full sm:w-auto" onClick={() => setStep('reference')} data-testid="shipping-next">Next<ArrowRight size={16} /></button></>}
            {step === 'reference' && <form onSubmit={async event => {
              event.preventDefault(); setError('');
              try { const receipt = await complete.mutateAsync({ token, data: { testReference: 'SIM-TEST' } }); setReference(receipt.reference); setStep('complete'); }
              catch (e) { setError(errorMessage(e)); }
            }}>
              <label className="block text-sm font-semibold">Dummy reference<input readOnly value="SIM-TEST" className="mt-2 w-full rounded-xl border bg-stone-50 px-4 py-3 font-mono" data-testid="shipping-test-reference" /></label>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Only this built-in reference is accepted. Order and inventory records remain unchanged.</p>
              <div className="mt-6 flex flex-wrap gap-3"><button type="button" className="btn btn-ghost" disabled={complete.isPending} onClick={() => setStep('review')}><ArrowLeft size={16} />Back</button><button type="submit" className="btn" disabled={complete.isPending} data-testid="shipping-complete">{complete.isPending && <Loader2 size={16} className="animate-spin" />}{complete.isPending ? 'Completing…' : 'Complete simulation'}</button></div>
            </form>}
            {step === 'complete' && <div role="status"><div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Check size={25} /></div><h2 className="text-lg font-semibold">Shipping simulation completed</h2><p className="mt-2 break-all text-sm text-muted-foreground">Reference: {reference}</p><p className="mt-3 text-sm">Simulated shipping amount: <strong>{amount}</strong></p><Link href="/" className="btn mt-6">Continue shopping</Link></div>}
            {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
          </div>
        </section>}
    </main>
    <footer className="border-t px-5 py-6 text-center text-xs text-muted-foreground">Everyday Finds · Internal shipping simulation</footer>
  </div>;
}
