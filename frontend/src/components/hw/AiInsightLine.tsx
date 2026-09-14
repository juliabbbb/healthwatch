import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";
const DISEASE = "dengue";

const insightCache = new Map<string, { narrative: string; model?: string }>();

function cacheKey(regionShort: string, monthLabel: string): string {
  return `${regionShort}:${DISEASE}:${monthLabel}`;
}

async function fetchInsight(regionShort: string, signal?: AbortSignal) {
  const path = `/ai-insight?region=${encodeURIComponent(regionShort)}&disease=${DISEASE}`;
  const res = await fetch(`${API_BASE}${path}`, { signal: signal ?? null });
  if (!res.ok) {
    let detail = `request failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON */
    }
    throw new Error(detail);
  }
  return (await res.json()) as { narrative: string; model?: string };
}

/**
 * Compact one-line AI-generated plain-language risk outlook, placed in the
 * map info panel. Hidden entirely when the user has opted out of AI features;
 * silently hides on API errors so the panel never looks broken.
 */
export function AiInsightLine({
  regionShort,
  regionName,
  monthLabel,
}: {
  regionShort: string;
  regionName: string;
  monthLabel: string;
}) {
  const [enabled] = useAiAnalysisSetting();
  const key = cacheKey(regionShort, monthLabel);

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    insightCache.has(key) ? "done" : "idle",
  );
  const [text, setText] = useState<string | null>(
    insightCache.get(key)?.narrative ?? null,
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const hit = insightCache.get(key);
      if (hit) {
        setText(hit.narrative);
        setStatus("done");
        return;
      }
      setStatus("loading");
      try {
        const res = await fetchInsight(regionShort, signal);
        insightCache.set(key, res);
        setText(res.narrative);
        setStatus("done");
      } catch (err) {
        if (signal?.aborted) return;
        // Silent failure — component hides itself
        setStatus("error");
      }
    },
    [key, regionShort],
  );

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [enabled, load]);

  if (!enabled || status === "error" || !text) return null;

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary/60" />
        <div className="h-3 w-full animate-pulse rounded bg-secondary" />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-xs leading-snug text-muted-foreground italic">{text}</p>
    </div>
  );
}