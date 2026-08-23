import { Link } from "@tanstack/react-router";
import { Activity, Flame, Layers, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { DataLayer } from "./MapCanvas";
import {
  ILLNESSES,
  METRIC_META,
  RISK_META,
  type MetricMode,
  type RiskLevel,
} from "@/lib/healthwatch/data";

import { cn } from "@/lib/utils";

const LAYERS: { id: DataLayer; label: string; icon: typeof Activity; hint: string }[] = [
  { id: "hotspot", label: "Hotspot classification", icon: Flame, hint: "Low / Moderate / High" },
  { id: "density", label: "Case density", icon: Activity, hint: "Cases per 100k" },
];

export function LayerSidebar({
  open,
  onToggle,
  layer,
  onLayerChange,
  illness,
  onIllnessChange,
  counts,
  mode,
  onModeChange,
}: {
  open: boolean;
  onToggle: () => void;
  layer: DataLayer;
  onLayerChange: (l: DataLayer) => void;
  illness: string;
  onIllnessChange: (i: string) => void;
  counts: Record<RiskLevel, number>;
  mode: MetricMode;
  onModeChange: (m: MetricMode) => void;
}) {
  return (
    <aside
      className={cn(
        "glass-panel hw-scroll pointer-events-auto flex max-h-[calc(100vh-15rem)] flex-col overflow-y-auto rounded-xl transition-all duration-300",
        open ? "w-64" : "w-14",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        {open && (
          <span className="flex items-center gap-2 font-display text-sm">
            <Layers className="size-4 text-primary" /> Data layers
          </span>
        )}
        <button
          onClick={onToggle}
          aria-label={open ? "Collapse layers panel" : "Expand layers panel"}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>
      </div>

      <div className="space-y-1 p-2">
        {LAYERS.map((l) => {
          const Icon = l.icon;
          const active = layer === l.id;
          return (
            <button
              key={l.id}
              onClick={() => onLayerChange(l.id)}
              title={l.label}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-xs transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {open && (
                <span className="min-w-0">
                  <span className="block truncate font-medium">{l.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{l.hint}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (
        <>
          <div className="border-t border-border p-3">
            <p className="label-caps mb-2">Illness filter</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip active={illness === "all"} onClick={() => onIllnessChange("all")}>
                All
              </FilterChip>
              {ILLNESSES.map((i) => (
                <FilterChip
                  key={i.id}
                  active={illness === i.id}
                  onClick={() => onIllnessChange(i.id)}
                >
                  {i.shortName}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <p className="label-caps mb-2">Classification metric</p>
            <div className="flex rounded-md border border-border p-0.5">
              {(["percapita", "raw"] as MetricMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  aria-pressed={mode === m}
                  className={cn(
                    "flex-1 rounded-[5px] px-2 py-1.5 text-[11px] font-medium transition-colors",
                    mode === m
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {METRIC_META[m].short}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Hotspots are ranked on{" "}
              <span className="text-foreground">{METRIC_META[mode].label.toLowerCase()}</span>.
              Per-capita ranking prevents large-population regions such as NCR from reading High
              purely on size.
            </p>
          </div>

          <div className="border-t border-border p-3">
            <p className="label-caps mb-2">Hotspot legend</p>
            <ul className="space-y-1.5">
              {(["high", "moderate", "low"] as RiskLevel[]).map((r) => (
                <li key={r} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ backgroundColor: RISK_META[r].color }}
                    />
                    {RISK_META[r].label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{counts[r]} regions</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Thresholds: &lt;50th pct = Low, 50–75th = Moderate, &gt;75th = High of the national
              2016–2021 distribution ({METRIC_META[mode].unit}) for the same ±6-week calendar
              window.
            </p>
          </div>

          <div className="border-t border-border p-3 text-xs">
            <Link to="/methodology" className="text-primary hover:underline">
              Data sources &amp; methodology →
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
