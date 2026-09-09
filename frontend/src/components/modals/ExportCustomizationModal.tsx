import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, X } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import {
  ILLNESSES,
  REGIONS,
  REGION_BY_CODE,
  assessRegion,
  formatPHTDateTime,
  metricValue,
  modelMetrics,
  monthMeta,
  seriesFor,
  type MetricMode,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";
import {
  SurveillanceReportPDF,
  type ExportOptions,
  type ReportLayout,
} from "@/components/pdf/SurveillanceReportPDF";
import {
  renderSeasonalitySVG,
  renderTrajectorySVG,
  svgToPngDataUri,
} from "@/utils/pdfChartExporter";

export interface ExportCustomizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regionCodes: string[];
  illness: string;
  monthIndex: number;
  mode: MetricMode;
}

type SectionKey =
  "overview" | "comparative" | "trajectory" | "seasonality" | "performance" | "recommendations";

const LAYOUTS: { id: ReportLayout; label: string; hint: string }[] = [
  { id: "executive", label: "Executive 1-Page Summary", hint: "Compact risk + comparison focus." },
  {
    id: "comprehensive",
    label: "Comprehensive Technical Report",
    hint: "Full profiles, charts & metrics.",
  },
  {
    id: "custom",
    label: "Custom Comparison Matrix",
    hint: "Tune sections below to fit your brief.",
  },
];

const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "overview", label: "Regional Profiles" },
  { key: "comparative", label: "Comparative Matrix" },
  { key: "trajectory", label: "Trajectory" },
  { key: "seasonality", label: "Seasonality" },
  { key: "performance", label: "Model Performance" },
  { key: "recommendations", label: "Recommendations" },
];

