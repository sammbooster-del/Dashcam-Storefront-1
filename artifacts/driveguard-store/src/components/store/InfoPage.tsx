import { type ReactNode, useEffect } from 'react';
import { Link } from 'wouter';
import { BackLink } from './BackLink';

export type InfoSection = { id: string; heading: string; body: ReactNode };

function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    const previousTitle = document.title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !tag;
    if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag); }
    const previousDescription = tag.content;
    document.title = title;
    tag.content = description;
    return () => {
      document.title = previousTitle;
      if (created) tag.remove(); else tag.content = previousDescription;
    };
  }, [title, description]);
}

export function InfoPage({ eyebrow, title, intro, meta, sections }: { eyebrow: string; title: string; intro: string; meta: { title: string; description: string }; sections: InfoSection[] }) {
  useDocumentMeta(meta.title, meta.description);
  return (
    <article className="container-store max-w-5xl py-12 md:py-16">
      <div className="mb-5"><BackLink /></div>
      <header className="rise max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand)' }}>{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl" tabIndex={-1}>{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
      </header>
      <div className="mt-10 grid gap-8 md:grid-cols-[200px_1fr] md:gap-12">
        <nav aria-label="On this page" className="hidden md:block">
          <ul className="sticky top-24 space-y-2 border-l pl-4 text-sm">
            {sections.map(s => <li key={s.id}><a href={`#${s.id}`} className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]">{s.heading}</a></li>)}
          </ul>
        </nav>
        <div className="space-y-5">
          {sections.map(s => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="panel scroll-mt-24 p-6 md:p-7">
              <h2 id={`${s.id}-h`} className="text-xl font-semibold">{s.heading}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

export const inlineLink = 'font-medium text-foreground underline underline-offset-4 decoration-[var(--brand)] transition-colors hover:text-[var(--brand)]';
export function ContactLink({ email, subject, label }: { email: string; subject: string; label?: string }) {
  return <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}`} className={inlineLink}>{label ?? email}</a>;
}
export function BackToShop() {
  return <Link href="/" className={inlineLink}>Continue shopping</Link>;
}
