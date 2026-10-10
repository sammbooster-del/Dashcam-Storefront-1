import type { ReactNode } from 'react';
import { getGetAccessStatusQueryKey, useGetAccessStatus } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { lookupVisitorCountry } from '@/lib/visitorCountryLookup';

export function RegionalAccessGate({ children }: { children: ReactNode }) {
  const access = useGetAccessStatus({
    query: { queryKey: getGetAccessStatusQueryKey(), retry: false, staleTime: 60_000, refetchOnWindowFocus: true, refetchInterval: 60_000 },
  });
  // Independently verify the browser's network, even when a hosting proxy
  // reports an allowed country. Neither check can override an India block.
  const needsBrowserLookup = access.isSuccess && access.data.allowed;
  const browserCountry = useQuery({
    queryKey: ['regional-preview-country'],
    queryFn: async () => {
      const country = await lookupVisitorCountry();
      if (!country) throw new Error('Location unavailable');
      return country;
    },
    enabled: needsBrowserLookup,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  if (access.isPending || (needsBrowserLookup && browserCountry.isPending)) {
    return <main className="grid min-h-[100dvh] place-items-center bg-background px-6" aria-busy="true">
      <p role="status" className="text-sm text-muted-foreground">Checking availability…</p>
    </main>;
  }
  const browserBlocked = needsBrowserLookup && browserCountry.data === 'IN';
  if (access.isError || !access.data?.allowed || browserBlocked || (needsBrowserLookup && browserCountry.isError)) {
    const blocked = access.error?.status === 403 || access.data?.code === 'REGION_BLOCKED' || browserBlocked;
    return <main className="grid min-h-[100dvh] place-items-center bg-background px-6">
      <section className="max-w-md text-center" role="alert">
        <p className="display mb-6 text-xl font-semibold">Everyday Finds</p>
        <h1 className="text-2xl font-semibold">{blocked ? 'Not available in your region' : 'Unable to check availability'}</h1>
        <p className="mt-3 text-muted-foreground">{blocked
          ? 'This store cannot be accessed from your location.'
          : 'We couldn’t verify your region. Please try again shortly.'}</p>
        {!blocked && <button type="button" className="btn mt-6" onClick={() => {
          void access.refetch();
          if (needsBrowserLookup) void browserCountry.refetch();
        }}>Try again</button>}
      </section>
    </main>;
  }
  return children;
}
