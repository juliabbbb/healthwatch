import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { dataReady } from "@/lib/healthwatch/data";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/hooks/use-theme";

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
      { title: "HEALTHWATCH — Philippine Outbreak Forecasting" },
      {
        name: "description",
        content:
          "Regional time-series analysis for seasonal illness outbreak prediction and hotspot classification in the Philippines.",
      },
      { property: "og:site_name", content: "HEALTHWATCH" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        // Schibsted Grotesk — digital-first grotesque for UI. Clean, precise,
        // Notion × Apple polish: humanist warmth without decorative weight.
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;450;500;600;700&display=swap",
      },
      {
        // JetBrains Mono — technical/numeric UI (codes, metrics, timestamps).
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            // Apply the persisted theme before first paint to avoid a flash
            // of the wrong palette (React syncs the icon after hydration).
            __html:
              'try{if(localStorage.getItem("healthwatch:theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}',
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function DataGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf: number;
    let done = false;

    const tick = (now: number) => {
      if (done) return;
      const elapsed = now - start;
      // ease-out: fast start, slows toward 92%
      const raw = 1 - Math.exp(-elapsed / 2000);
      const pct = Math.min(Math.round(raw * 92), 92);
      setProgress(pct);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    dataReady
      .then(() => {
        done = true;
        cancelAnimationFrame(raf);
        setProgress(100);
        setFading(true);
        setTimeout(() => setState("ready"), 350);
      })
      .catch((err: unknown) => {
        done = true;
        cancelAnimationFrame(raf);
        console.error("Failed to load HEALTHWATCH data from API", err);
        setState("error");
      });

    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [attempt]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
        <div className="w-64">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Loading HealthWatch
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%`, opacity: fading ? 0 : 1 }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Surveillance API unreachable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            HEALTHWATCH could not load case data. Make sure the backend is running (uvicorn
            src.api:app --port 8000).
          </p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setProgress(0);
              setAttempt((a) => a + 1);
            }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-xs transition-colors hover:bg-primary/20"
          >
            Retry connection
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [theme] = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <DataGate>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </DataGate>
      <Toaster theme={theme} position="top-center" toastOptions={{ duration: 3000 }} />
    </QueryClientProvider>
  );
}
