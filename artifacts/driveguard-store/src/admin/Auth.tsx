import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useQueryClient } from '@tanstack/react-query';
import { getGetAdminMeQueryKey, useGetAdminMe } from '@workspace/api-client-react';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import AdminPage from './AdminPage';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#c92525',
    colorForeground: '#222222',
    colorMutedForeground: '#5d5d5d',
    colorDanger: '#b11f1f',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#222222',
    colorNeutral: '#777777',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '4px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-sm w-[440px] max-w-full overflow-hidden border border-[#dddddd] shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#222222] font-bold',
    headerSubtitle: 'text-[#555555]',
    socialButtonsBlockButtonText: 'text-[#222222]',
    formFieldLabel: 'text-[#222222]',
    footerActionLink: 'text-[#b11f1f] font-bold',
    footerActionText: 'text-[#555555]',
    dividerText: 'text-[#555555]',
    identityPreviewEditButton: 'text-[#b11f1f]',
    formFieldSuccessText: 'text-[#277042]',
    alertText: 'text-[#622222]',
    logoBox: 'w-12 h-12',
    logoImage: 'w-12 h-12',
    socialButtonsBlockButton: 'border border-[#cccccc] bg-white',
    formButtonPrimary: 'bg-[#c92525] text-white hover:bg-[#a61d1d]',
    formFieldInput: 'border border-[#b7b7b7] bg-white text-[#222222]',
    footerAction: 'text-[#555555]',
    dividerLine: 'bg-[#bbbbbb]',
    alert: 'bg-[#fff2f2]',
    otpCodeFieldInput: 'bg-white text-[#222222]',
    formFieldRow: 'text-[#222222]',
    main: 'text-[#222222]',
  },
};

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

export function StoreClerkProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to manage DriveGuard' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Sign up to request access to DriveGuard' } },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkCacheInvalidator />
    {children}
  </ClerkProvider>;
}

function AuthShell({ children }: { children: ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#f5f5f5] px-4 py-10">
    <div className="mx-auto max-w-[440px]">
      <Link href="/" className="mb-9 inline-flex items-center gap-2 text-sm font-semibold text-[#444] hover:text-[#c92525]"><ArrowLeft size={16} /> Back to store</Link>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-sm bg-[#c92525] text-white"><ShieldCheck size={24} /></span>
        <div><p className="text-xl font-extrabold tracking-tight">DriveGuard</p><p className="text-xs font-medium text-[#666]">Store management</p></div>
      </div>
      {children}
      <p className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-[#666]"><LockKeyhole size={14} /> Access to store controls requires approval.</p>
    </div>
  </main>;
}

export function SignInPage() {
  return <AuthShell><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/admin`} /></AuthShell>;
}

export function SignUpPage() {
  return <AuthShell><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/admin`} /></AuthShell>;
}

export function AdminAccess() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const admin = useGetAdminMe({ query: { queryKey: getGetAdminMeQueryKey(), enabled: isLoaded && !!isSignedIn, retry: false, staleTime: 30000 } });

  if (!isLoaded) return <div className="grid min-h-[70dvh] place-items-center text-sm text-[#555]">Checking your session…</div>;
  if (!isSignedIn) return <div className="grid min-h-[70dvh] place-items-center bg-[#f7f7f7] px-4"><div className="max-w-md border border-[#ddd] bg-white p-8 text-center">
    <LockKeyhole className="mx-auto text-[#c92525]" size={30} /><h1 className="mt-4 text-2xl font-extrabold">Admin sign-in required</h1><p className="mt-3 text-sm leading-6 text-[#666]">Only approved store administrators can make changes.</p>
    <Link href="/sign-in" className="red-button mt-6">Sign in</Link><p className="mt-5"><Link href="/" className="text-sm text-[#666] underline">Return to store</Link></p>
  </div></div>;
  if (admin.isPending) return <div className="grid min-h-[70dvh] place-items-center text-sm text-[#555]">Verifying admin access…</div>;
  if (admin.isError || !admin.data?.isAdmin) return <div className="grid min-h-[70dvh] place-items-center bg-[#f7f7f7] px-4"><div className="max-w-md border border-[#ddd] bg-white p-8 text-center">
    <ShieldCheck className="mx-auto text-[#c92525]" size={30} /><h1 className="mt-4 text-2xl font-extrabold">Access unavailable</h1><p className="mt-3 text-sm leading-6 text-[#666]">This account is not approved for store administration, or admin verification is temporarily unavailable.</p>
    <button type="button" className="red-button mt-6" onClick={() => admin.refetch()}>Try again</button>
    <div className="mt-5 flex items-center justify-center gap-5 text-sm"><button type="button" className="underline" onClick={() => signOut({ redirectUrl: basePath || '/' })}>Sign out</button><Link href="/" className="underline">Return to store</Link></div>
  </div></div>;
  return <><div className="flex items-center justify-between bg-[#252525] px-5 py-2 text-xs text-white"><span>DriveGuard admin</span><button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="font-bold underline underline-offset-4">Sign out</button></div><AdminPage /></>;
}