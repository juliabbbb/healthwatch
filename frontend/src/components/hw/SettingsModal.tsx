import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import { cn } from "@/lib/utils";

/**
 * Global settings surface (replaces the former /settings route). Lightweight
 * modal so preferences never require leaving the current view.
 */
export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [aiEnabled, setAiEnabled] = useAiAnalysisSetting();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-black/50 backdrop-blur-md"
        className="z-[600] glass-panel max-w-md gap-0 rounded-xl border-border/70 p-5"
      >
        <DialogTitle className="font-display text-lg">Settings</DialogTitle>
        <DialogDescription className="mt-1 text-xs">
          Dashboard preferences, stored locally in your browser.
        </DialogDescription>

        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-card/60 p-3.5">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-3.5 text-primary" /> AI-assisted analysis
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              When on, right-clicking Seasonality charts — and the region page panel — sends this
              region&apos;s pipeline-computed metrics to the configured AI model (Google Gemini or
              Claude) for a short plain-language explanation. The AI only narrates numbers
              HEALTHWATCH already computed; it never forecasts or classifies on its own. Off by
              default; each use makes one outbound request when enabled.
            </p>
          </div>
          <ToggleSwitch checked={aiEnabled} onChange={setAiEnabled} label="AI-assisted analysis" />
        </div>
      </DialogContent>
    </Dialog>
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
        "relative mt-1 h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-primary/60 bg-primary/70" : "border-border bg-secondary",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-[18px] rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