export function ExportCustomizationModal({
  open,
  onOpenChange,
  regionCodes,
  illness,
  monthIndex,
  mode,
}: ExportCustomizationModalProps) {
  const [layout, setLayout] = useState<ReportLayout>("executive");
  const [pathology, setPathology] = useState<string>(illness);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(regionCodes);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    overview: true,
    comparative: true,
    trajectory: true,
    seasonality: true,
    performance: true,
    recommendations: true,
  });
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0); // 0 idle, 1 rasterizing, 2 building, 3 downloading
  const [progress, setProgress] = useState(0);

  // Sync the multi-select and pathology with the dashboard each time the modal opens.
  useEffect(() => {
    if (open) {
      setSelectedRegions(regionCodes);
      setPathology(illness);
    }
  }, [open, regionCodes, illness]);

  const baselineLabel = monthMeta(monthIndex).label;
  const unit = mode === "raw" ? "cases/month" : "per 100k/month";

  const toggleRegion = useCallback((code: string) => {
    setSelectedRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const selectAllRegions = () => setSelectedRegions(REGIONS.map((r) => r.code));
  const clearAllRegions = () => setSelectedRegions([]);

  const toggleSection = useCallback((key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const applyLayout = (id: ReportLayout) => {
    setLayout(id);
    if (id === "executive") {
      setSections({
        overview: true,
        comparative: true,
        trajectory: false,
        seasonality: false,
        performance: false,
        recommendations: true,
      });
    } else if (id === "comprehensive") {
      setSections({
        overview: true,
        comparative: true,
        trajectory: true,
        seasonality: true,
        performance: true,
        recommendations: true,
      });
    }
    // custom leaves sections untouched
  };

  // Keep selections in sync when the dashboard selection changes.
  const effectiveRegions = useMemo(
    () => REGIONS.filter((r) => selectedRegions.includes(r.code)),
    [selectedRegions],
  );

  const buildExport = useCallback(async () => {
    setPhase(1);
    setProgress(0);

    const codes = selectedRegions;

    const generatedAt = formatPHTDateTime();
    const reportPathology =
      pathology === "all"
        ? "All reported pathologies"
        : (ILLNESSES.find((i) => i.id === pathology)?.name ?? pathology);

    const regions = [];
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;
      const a = assessRegion(code, pathology, monthIndex, mode);
      const metrics = modelMetrics(code, pathology);
      const region = REGION_BY_CODE[code]!;

      let trajectoryImage: string | null = null;
      let seasonalityImage: string | null = null;

      const series = seriesFor(code, pathology);
      const windowSlice = series.slice(Math.max(0, monthIndex - 17), monthIndex + 1);
      const trajPoints = windowSlice.map((p) => ({
        label: p.label,
        cases: p.cases,
        forecast: p.forecast,
        lower: p.lower,
        upper: p.upper,
      }));

      // 12-month seasonality buckets (Jan..Dec) as wet/dry delta
      const seasonality = Array.from({ length: 12 }, (_, m) => {
        const monthPts = series.filter((p) => !p.forecast && p.month === m + 1);
        const avg = monthPts.length
          ? monthPts.reduce((s, p) => s + p.cases, 0) / monthPts.length
          : 0;
        const wet = m + 1 >= 6 && m + 1 <= 11;
        return { label: monthMeta(m).label.slice(5), value: wet ? avg : -avg };
      });

      const riskColor =
        a.risk === "high" ? "#ef4444" : a.risk === "moderate" ? "#f59e0b" : "#22c55e";

      trajectoryImage = await svgToPngDataUri(renderTrajectorySVG(trajPoints, riskColor));
      seasonalityImage = await svgToPngDataUri(renderSeasonalitySVG(seasonality));
      setProgress(Math.round(((i + 1) / codes.length) * 50));

      regions.push({
        profile: region,
        risk: a.risk,
        reported: a.value,
        predicted: a.value,
        lower: metricValue(a.point.lower, region, mode),
        upper: metricValue(a.point.upper, region, mode),
        percentile: a.percentileRank,
        changePct: a.changePct,
        dominantIllness: a.dominantIllness.shortName,
        unit,
        mape: metrics.mape,
        mae: metrics.mae,
        rmse: metrics.rmse,
        trajectoryImage,
        seasonalityImage,
        season: monthMeta(monthIndex).season,
        driver: a.dominantIllness.driver,
      });
    }

    setPhase(2);
    const options: ExportOptions = {
      layout,
      baseline: baselineLabel,
      generatedAt,
      pathology: reportPathology,
      sections,
      regions,
    };

    setPhase(3);
    let blob: Blob;
    try {
      blob = await pdf(<SurveillanceReportPDF options={options} />).toBlob();
    } finally {
      setPhase(0);
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Epidemiological_Report_${baselineLabel}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [layout, pathology, selectedRegions, monthIndex, mode, unit, sections, baselineLabel]);

  if (!open) return null;

  const merging = phase !== 0;

  return createPortal(
    <>
      <div
        style={{ zIndex: 9998 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md animate-in fade-in-0 duration-150"
        onClick={() => !merging && onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Surveillance Report"
        style={{ zIndex: 9999 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-2xl max-h-[92vh] flex flex-col glass-panel rounded-2xl border border-border/70 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4 bg-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <FileDown className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Export Surveillance Report</h2>
              <p className="text-xs text-muted-foreground">
                Customize the epidemiological PDF · Baseline{" "}
                <span className="font-mono text-foreground">{baselineLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !merging && onOpenChange(false)}
            aria-label="Close export modal"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5 hw-scroll">
          {/* 1. Preset Layout */}
          <div>
            <p className="label-caps text-[11px] font-semibold text-foreground mb-2">
              Preset Layout
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => applyLayout(l.id)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    layout === l.id
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:bg-secondary/40",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      layout === l.id ? "text-primary" : "text-foreground",
                    )}
                  >
                    {l.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{l.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Filter Controls */}
          <div className="rounded-xl border border-border/70 bg-secondary/15 p-4 space-y-3">
            <p className="label-caps text-[11px] font-semibold text-foreground">Report Filters</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] uppercase font-medium text-muted-foreground block mb-1">
                  Date range (baseline)
                </label>
                <input
                  type="text"
                  readOnly
                  value={baselineLabel}
                  className="w-full rounded-md border border-border/70 bg-card px-3 py-2 text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-medium text-muted-foreground block mb-1">
                  Pathology
                </label>
                <select
                  value={pathology}
                  onChange={(e) => setPathology(e.target.value)}
                  className="w-full rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-foreground"
                >
                  <option value="all">All</option>
                  {ILLNESSES.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Region multi-select */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] uppercase font-medium text-muted-foreground">
                  Regions ({selectedRegions.length} selected)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllRegions}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground/40 text-[11px]">·</span>
                  <button
                    type="button"
                    onClick={clearAllRegions}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Clear All
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REGIONS.map((r) => {
                  const active = selectedRegions.includes(r.code);
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => toggleRegion(r.code)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r.short}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Modular Sections */}
          <div>
            <p className="label-caps text-[11px] font-semibold text-foreground mb-2">
              Report Sections
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_SECTIONS.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/15 px-3 py-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={sections[s.key]}
                    onChange={() => toggleSection(s.key)}
                    className="size-4 accent-primary"
                  />
                  <span className="text-xs text-foreground">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer / progress + export */}
        <div className="border-t border-border/70 bg-secondary/25 px-5 py-4">
          {merging ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>
                  {phase === 1 && "Rasterizing chart visuals..."}
                  {phase === 2 && "Building PDF document..."}
                  {phase === 3 && "Downloading..."}
                </span>
                {phase === 1 && (
                  <span className="ml-auto font-mono text-muted-foreground">{progress}%</span>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{
                    width:
                      phase === 1
                        ? `${progress}%`
                        : phase === 2
                          ? "70%"
                          : phase === 3
                            ? "100%"
                            : "0%",
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground leading-snug max-w-xs">
                Generates{" "}
                <span className="font-mono text-foreground">
                  Epidemiological_Report_{baselineLabel}.pdf
                </span>{" "}
                in {unit}.
              </p>
              <button
                type="button"
                disabled={effectiveRegions.length === 0}
                onClick={buildExport}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 transition-all disabled:opacity-50 min-h-[40px]"
              >
                <FileDown className="size-4" />
                <span>Export Report</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
