import { useEffect } from 'react';
import { Link } from 'wouter';

export default function UnavailableLink() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Link unavailable | Everyday Finds';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow';
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    document.head.append(robots, referrer);
    return () => { document.title = previous; robots.remove(); referrer.remove(); };
  }, []);

  return <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12">
    <section className="panel w-full max-w-lg p-8 text-center sm:p-12">
      <p className="display text-xl font-semibold">Everyday Finds</p>
      <h1 className="display mt-6 text-3xl">This link is no longer available</h1>
      <p className="mt-4 text-sm text-muted-foreground">The linked page has been removed.</p>
      <Link href="/" className="btn mt-7">Back to store</Link>
    </section>
  </main>;
}
