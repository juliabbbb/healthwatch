import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HEALTHWATCH" },
      {
        name: "description",
        content:
          "Preferences for the HEALTHWATCH dashboard, including the opt-in AI-assisted analysis feature.",
      },
      { property: "og:title", content: "Settings — HEALTHWATCH" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [aiEnabled, setAiEnabled] = useAiAnalysisSetting();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Dashboard preferences. Everything here is stored locally in your browser.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card/40 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Sparkles className="size-4 text-primary" /> AI-assisted analysis
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              When on, viewing a region page sends that region&apos;s structured pipeline metrics
              (forecast, risk tier and validation accuracy) to Claude to generate a short
              plain-language summary. The AI only explains numbers HEALTHWATCH already computed — it
              never produces its own forecast or risk tier. This is off by default and each view
              makes one outbound request when enabled.
            </p>
          </div>
          <ToggleSwitch checked={aiEnabled} onChange={setAiEnabled} label="AI-assisted analysis" />
        </div>
      </section>
    </main>
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
