import { useEffect, useRef, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import {
  Route,
  Switch,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import {
  BudgetPage,
  CommitmentsPage,
  DashboardPage,
  InsightsPage,
  NotificationsPage,
  SavingsPage,
  SettingsPage,
  SimulatorPage,
  SubscriptionsPage,
  TransactionsPage,
} from "@/pages/finsync-pages";
import { AppShell, LandingPage } from "@/pages/finsync-shell";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.PROD
  ? `${window.location.origin}/api/__clerk`
  : undefined;
if (!clerkPubKey)
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#55c483",
    colorForeground: "#eaf4ed",
    colorMutedForeground: "#9aafa0",
    colorDanger: "#ee7770",
    colorBackground: "#13231b",
    colorInput: "#1a2c22",
    colorInputForeground: "#eff8f1",
    colorNeutral: "#375344",
    fontFamily: "DM Sans",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[#13231b] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#294235]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#f0f7f1] font-semibold",
    headerSubtitle: "text-[#a7b9aa]",
    socialButtonsBlockButtonText: "text-[#e5f2e8]",
    formFieldLabel: "text-[#dce9df]",
    footerActionLink: "text-[#69d493]",
    footerActionText: "text-[#a7b9aa]",
    dividerText: "text-[#a7b9aa]",
    identityPreviewEditButton: "text-[#69d493]",
    formFieldSuccessText: "text-[#69d493]",
    alertText: "text-[#f4e9d4]",
    logoBox: "rounded-lg",
    logoImage: "rounded-lg",
    socialButtonsBlockButton: "border border-[#355141] bg-[#192c21]",
    formButtonPrimary: "bg-[#55c483] text-[#102016] hover:bg-[#6bd392]",
    formFieldInput: "bg-[#1a2c22] border-[#3b5a47] text-[#eff8f1]",
    footerAction: "border-t border-[#2b4335]",
    dividerLine: "bg-[#355141]",
    alert: "bg-[#332923] border-[#69513a]",
    otpCodeFieldInput: "bg-[#1a2c22] border-[#3b5a47] text-[#eff8f1]",
    formFieldRow: "text-[#dce9df]",
    main: "text-[#eaf4ed]",
  },
};

function SignInPage() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="absolute left-7 top-7 flex items-center gap-3 text-foreground">
        <img src={`${basePath}/logo.svg`} className="h-9 w-9" alt="FINSync" />
        <span className="font-display font-bold tracking-tight">FINSync</span>
      </div>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="absolute left-7 top-7 flex items-center gap-3 text-foreground">
        <img src={`${basePath}/logo.svg`} className="h-9 w-9" alt="FINSync" />
        <span className="font-display font-bold tracking-tight">FINSync</span>
      </div>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </main>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function Protected({ children }: { children: ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      )
        client.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function RouterContent() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Your money plan is right where you left it.",
          },
        },
        signUp: {
          start: {
            title: "Make room for your goals",
            subtitle: "Build a thoughtful money routine, one day at a time.",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard">
            <Protected>
              <AppShell>
                <DashboardPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/transactions">
            <Protected>
              <AppShell>
                <TransactionsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/budget">
            <Protected>
              <AppShell>
                <BudgetPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/savings">
            <Protected>
              <AppShell>
                <SavingsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/commitments">
            <Protected>
              <AppShell>
                <CommitmentsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/subscriptions">
            <Protected>
              <AppShell>
                <SubscriptionsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/simulator">
            <Protected>
              <AppShell>
                <SimulatorPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/insights">
            <Protected>
              <AppShell>
                <InsightsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/notifications">
            <Protected>
              <AppShell>
                <NotificationsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route path="/settings">
            <Protected>
              <AppShell>
                <SettingsPage />
              </AppShell>
            </Protected>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ErrorBoundary>
          <RouterContent />
        </ErrorBoundary>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
