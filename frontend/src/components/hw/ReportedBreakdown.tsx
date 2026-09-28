/**
 * ReportedBreakdown.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Demographic/clinical breakdown of one region-month of reported cases.
 *
 * Pulls from `/reported/{region}?year=&month=` (aggregated from the raw DOH
 * dengue case line-list in Postgres on demand). Renders final classification,
 * age group, sex, clinical severity, and admission status as a compact
 * descriptive panel — neutrals only, since green/amber/red are reserved for
 * risk data (Risk Reservation).
 */

import { useEffect, useState } from "react";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

interface BreakdownRow {
  value: string;
  cases: number;
  deaths: number;
  share: number;
}

interface ReportedBreakdownData {
  disease: string;
  region: string;
  region_code: string;
  year: number;
  month: number;
  label: string;
  total_cases: number;
  total_deaths: number;
  records: number;
  breakdowns: Record<string, BreakdownRow[]>;
}

const DIM_LABELS: Record<string, string> = {
  final_classification: "Clinical Classification",
  age_group: "Age Group",
  sex: "Sex",
  clinical_classification: "Clinical Severity",
  admitted: "Admission Status",
};

function DimensionRows({ rows }: { rows: BreakdownRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.value} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-foreground/90 truncate">
              {r.value}
              {r.deaths > 0 && (
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  · {r.deaths} deaths
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-2 shrink-0">
              <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
                {r.cases.toLocaleString()}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-10 text-right">
                {(r.share * 100).toFixed(1)}%
              </span>
            </span>
          </div>
          <div className="h-1 rounded-full bg-border/40" role="presentation">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${Math.max(1, r.share * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportedBreakdown({
  regionCode,
  year,
  month,
}: {
  regionCode: string;
  year: number;
  month: number;
}) {
  const [data, setData] = useState<ReportedBreakdownData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    const url = `${API_BASE}/reported/${encodeURIComponent(regionCode)}?year=${year}&month=${month}`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          let detail = `Breakdown unavailable (HTTP ${res.status}).`;
          try {
            const payload = (await res.json()) as { detail?: string };
            if (payload?.detail) detail = payload.detail;
          } catch {
            // ignore JSON parse error
          }
          throw new Error(detail);
        }
        return (await res.json()) as ReportedBreakdownData;
      })
      .then((payload) => {
        if (!stale) setData(payload);
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : "Breakdown unavailable.");
      });
    return () => {
      stale = true;
    };
  }, [regionCode, year, month]);

  return (
    <section
      aria-label={`Reported data breakdown for ${year}-${String(month).padStart(2, "0")}`}
      className="rounded-xl border border-border/80 bg-card p-5 shadow-xs"
    >
      <header className="mb-3">
        <p className="text-xs font-semibold text-foreground">Reported Data Breakdown</p>
        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
          {data
            ? `${data.region} · ${data.label} · ${data.total_cases.toLocaleString()} cases · ${data.total_deaths.toLocaleString()} deaths`
            : "Source: DOH dengue case line-list"}
        </p>
      </header>

      {error ? (
        <p className="text-[11px] text-muted-foreground leading-snug">{error}</p>
      ) : !data ? (
        <div className="space-y-2.5 animate-pulse" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-2.5 w-24 rounded-full bg-border/40" />
              <div className="h-1 w-full rounded-full bg-border/30" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {Object.entries(DIM_LABELS).map(([dim, label]) => (
            <div key={dim}>
              <p className="label-caps text-[10px] font-bold text-muted-foreground mb-2 uppercase">
                {label}
              </p>
              <DimensionRows rows={data.breakdowns[dim] ?? []} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}