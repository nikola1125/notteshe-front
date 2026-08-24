import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SITE_URL, DEFAULT_OG_IMAGE, buildOrgJsonLd, buildWebSiteJsonLd } from "@/lib/seo";
import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { AuthModal } from "@/components/AuthModal";
import { RegionModal } from "@/components/RegionModal";
import { CurrencyRateProvider } from "@/components/Price";
import { getStorefrontConfig } from "@/lib/storefront";
import { DEFAULT_RATE } from "@/lib/currency";
import { useAuthStore } from "@/store/authStore";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { CookieBanner } from "@/components/CookieBanner";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Notteshe — Quiet clothes for loud lives" },
      { name: "description", content: "Considered essentials, cut for stillness and made to last. Shop the New Season 26 collection." },
      { property: "og:site_name", content: "Notteshe" },
      { property: "og:title", content: "Notteshe — Quiet clothes for loud lives" },
      { property: "og:description", content: "Considered essentials, cut for stillness and made to last." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@notteshe" },
      { name: "theme-color", content: "#0f0f0f" },
      { "script:ld+json": buildOrgJsonLd() },
      { "script:ld+json": buildWebSiteJsonLd() },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "canonical", href: SITE_URL },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  loader: () => getStorefrontConfig(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { rate } = Route.useLoaderData() ?? { rate: DEFAULT_RATE };
  const { authModalOpen, authModalMode, authModalCallback, closeAuthModal } = useAuthStore();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const [suspendedToast, setSuspendedToast] = useState(false);
  useSmoothScroll();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("auth_error") === "suspended") {
        setSuspendedToast(true);
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => setSuspendedToast(false), 6000);
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyRateProvider rate={rate}>
        {!isAdmin && <Header />}
        {!isAdmin && <CartDrawer />}
        {!isAdmin && <RegionModal />}
        {suspendedToast && (
          <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 border border-border bg-background px-6 py-3 shadow-lg">
            <p className="font-mono text-[11px] uppercase tracking-widest text-clay">Your account has been suspended. Please contact support.</p>
          </div>
        )}
        {!isAdmin && authModalOpen && (
          <AuthModal
            defaultMode={authModalMode}
            onClose={closeAuthModal}
            onSuccess={() => {
              authModalCallback?.();
              closeAuthModal();
            }}
          />
        )}
        <Outlet />
        {!isAdmin && <CookieBanner />}
      </CurrencyRateProvider>
    </QueryClientProvider>
  );
}
