import { useEffect, useState } from "react";
import { HelpCircle, X, Sparkles, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplainModeBannerProps {
  active: boolean;
  onStart: () => void;
  onExit: () => void;
}

const DISMISS_KEY = "healthwatch:explain_prompt_dismissed";

export function ExplainModeBanner({ active, onStart, onExit }: ExplainModeBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem(DISMISS_KEY) === "true";
      setDismissed(isDismissed);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // ignore
    }
  };

  // 1. When Explain Mode is actively running, show a sticky, unmistakable status banner
  if (active) {
    return (
      <aside
        aria-label="Explain mode status"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9970] flex items-center gap-3 rounded-full border border-primary/60 bg-card/95 backdrop-blur-md px-4 py-2 shadow-xl animate-in slide-in-from-top-4 duration-200"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-primary">
          <HelpCircle className="size-4 animate-pulse shrink-0" />
          <span>Explain Mode Active · Click any highlighted element to inspect its methodology</span>
        </span>
        <button
          type="button"
          onClick={onExit}
          className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
        >
          Done
        </button>
      </aside>
    );
  }

  // 2. When Explain Mode is NOT active, show a subtle, discoverable onboarding hint if not dismissed
  if (!dismissed) {
    return (
      <aside
        aria-label="Explain mode discovery tip"
        className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-40 max-w-sm rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md p-3.5 shadow-lg animate-in slide-in-from-bottom-3 duration-300"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span>Interactive Inspector Available</span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss discovery tip"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Not sure what a metric or chart means? Click the{" "}
          <strong className="text-foreground">Explain</strong> button in the top bar to inspect
          formulas, data origins, and clinical guidance for any element.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              handleDismiss();
              onStart();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Eye className="size-3.5" />
            <span>Try Explain Mode</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            Got it
          </button>
        </div>
      </aside>
    );
  }

  return null;
}

