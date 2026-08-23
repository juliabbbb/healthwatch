import { useEffect } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { CURRENT_WEEK_INDEX, HIST_WEEKS, TOTAL_WEEKS, weekMeta } from "@/lib/healthwatch/data";
import { SeasonTag } from "./RiskBadge";

export function TimelineScrubber({
  weekIndex,
  onChange,
  playing,
  onPlayingChange,
}: {
  weekIndex: number;
  onChange: (i: number) => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
}) {
  const meta = weekMeta(weekIndex);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      onChange(weekIndex + 1 >= TOTAL_WEEKS ? 0 : weekIndex + 1);
    }, 160);
    return () => window.clearInterval(id);
  }, [playing, weekIndex, onChange]);

  const pct = (weekIndex / (TOTAL_WEEKS - 1)) * 100;
  const histPct = (HIST_WEEKS / (TOTAL_WEEKS - 1)) * 100;

  return (
    <div className="glass-panel pointer-events-auto rounded-xl px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(Math.max(0, weekIndex - 1))}
            aria-label="Previous week"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? "Pause animation" : "Play animation"}
            className="rounded-full bg-primary p-2 text-primary-foreground transition-opacity hover:opacity-90"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            onClick={() => onChange(Math.min(TOTAL_WEEKS - 1, weekIndex + 1))}
            aria-label="Next week"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <SkipForward className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-display text-base">{meta.label}</span>
          <SeasonTag season={meta.season} />
          <span
            className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
            style={{
              color: meta.forecast ? "var(--risk-moderate)" : "var(--color-muted-foreground)",
              backgroundColor: meta.forecast
                ? "color-mix(in oklab, var(--risk-moderate), transparent 88%)"
                : "var(--secondary)",
            }}
          >
            {meta.forecast ? "Forecast" : "Reported"}
          </span>
        </div>

        <button
          onClick={() => onChange(CURRENT_WEEK_INDEX)}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Jump to latest
        </button>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary/40" style={{ width: `${pct}%` }} />
          <div
            className="absolute inset-y-0"
            style={{
              left: `${histPct}%`,
              right: 0,
              backgroundColor: "color-mix(in oklab, var(--risk-moderate), transparent 80%)",
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
          className="relative h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg"
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>2017-W01</span>
          <span>Historical surveillance (2017–2023)</span>
          <span>+12-week forecast horizon</span>
        </div>
      </div>
    </div>
  );
}
