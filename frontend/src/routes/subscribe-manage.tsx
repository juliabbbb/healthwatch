import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { REGIONS } from "@/lib/healthwatch/data";
import {
  getSubscription,
  unsubscribeSubscription,
  updateSubscription,
  type SubscriptionPrefs,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/subscribe-manage")({
  head: () => ({
    meta: [
      { title: "Manage Subscription — HealthWatch" },
      {
        name: "description",
        content:
          "Update which regions and illnesses your monthly HealthWatch forecast report covers, or unsubscribe.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { token?: string } => {
    const raw = search["token"];
    return typeof raw === "string" ? { token: raw } : {};
  },
  component: SubscriptionManager,
});

const ILLNESS_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Illnesses" },
  { id: "dengue", label: "Dengue" },
];

function SubscriptionManager() {
  const { token } = useSearch({ from: "/subscribe-manage" });

  const [prefs, setPrefs] = useState<SubscriptionPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [illness, setIllness] = useState("all");
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError("This link is missing its subscription token.");
      return;
    }
    let cancelled = false;
    getSubscription(token)
      .then((p) => {
        if (cancelled) return;
        setPrefs(p);
        setIllness(p.illness);
        const hasCustom = p.regions.length > 0;
        setAllRegions(!hasCustom);
        setSelectedRegions(new Set(p.regions));
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Couldn't load this subscription. The link may be invalid.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleRegion = (code: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setAllRegions(false);
  };

  const handleSave = async () => {
    if (!token || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSubscription(
        token,
        allRegions ? [] : [...selectedRegions],
        illness,
      );
      setPrefs(updated);
      setMessage("Preferences saved. They'll apply from the next monthly report.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!token || unsubscribing) return;
    if (!window.confirm("Unsubscribe from monthly forecast reports? You can re-subscribe anytime.")) {
      return;
    }
    setUnsubscribing(true);
    setMessage(null);
    try {
      await unsubscribeSubscription(token);
      setPrefs((prev) => (prev ? { ...prev, active: false } : prev));
      setMessage("You're unsubscribed. No further reports will be sent.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't unsubscribe right now.");
    } finally {
      setUnsubscribing(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Manage Subscription</h1>
      <p className="label-caps mt-1.5 text-[10px] text-muted-foreground">
        Monthly HealthWatch forecast reports
      </p>

      <div className="mt-8 space-y-6">
        {loading && (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading subscription…
          </div>
        )}

        {loadError && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-destructive">
              {loadError}
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ArrowLeft className="size-3.5" /> Return to the dashboard
            </Link>
          </div>
        )}

        {!loading && !loadError && prefs && (
          <>
            {/* Status card */}
            <div className="rounded-xl border border-border/70 bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{prefs.email}</p>
                  <p className="label-caps mt-1 text-[10px] text-muted-foreground">
                    Subscribed since {new Date(prefs.created_at).toLocaleDateString()}
                    {prefs.last_sent_at ? ` · last report ${prefs.last_sent_at}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold",
                    prefs.active
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {prefs.active ? "Active" : "Unsubscribed"}
                </span>
              </div>
            </div>

            {/* Filters */}
            {prefs.active && (
              <div className="rounded-xl border border-border/70 bg-card p-5 space-y-5">
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
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-border/70 p-2 hw-scroll">
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {REGIONS.map((r) => (
                          <button
                            type="button"
                            key={r.code}
                            onClick={() => toggleRegion(r.code)}
                            title={r.name}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                              selectedRegions.has(r.code)
                                ? "bg-primary/15 font-semibold text-primary"
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

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    {saving ? "Saving…" : "Save preferences"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnsubscribe()}
                    disabled={unsubscribing}
                    className="flex items-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {unsubscribing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {unsubscribing ? "Unsubscribing…" : "Unsubscribe"}
                  </button>
                  {message && (
                    <p className="text-xs text-muted-foreground">
                      {message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!prefs.active && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" />
                This subscription is inactive. To restart monthly reports, open the dashboard and
                subscribe with this email again.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}