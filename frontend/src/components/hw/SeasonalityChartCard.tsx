import { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Download,
  Maximize2,
  MoreHorizontal,
  Sparkles,
  Info,
} from "lucide-react";
import { DecompositionChart, AcfChart } from "@/components/hw/Charts";
import { type SeasonalityComponent } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

interface SeasonalityChartCardProps {
  regionCode: string;
  illness: string;
  component: SeasonalityComponent;
  title: string;
  subtitle?: string;
  statBadge?: { label: string; value: string };
  height?: number;
  endIndex?: number | undefined;
  onRequestAI: (component: SeasonalityComponent) => void;
  onExpand: (component: SeasonalityComponent) => void;
  onOpenMenu: (e: React.MouseEvent, component: SeasonalityComponent) => void;
  onExportCsv?: (component: SeasonalityComponent) => void;
}

const COLOR_MAP: Record<SeasonalityComponent, { dot: string; border: string; glow: string }> = {
  observed: {
    dot: "bg-[var(--chart-1)]",
    border: "border-[var(--chart-1)]/30",
    glow: "shadow-[0_0_12px_rgba(45,212,191,0.15)]",
  },
  trend: {
    dot: "bg-[var(--chart-2)]",
    border: "border-[var(--chart-2)]/30",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  },
  seasonal: {
    dot: "bg-[var(--chart-3)]",
    border: "border-[var(--chart-3)]/30",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.15)]",
  },
  residual: {
    dot: "bg-[var(--chart-4)]",
    border: "border-[var(--chart-4)]/30",
    glow: "shadow-[0_0_12px_rgba(244,63,94,0.15)]",
  },
  acf: {
    dot: "bg-[var(--chart-1)]",
    border: "border-[var(--chart-1)]/30",
    glow: "shadow-[0_0_12px_rgba(45,212,191,0.15)]",
  },
};

export function SeasonalityChartCard({
  regionCode,
  illness,
  component,
  title,
  subtitle,
  statBadge,
  height = 160,
  endIndex,
  onRequestAI,
  onExpand,
  onOpenMenu,
  onExportCsv,
}: SeasonalityChartCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const styling = COLOR_MAP[component] ?? {
    dot: "bg-primary",
    border: "border-primary",
    glow: "rgba(59, 130, 246, 0.2)",
  };

  return (
    <div
      onContextMenu={(e) => onOpenMenu(e, component)}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border/80 bg-card/40 p-3.5 sm:p-4 transition-all duration-200",
        "hover:border-border hover:bg-card/60 hover:shadow-md",
      )}
    >
      {/* Header with Title, Badges, and Per-Chart Actions */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn("size-2.5 rounded-full shrink-0", styling.dot)}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {title}
            </h3>
            {statBadge && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border/60 bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span className="opacity-70">{statBadge.label}:</span>
                <span className="font-mono font-semibold text-foreground">{statBadge.value}</span>
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{subtitle}</p>
          )}
        </div>

        {/* Action Controls for this specific chart */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dedicated Per-Chart AI Analysis Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestAI(component);
            }}
            title={`Explain ${title} with AI`}
            aria-label={`Explain ${title} with AI`}
            className="flex items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary shadow-xs transition-all hover:bg-primary/25 hover:border-primary/80 hover:shadow-[0_0_10px_rgba(45,212,191,0.25)] active:scale-95 cursor-pointer touch-manipulation"
          >
            <Sparkles className="size-3.5 animate-pulse text-primary" />
            <span className="font-medium tracking-tight">AI Analysis</span>
          </button>

          {/* Quick Expand Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExpand(component);
            }}
            title="Expand & Inspect Chart"
            aria-label="Expand & Inspect Chart"
            className="hidden sm:flex size-7 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer"
          >
            <Maximize2 className="size-3.5" />
          </button>

          {/* Options Menu Trigger */}
          <button
            type="button"
            onClick={(e) => onOpenMenu(e, component)}
            title="More chart options"
            aria-label="More chart options"
            className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-card/60 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95 cursor-pointer touch-manipulation"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="mt-1 w-full flex-1">
        {component === "acf" ? (
          <AcfChart regionCode={regionCode} illness={illness} height={height} endIndex={endIndex} />
        ) : (
          <DecompositionChart
            regionCode={regionCode}
            illness={illness}
            component={component as "observed" | "trend" | "seasonal" | "residual"}
            height={height}
            endIndex={endIndex}
          />
        )}
      </div>
    </div>
  );
}
