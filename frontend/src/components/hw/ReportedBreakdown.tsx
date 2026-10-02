/**
 * ReportedBreakdown.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Demographic/clinical breakdown of one region-month of reported cases.
 *
 * Pulls from `/reported/{region}?disease=&year=&month=` (aggregated from the
 * raw DOH line-lists in Postgres on demand). Each disease surfaces its own
 * dimensions and classification rules — dengue uses the final/clinical split,
 * FWD line-lists carry a single Suspect/Probable/Confirmed class plus outcome.
 * Renders as a compact descriptive panel — neutrals only, since
 * green/amber/red are reserved for risk data (Risk Reservation).
 */

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { caseNotesFor, REPORTED_SOURCE } from "@/lib/healthwatch/data";
import { AiNarrativeLine } from "@/components/hw/AiNarrative";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

const ACCESSIBLE_DISEASE = (disease: string) => (disease === "all" ? "Dengue" : disease);

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

const DIM_LABELS: Record<string, Record<string, string>> = {
  Dengue: {
    final_classification: "Clinical Classification",
    age_group: "Age Group",
    sex: "Sex",
    clinical_classification: "Clinical Severity",
    admitted: "Admission Status",
  },
  "Acute Bloody Diarrhea": {
    final_classification: "Case Classification",
    age_group: "Age Group",
    sex: "Sex",
    admitted: "Admission Status",
    outcome: "Outcome",
  },
  Cholera: {
    final_classification: "Case Classification",
    age_group: "Age Group",
    sex: "Sex",
    admitted: "Admission Status",
    outcome: "Outcome",
  },
  "Typhoid Fever": {
    final_classification: "Case Classification",
    age_group: "Age Group",
    sex: "Sex",
    admitted: "Admission Status",
    outcome: "Outcome",
  },
  "Acute Viral Hepatitis": {
    final_classification: "Case Classification",
    age_group: "Age Group",
    sex: "Sex",
    admitted: "Admission Status",
    outcome: "Outcome",
  },
};

function DimensionHeader({
  dim,
  label,
  notes,
}: {
  dim: string;
  label: string;
  notes: ReturnType<typeof caseNotesFor>;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <p className="label-caps text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
      {dim === "final_classification" && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Case classification definitions"
                className="inline-flex shrink-0 rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="start"
              className="max-w-[280px] border border-border/80 bg-card px-3.5 py-3 text-foreground shadow-sm"
            >
              <div className="space-y-2">
                {notes.disclaimer.map((line) => (
                  <p key={line} className="text-[11px] leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                ))}
                <p className="label-caps font-bold text-muted-foreground uppercase">
                  {notes.heading}
                </p>
                <ul className="space-y-1">
                  {notes.classes.map((c) => (
                    <li key={c.label} className="text-[11px] leading-snug text-muted-foreground">
                      <strong className="font-semibold text-foreground">{c.label}</strong>
                      <span className="text-muted-foreground"> — {c.definition}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted-foreground">{notes.source}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

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
  illness = "Dengue",
  year,
  month,
}: {
  regionCode: string;
  illness?: string;
  year: number;
  month: number;
}) {
  const disease = ACCESSIBLE_DISEASE(illness);
  const notes = caseNotesFor(illness);
  const dims = DIM_LABELS[disease] ?? DIM_LABELS["Dengue"]!;
  const [data, setData] = useState<ReportedBreakdownData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setData(null);
    setError(null);
    const url = `${API_BASE}/reported/${encodeURIComponent(regionCode)}?disease=${encodeURIComponent(disease)}&year=${year}&month=${month}`;
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
  }, [regionCode, disease, year, month]);

  return (
    <section
      aria-label={`Reported data breakdown for ${year}-${String(month).padStart(2, "0")}`}
      className="rounded-xl border border-border/80 bg-card p-5 shadow-xs"
    >
      <header className="mb-3">
        <p className="text-xs font-semibold text-foreground">Reported Data Breakdown</p>
        {data && (
          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
            {data.region} · {data.label} · {data.total_cases.toLocaleString()} cases ·{" "}
            {data.total_deaths.toLocaleString()} deaths
          </p>
        )}
        {/* Per-disease provenance stays visible in every state — loading, error and
            loaded — so attribution is never lost once figures arrive. */}
        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
          {REPORTED_SOURCE[disease] ?? "Source: DOH disease line-list"}
        </p>
      </header>

      {/* Who is most affected, in plain words, for this region. Pre-generated;
          renders nothing when the corpus has no row for this series. */}
      {data && (
        <AiNarrativeLine
          regionShort={data.region_code}
          illness={illness}
          surface="reported"
          className="mb-3 border-b border-border/60 pb-3"
        />
      )}

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
          {Object.entries(dims).map(([dim, label]) => (
            <div key={dim}>
              <DimensionHeader dim={dim} label={label} notes={notes} />
              <DimensionRows rows={data.breakdowns[dim] ?? []} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
