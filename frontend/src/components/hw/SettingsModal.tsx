import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import { cn } from "@/lib/utils";

/**
 * Global settings surface rendered as a raw portal modal (not Radix Dialog).
 * Using createPortal directly ensures the z-index is applied cleanly via
 * inline style, bypassing any Tailwind class-order specificity issues.
 * z-index 950 sits above mobile drawers (z-700) and all other panels.
 */
export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const [aiEnabled, setAiEnabled] = useAiAnalysisSetting();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop overlay */}
      <div
        style={{ zIndex: 9998 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-150"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Platform Settings"
        style={{ zIndex: 9999 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm sm:max-w-md glass-panel rounded-2xl border border-border/70 p-5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="text-lg font-bold text-foreground">Platform Settings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Dashboard preferences, stored locally in your browser.
            </p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0 mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Settings content */}
        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-border/80 bg-secondary/40 p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> AI-assisted analysis
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              When enabled, right-clicking Seasonality charts and regional forecast panels sends
              calculated surveillance metrics to the configured AI model for plain-language outbreak
              interpretation. Off by default.
            </p>
          </div>
          <ToggleSwitch checked={aiEnabled} onChange={setAiEnabled} label="AI-assisted analysis" />
        </div>
      </div>
    </>,
    document.body,
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mt-1 h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer active:scale-95",
        checked ? "border-primary/60 bg-primary/80" : "border-border/80 bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-[18px] rounded-full bg-background shadow-md transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
