import { useEffect, useState, type ReactNode } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";

/**
 * Renders a pre-generated AI narrative for a data/chart surface.
 *
 * Reads the shipped corpus via GET /narratives, which the API serves from
 * Postgres - no provider call happens on page load, so these surfaces render
 * with no API key, no quota and no spinner. The corpus is keyed by
 * (region, disease, surface, component); a missing row is normal (the corpus is
 * generated offline) and simply renders nothing, leaving whatever static copy
 * the surface already has.
 *
 * Follows the AI preference (`useAiAnalysisSetting`, on by default): a user who
 * has turned AI analysis off makes zero requests and sees only the static copy.
 */

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

export type NarrativeSurface =
  | "ai_insight"
  | "analysis"
  | "chart_takeaway"
  | "compare"
  | "reported"
  | "national"
  | "kpi_takeaway"
  | "escalation"
  | "report_summary";

/** The corpus is disease-specific; the "all" UI filter has no single match. */
const ACCESSIBLE_DISEASE = (disease: string) => (disease === "all" ? "Dengue" : disease);

interface NarrativeRow {
  narrative: string;
  model?: string;
}

interface NarrativesResponse {
  count: number;
  items: NarrativeRow[];
}

const cache = new Map<string, NarrativeRow | null>();

function cacheKey(
  regionShort: string | null,
  disease: string,
  surface: NarrativeSurface,
  component: string,
): string {
  return `${regionShort ?? "national"}:${disease}:${surface}:${component}`;
}

async function fetchNarrative(
  regionShort: string | null,
  disease: string,
  surface: NarrativeSurface,
  component: string,
  signal: AbortSignal,
): Promise<NarrativeRow | null> {
  const params = new URLSearchParams({ disease, surface });
  if (regionShort) params.set("region", regionShort);
  if (surface === "chart_takeaway") params.set("component", component);
  const res = await fetch(`${API_BASE}/narratives?${params}`, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as NarrativesResponse;
  return body.items?.[0] ?? null;
}

/**
 * Imperative corpus read for callers that are not React render paths — the PDF
 * exporters, which are synchronous render functions and cannot use hooks.
 * Shares the session cache with the mounted components, so a narrative already
 * shown on screen is not fetched again for the export. Resolves to null when the
 * corpus has no row for the key.
 */
export function loadNarrative(
  regionShort: string | null,
  illness: string,
  surface: NarrativeSurface,
  component = "",
): Promise<string | null> {
  const disease = ACCESSIBLE_DISEASE(illness);
  const key = cacheKey(regionShort, disease, surface, component);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached?.narrative ?? null);

  return fetchNarrative(regionShort, disease, surface, component, new AbortController().signal)
    .then((row) => {
      cache.set(key, row);
      return row?.narrative ?? null;
    })
    .catch(() => {
      cache.set(key, null);
      return null;
    });
}

/**
 * Shared loader: returns undefined while pending, null when nothing should be
 * rendered, and the row once it is available. Results are cached per key for
 * the session so switching tabs or filters does not refetch.
 */
function useNarrativeRow(
  regionShort: string | null,
  illness: string,
  surface: NarrativeSurface,
  component: string,
): NarrativeRow | null | undefined {
  const [enabled] = useAiAnalysisSetting();
  const disease = ACCESSIBLE_DISEASE(illness);
  const key = cacheKey(regionShort, disease, surface, component);

  const [row, setRow] = useState<NarrativeRow | null | undefined>(() =>
    cache.has(key) ? cache.get(key) : undefined,
  );

  useEffect(() => {
    if (!enabled) {
      setRow(null);
      return;
    }
    if (cache.has(key)) {
      setRow(cache.get(key));
      return;
    }
    const controller = new AbortController();
    fetchNarrative(regionShort, disease, surface, component, controller.signal)
      .then((result) => {
        cache.set(key, result);
        setRow(result);
      })
      .catch(() => {
        // Aborted or network error: stay silent rather than showing an error
        // chip where a static sentence used to read fine.
        cache.set(key, null);
        setRow(null);
      });
    return () => controller.abort();
  }, [enabled, key, regionShort, disease, surface, component]);

  return row;
}

/**
 * Compact one-liner, used for chart takeaways and inline summaries.
 *
 * `fallback` renders only when no corpus row exists (or AI analysis is off), so a
 * surface that already ships deterministic copy does not print both sentences.
 * While the row is still loading the fallback is held back to avoid a flash of
 * static text that is immediately replaced.
 */
export function AiNarrativeLine({
  regionShort = null,
  illness = "Dengue",
  surface,
  component = "",
  fallback,
  className,
}: {
  regionShort?: string | null;
  illness?: string;
  surface: NarrativeSurface;
  component?: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const row = useNarrativeRow(regionShort, illness, surface, component);

  if (row === undefined) return null;
  if (!row?.narrative) return <>{fallback}</>;

  return (
    <p className={cn("text-xs leading-relaxed text-foreground/85", className)}>
      {row.narrative}
    </p>
  );
}

/** Labelled block with the AI-disclosure chrome, used for page-level summaries. */
export function AiNarrativePanel({
  regionShort = null,
  illness = "Dengue",
  surface,
  component = "",
  title,
  fallback,
  className,
}: {
  regionShort?: string | null;
  illness?: string;
  surface: NarrativeSurface;
  component?: string;
  title?: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const row = useNarrativeRow(regionShort, illness, surface, component);

  if (!row?.narrative) return <>{fallback}</>;

  return (
    <section className={cn("glass-panel p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          <Bot className="size-3.5" /> AI-generated
        </span>
        {title && <p className="label-caps">{title}</p>}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{row.narrative}</p>
      {row.model && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Generated by {row.model} from the figures on this page — not a separate forecast or
          risk assessment.
        </p>
      )}
    </section>
  );
}