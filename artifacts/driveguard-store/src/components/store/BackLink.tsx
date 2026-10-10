import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href = '/', children = 'Back to shop' }: { href?: string; children?: string }) {
  return <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)]" data-testid="link-back">
    <ArrowLeft size={16} aria-hidden="true" />{children}
  </Link>;
}
