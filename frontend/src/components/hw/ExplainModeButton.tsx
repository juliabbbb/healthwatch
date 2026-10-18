/**
 * ExplainModeButton.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained "?" button that activates Explain Mode on any page.
 * Owns its own useExplainMode state and renders <ExplainOverlay> via portal —
 * no parent wiring needed beyond dropping <ExplainModeButton /> in the header.
 */

import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExplainMode } from "@/hooks/useTour";
import { ExplainOverlay } from "@/components/hw/ExplainOverlay";

interface ExplainModeButtonProps {
  className?: string;
}

export function ExplainModeButton({ className }: ExplainModeButtonProps) {
  const { explainActive, toggleExplain, exitExplain } = useExplainMode();

  return (
    <>
      <button
        type="button"
        id="hw-tour-btn"
        onClick={toggleExplain}
        aria-pressed={explainActive}
        aria-label={
          explainActive
            ? "Exit Explain Mode"
            : "Explain Mode — click anything to learn what it does"
        }
        title={
          explainActive
            ? "Exit Explain Mode"
            : "Explain Mode — click anything to learn what it does"
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          explainActive
            ? "border-primary/60 bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60",
          className,
        )}
      >
        <HelpCircle className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{explainActive ? "Exit Explain" : "Explain"}</span>
      </button>

      <ExplainOverlay active={explainActive} onExit={exitExplain} />
    </>
  );
}
