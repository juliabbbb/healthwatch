import { useCallback, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";
const DISEASE = "Dengue";
const WINDOW = "last_12m";

interface MetricsData {
  region: string;
  mae: number;
  rmse: number;
  mape: number;
  skill_vs_naive_pct: number | null;
  confidence: { label: string; note: string };
}

interface OutbreakValidationData {
  scope: string;
  overall: {
    tp: number;
    fp: number;
    fn: number;
    tn: number;
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
}

const metricsCache = new Map<string, MetricsData>();

async function fetchMetrics(regionCode: string, signal?: AbortSignal): Promise<MetricsData> {
  const res = await fetch(
    `${API_BASE}/metrics/${encodeURIComponent(regionCode)}?disease=${DISEASE}&window=${WINDOW}`,
    { signal: signal ?? null },
  );
  if (!res.ok) throw new Error(`metrics ${res.status}`);
  return (await res.json()) as MetricsData;
}

async function fetchOutbreakValidation(signal?: AbortSignal): Promise<OutbreakValidationData> {
  const res = await fetch(`${API_BASE}/validation/outbreak`, { signal: signal ?? null });
  if (!res.ok) throw new Error(`validation ${res.status}`);
  return (await res.json()) as OutbreakValidationData;
}

function MetricTile({
  label,
  value,
  unit,
  context,
  quality,
}: {
  label: string;
  value: string;
  unit: string;
  context: string;
  quality?: "good" | "moderate" | "poor" | null;
}) {
  const color =
    quality === "good"
      ? "var(--risk-low-solid)"
      : quality === "moderate"
        ? "var(--risk-moderate-solid)"
        : quality === "poor"
          ? "var(--risk-high-solid)"
          : "var(--foreground)";

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2.5">
      <p className="label-caps text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold leading-none tracking-tight tabular-nums" style={{ color }}>
        {value}{unit}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{context}</p>
    </div>
  );
}

function mapeQuality(mape: number): "good" | "moderate" | "poor" {
  if (mape <= 20) return "good";
  if (mape <= 50) return "moderate";
  return "poor";
}

function accuracyLabel(frac: number | null): "good" | "moderate" | "poor" | null {
  if (frac == null) return null;
  if (frac >= 0.7) return "good";
  if (frac >= 0.4) return "moderate";
  return "poor";
}

/**
 * Two-panel validation readout: left = forecast accuracy (MAE/RMSE/MAPE + skill),
 * right = outbreak classification (precision/recall/F1 + counts). All numbers
 * come live from the API — no hardcoded figures.
 */
export function ValidationMetricsPanel({ regionCode }: { regionCode?: string }) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [outbreak, setOutbreak] = useState<OutbreakValidationData | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      try {
        const [m, o] = await Promise.all([
          regionCode ? fetchMetrics(regionCode, signal) : Promise.resolve(null),
          fetchOutbreakValidation(signal),
        ]);
        if (signal?.aborted) return;
        if (m) metricsCache.set(regionCode!, m);
        setMetrics(m ?? metricsCache.get(regionCode ?? "") ?? null);
        setOutbreak(o);
        setStatus("done");
      } catch (err) {
        if (signal?.aborted) return;
        setStatus("error");
      }
    },
    [regionCode],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const o = outbreak?.overall;
  const confidence = metrics?.confidence;

  if (status === "error" && !metrics && !outbreak) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <p>Validation metrics unavailable for this region. The rest of this page is unaffected.</p>
      </div>
    );
  }

  return (
    <div className={regionCode ? "grid gap-4 sm:grid-cols-2" : ""}>
      {/* Left: Forecast Accuracy (region-specific) */}
      {regionCode && (
        <div className="rounded-xl border border-border/80 bg-card/50 p-4">
          <p className="label-caps text-[10px] mb-2.5 text-muted-foreground">Forecast Accuracy</p>
        {status === "loading" && !metrics ? (
          <div className="space-y-2">
            <div className="h-16 w-full animate-pulse rounded bg-secondary" />
          </div>
        ) : metrics ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MetricTile label="MAE" value={metrics.mae.toLocaleString()} unit="" context="Mean Absolute Error" />
              <MetricTile label="RMSE" value={metrics.rmse.toLocaleString()} unit="" context="Root Mean Squared Error" />
              <MetricTile label="MAPE" value={`${metrics.mape}`} unit="%" context="Mean Absolute % Error" quality={mapeQuality(metrics.mape)} />
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2">
              <span className="label-caps text-[9px]">Skill vs seasonal-naive</span>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {metrics.skill_vs_naive_pct == null
                  ? "—"
                  : `${metrics.skill_vs_naive_pct > 0 ? "+" : ""}${metrics.skill_vs_naive_pct}%`}
              </p>
            </div>
            {confidence && (
              <p className="text-[11px] leading-snug text-muted-foreground">{confidence.note}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No forecast metrics available yet.</p>
        )}
      </div>
      )}

      {/* Right: Outbreak Classification (national 2025 validation) */}
      <div className="rounded-xl border border-border/80 bg-card/50 p-4">
        <p className="label-caps text-[10px] mb-2.5 text-muted-foreground">Outbreak Classification</p>
        {status === "loading" && !outbreak ? (
          <div className="space-y-2">
            <div className="h-16 w-full animate-pulse rounded bg-secondary" />
          </div>
        ) : o ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MetricTile label="Precision" value={o.precision == null ? "—" : `${Math.round(o.precision * 100)}`} unit="%" context={`${o.tp} of ${o.tp + o.fp} flags correct`} quality={accuracyLabel(o.precision)} />
              <MetricTile label="Recall" value={o.recall == null ? "—" : `${Math.round(o.recall * 100)}`} unit="%" context={`${o.tp} of ${o.tp + o.fn} outbreaks caught`} quality={accuracyLabel(o.recall)} />
              <MetricTile label="F1 Score" value={o.f1 == null ? "—" : o.f1.toFixed(2)} unit="" context="Harmonic mean of precision & recall" quality={accuracyLabel(o.f1)} />
            </div>
            <div className="rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{o.tp} TP</span> ·{" "}
              <span>{o.fp} FP</span> · <span>{o.fn} FN</span> ·{" "}
              <span>{o.tn} TN</span> — 2025 prospective validation
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No outbreak classification available yet.</p>
        )}
      </div>
    </div>
  );
}