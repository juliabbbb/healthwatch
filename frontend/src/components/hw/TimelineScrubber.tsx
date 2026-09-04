import { useRef, useEffect, useState } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  History,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { CURRENT_WEEK_INDEX, HIST_WEEKS, TOTAL_WEEKS, weekMeta } from "@/lib/healthwatch/data";
import { SeasonTag } from "./RiskBadge";
import { cn } from "@/lib/utils";

/**
 * Week scrubber with a compact single-row transport (default) and an
 * expanded state that adds the horizon captions and the jump-to-latest
 * affordance, so playback chrome never eats map real estate.
 */
export function TimelineScrubber({
  weekIndex,
  onChange,
  playing,
  onPlayingChange,
  className,
}: {
  weekIndex: number;
  onChange: (i: number) => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = weekMeta(weekIndex);

  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const idxRef = useRef(weekIndex);

  useEffect(() => {
    if (!playing) return;
    idxRef.current = weekIndex;
    const id = window.setInterval(() => {
      idxRef.current = idxRef.current + 1 >= TOTAL_WEEKS ? 0 : idxRef.current + 1;
      cbRef.current(idxRef.current);
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable interval; latest values via refs
  }, [playing]);

  const pct = (weekIndex / (TOTAL_WEEKS - 1)) * 100;
  const histPct = (HIST_WEEKS / (TOTAL_WEEKS - 1)) * 100;

  const modeBadge = (
    <span
      className="rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wider shrink-0"
      style={{
        color: meta.forecast ? "var(--risk-moderate)" : "var(--muted-foreground)",
        backgroundColor: meta.forecast
          ? "color-mix(in oklab, var(--risk-moderate), transparent 88%)"
          : "var(--secondary)",
      }}
    >
      {meta.forecast ? "Forecast" : "Reported"}
    </span>
  );

  return (
    <div className={cn("glass-panel pointer-events-auto rounded-xl px-2.5 py-2 sm:px-4 sm:py-3 shadow-lg", className)}>
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Transport — icon-only cluster */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            onClick={() => onChange(Math.max(0, weekIndex - 1))}
            aria-label="Previous week"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          >
            <SkipBack className="size-3.5" />
          </button>
          <button
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? "Pause animation" : "Play animation"}
            className="rounded-full bg-primary p-1.5 text-primary-foreground shadow-xs transition-transform hover:scale-105 active:scale-95"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button
            onClick={() => onChange(Math.min(TOTAL_WEEKS - 1, weekIndex + 1))}
            aria-label="Next week"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
          >
            <SkipForward className="size-3.5" />
          </button>
        </div>

        {/* Track Slider */}
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary/50" style={{ width: `${pct}%` }} />
            <div
              className="absolute inset-y-0"
              style={{
                left: `${histPct}%`,
                right: 0,
                backgroundColor:
                  "color-mix(in oklab, var(--risk-moderate), transparent 80%)",
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={TOTAL_WEEKS - 1}
            value={weekIndex}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label="Week scrubber"
            className="relative h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>

        {/* Readout */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 text-xs">
          <span className="font-mono text-[11px] sm:text-xs font-semibold tabular-nums text-foreground">{meta.label}</span>
          <span className="hidden sm:inline-flex">
            <SeasonTag season={meta.season} />
          </span>
          {modeBadge}
          {expanded && (
            <button
              onClick={() => onChange(CURRENT_WEEK_INDEX)}
              title="Jump to latest reported week"
              aria-label="Jump to latest reported week"
              className="rounded-md border border-border p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <History className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse timeline controls" : "Expand timeline controls"}
            title={expanded ? "Collapse controls" : "Expand controls"}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {expanded ? (
              <ChevronsDownUp className="size-3.5" />
            ) : (
              <ChevronsUpDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-1.5 flex justify-between text-[9px] sm:text-[10px] text-muted-foreground border-t border-border/40 pt-1">
          <span>2016-W02</span>
          <span className="hidden xs:inline">Historical surveillance (2016–2025)</span>
          <span>+12-week forecast horizon</span>
        </div>
      )}
    </div>
  );
}
