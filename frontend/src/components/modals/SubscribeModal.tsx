import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  REGIONS,
  formatMetric,
  type MetricMode,
  type RiskLevel,
} from "@/lib/healthwatch/data";
import { RiskBadge } from "@/components/hw/RiskBadge";
import {
  subscribe,
  type SubscriptionReport,
  type SubscriptionTier,
  type SubscriptionTrend,
} from "@/lib/subscriptions";

const PERCAP: MetricMode = "percapita";

const ILLNESS_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Illnesses" },
  { id: "dengue", label: "Dengue" },
];

const tierToRisk = (tier: SubscriptionTier): RiskLevel => tier.toLowerCase() as RiskLevel;

const trendLabel: Record<SubscriptionTrend, string> = {
  up: "▲ up vs 3 mo",
  down: "▼ down vs 3 mo",
  stable: "— stable vs 3 mo",
};

export function SubscribeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useBodyScrollLock(open);
  const [email, setEmail] = useState("");
  const [illness, setIllness] = useState("all");
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SubscriptionReport | null>(null);
  const [provider, setProvider] = useState<"resend" | "dry-run" | null>(null);
  const [recipient, setRecipient] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setIllness("all");
      setAllRegions(true);
      setSelectedRegions(new Set());
      setLoading(false);
      setError(null);
      setDone(null);
      setProvider(null);
      setRecipient("");
    }
  }, [open]);

  const emailValid = useMemo(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()), [email]);

  const toggleRegion = (code: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setAllRegions(false);
  };

  const handleSubmit = async () => {
    if (!emailValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await subscribe(email.trim(), allRegions ? [] : [...selectedRegions], illness);
      setDone(res.report);
      setProvider(res.provider);
      setRecipient(res.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not subscribe right now.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const featured = done ? done.regions.slice(0, done.featured_count) : [];

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ zIndex: 9998 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-150"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subscribe to monthly forecast reports"
        style={{ zIndex: 9999 }}
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-6"
      >
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto hw-scroll rounded-2xl border border-border/80 bg-card shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-primary/15 p-2 text-primary">
                <Mail className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Monthly Forecast Reports</h2>
                <p className="label-caps text-[10px] text-muted-foreground">
                  Regional Outbreak Hotspot Map &amp; Forecasts
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Close subscribe modal"
            >
              <X className="size-4" />
            </button>
          </div>

          {done ? (
            /* ------------------------- Success preview ------------------------- */
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
                <div className="rounded-full bg-primary p-2 text-primary">
                  <Check className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    You're subscribed to the {done.month} forecast
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {provider === "resend"
                      ? `The report is on its way to ${recipient}. A fresh outlook will arrive by email each month.`
                      : `Mail delivery isn't configured on this server, so this report was logged to the email outbox (dry-run). Here's this month's outlook:`}
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-border/70 bg-background/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Heads up:</span> monthly email
                delivery isn't live yet — we're rolling it out soon. Your subscription is saved,
                and reports will start arriving by email once delivery is switched on. Thanks for
                trying it out!
              </p>

              {/* Scope + national summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 p-4">
                <div>
                  <p className="label-caps text-[10px] text-muted-foreground">Forecast · {done.month}</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{done.scope_label}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-foreground">
                    {formatMetric(done.national.value, PERCAP)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      per 100k
                    </span>
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <RiskBadge risk={tierToRisk(done.national.tier)} />
                    <span className="label-caps text-[10px] text-muted-foreground">
                      {trendLabel[done.national.trend]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Featured regions */}
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                {featured.map((r) => (
                  <li key={r.code} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="label-caps text-[10px] text-muted-foreground">
                        {trendLabel[r.trend]} · {r.pct_change >= 0 ? "+" : ""}
                        {r.pct_change}%
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="font-mono text-sm text-foreground">
                        {formatMetric(r.value, PERCAP)}
                      </span>
                      <RiskBadge risk={tierToRisk(r.tier)} />
                    </div>
                  </li>
                ))}
              </ul>
              {done.total_regions > featured.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the highest-risk of {done.total_regions} regions — the full regional
                  breakdown ships in your email.
                </p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ----------------------------- Form ----------------------------- */
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Get a clean, plain-language forecast by email each month — key figures, risk tier,
                and trend for the regions you care about. No account needed to subscribe.
              </p>

              {/* Email */}
              <div>
                <label htmlFor="sub-email" className="label-caps text-[10px] text-muted-foreground">
                  Email address
                </label>
                <input
                  id="sub-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              {/* Illness */}
              <div>
                <span className="label-caps text-[10px] text-muted-foreground">Illness</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ILLNESS_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setIllness(opt.id)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        illness === opt.id
                          ? "bg-primary text-white"
                          : "border border-border/80 bg-background text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region scope */}
              <div>
                <span className="label-caps text-[10px] text-muted-foreground">Regions</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAllRegions(true);
                      setSelectedRegions(new Set());
                    }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      allRegions
                        ? "bg-primary text-white"
                        : "border border-border/80 bg-background text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    All 18 regions
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllRegions(false)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      !allRegions
                        ? "bg-primary text-white"
                        : "border border-border/80 bg-background text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    Pick specific…
                  </button>
                </div>

                {!allRegions && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border/70 p-2 hw-scroll">
                    <div className="grid grid-cols-2 gap-1.5">
                      {REGIONS.map((r) => (
                        <button
                          type="button"
                          key={r.code}
                          onClick={() => toggleRegion(r.code)}
                          title={r.name}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                            selectedRegions.has(r.code)
                              ? "bg-primary/15 text-primary font-semibold"
                              : "bg-background text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full border",
                              selectedRegions.has(r.code)
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/50",
                            )}
                          />
                          <span className="truncate">{r.short}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Email-only, no login required.
                  <br />
                  Unsubscribe anytime from any report.
                </p>
                <button
                  type="submit"
                  disabled={!emailValid || loading}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {loading && <Loader2 className="size-3.5 animate-spin" />}
                  {loading ? "Subscribing…" : "Subscribe to the monthly report"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}