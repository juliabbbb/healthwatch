import { cn } from "@/lib/utils";
import type { ChartType } from "@/hooks/useChartType";

const OPTIONS: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
];

interface ChartTypeToggleProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeToggle({ value, onChange }: ChartTypeToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label="Chart type">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={`Show as ${opt.label.toLowerCase()} chart`}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-mono font-medium transition-colors cursor-pointer touch-manipulation",
              active
                ? "border-primary/60 bg-primary/15 text-primary font-bold shadow-xs"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
