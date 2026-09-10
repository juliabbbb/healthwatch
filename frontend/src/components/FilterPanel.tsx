import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterPanelProps {
  regions: Array<{ code: string; short: string; name?: string }>;
  selectedRegions: string[];
  onRegionToggle: (code: string) => void;
  multiSelectRegion?: boolean;
  regionDropdown?: boolean;
  regionActions?: Array<{ label: string; onClick: () => void }>;
  selectedCount?: number;

  illnesses: Array<{ id: string; name: string; shortName?: string }>;
  selectedIllness: string;
  onIllnessChange: (val: string) => void;

  dateSliderSlot?: React.ReactNode;
}

export function FilterPanel({
  regions,
  selectedRegions,
  onRegionToggle,
  multiSelectRegion = false,
  regionDropdown = false,
  regionActions,
  selectedCount,
  illnesses,
  selectedIllness,
  onIllnessChange,
  dateSliderSlot,
}: FilterPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-6 py-5">
      {/* Region (full-width top row) */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {!regionDropdown && (
              <span className="text-sm font-medium text-foreground">Region</span>
            )}
            {multiSelectRegion && selectedCount !== undefined && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                {selectedCount} of {regions.length} selected
              </span>
            )}
          </div>
          {multiSelectRegion && regionActions && regionActions.length > 0 && (
            <div className="flex items-center gap-2">
              {regionActions.map((action, i) => (
                <span key={action.label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/40 text-xs">·</span>}
                  <button
                    type="button"
                    onClick={action.onClick}
                    className="text-xs font-medium text-primary hover:underline transition-colors"
                  >
                    {action.label}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {regionDropdown ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground shrink-0">Region:</span>
            <Select
              value={selectedRegions[0] ?? ""}
              onValueChange={(value) => onRegionToggle(value)}
            >
              <SelectTrigger className="w-full min-w-[12rem]">
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name ? `${r.short} — ${r.name}` : r.short}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : multiSelectRegion ? (
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => {
              const isSelected = selectedRegions.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => onRegionToggle(r.code)}
                  aria-pressed={isSelected}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md border transition-colors text-center min-h-[36px]",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-background text-foreground border-border hover:bg-accent",
                  )}
                >
                  {r.short}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
            {regions.map((r) => {
              const isSelected = selectedRegions.includes(r.code);
              return (
                <Chip key={r.code} active={isSelected} onClick={() => onRegionToggle(r.code)}>
                  {r.short}
                </Chip>
              );
            })}
          </div>
        )}
      </div>

      {/* Illness + Period */}
      <div className="mt-4 md:mt-5 flex flex-col md:flex-row md:items-start gap-4 md:gap-6 border-t border-border/60 pt-4 md:pt-5">
        <div className="min-w-0 md:flex-1">
          <span className="text-sm font-medium text-foreground mb-2 block">Illness</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={selectedIllness === "all"} onClick={() => onIllnessChange("all")}>
              All illnesses
            </Chip>
            {illnesses.map((i) => (
              <Chip
                key={i.id}
                active={selectedIllness === i.id}
                onClick={() => onIllnessChange(i.id)}
              >
                {i.shortName ?? i.name}
              </Chip>
            ))}
          </div>
        </div>

        {/* Date Slider Slot */}
        {dateSliderSlot && (
          <div className="min-w-0 md:flex-[2]">
            <span className="text-sm font-medium text-foreground mb-2 block">Period</span>
            {dateSliderSlot}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
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
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs capitalize transition-colors min-h-[28px] cursor-pointer touch-manipulation",
        active
          ? "border-primary/50 bg-primary/15 text-primary font-medium"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      {children}
    </button>
  );
}