import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { DataLayer } from "@/components/hw/MapCanvas";
import { LayerSidebar } from "@/components/hw/LayerSidebar";
import { TimelineScrubber } from "@/components/hw/TimelineScrubber";
import { TopToolbar } from "@/components/hw/TopToolbar";
import { ForecastCard } from "@/components/hw/ForecastCard";
import { RiskDot } from "@/components/hw/RiskBadge";
import {
  CURRENT_WEEK_INDEX,
  METRIC_META,
  assessAll,
  formatMetric,
  weekMeta,
  type MetricMode,
  type RiskLevel,
} from "@/lib/healthwatch/data";

const MapCanvas = lazy(() => import("@/components/hw/MapCanvas"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HEALTHWATCH — PH Outbreak Hotspot Map & Forecasts" },
      {
        name: "description",
        content:
          "Regional time-series forecasting and hotspot classification for seasonal illness outbreaks across all 17 Philippine regions.",
      },
      { property: "og:title", content: "HEALTHWATCH — PH Outbreak Hotspot Map" },
      {
        property: "og:description",
        content:
          "Live choropleth of Low/Moderate/High outbreak risk per Philippine region with 12-week case forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapView,
});

function MapView() {
  const [mounted, setMounted] = useState(false);
  const [illness, setIllness] = useState("all");
  const [layer, setLayer] = useState<DataLayer>("hotspot");
  const [weekIndex, setWeekIndex] = useState(CURRENT_WEEK_INDEX + 4);
  const [playing, setPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>("130000000");
  const [flyTo, setFlyTo] = useState<string | null>(null);
  const [mode, setMode] = useState<MetricMode>("percapita");

  useEffect(() => setMounted(true), []);

  const assessments = useMemo(
    () => assessAll(illness, weekIndex, mode),
    [illness, weekIndex, mode],
  );
  const counts = useMemo(() => {
    const c: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0 };
    assessments.forEach((a) => (c[a.risk] += 1));
    return c;
  }, [assessments]);
  const totalCases = assessments.reduce((a, r) => a + r.point.cases, 0);
  const nationalPer100k =
    (totalCases / assessments.reduce((s, a) => s + a.region.population, 0)) * 100000;

  const meta = weekMeta(weekIndex);

  const handleSelect = useCallback((code: string) => setSelected(code), []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        {mounted && (
          <Suspense fallback={null}>
            <MapCanvas
              illness={illness}
              weekIndex={weekIndex}
              layer={layer}
              mode={mode}
              selectedCode={selected}
              onSelect={handleSelect}
              flyToCode={flyTo}
            />
          </Suspense>
        )}
      </div>

      {/* Brand */}
      <div className="pointer-events-none absolute left-4 top-4 z-[500]">
        <div className="glass-panel pointer-events-auto flex items-center gap-2.5 rounded-xl px-3 py-2">
          <Activity className="size-5 text-primary" />
          <div>
            <p className="font-display text-sm leading-none tracking-wide">HEALTHWATCH</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              DOH · LGU outbreak decision support
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute right-4 top-4 z-[500]">
        <TopToolbar
          onPick={(code) => {
            setSelected(code);
            setFlyTo(code + ":" + Date.now());
            setFlyTo(code);
          }}
        />
      </div>

      {/* Layers sidebar */}
      <div className="absolute left-4 top-[5.5rem] z-[500]">
        <LayerSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          layer={layer}
          onLayerChange={setLayer}
          illness={illness}
          onIllnessChange={setIllness}
          counts={counts}
          mode={mode}
          onModeChange={setMode}
        />
      </div>

      {/* Forecast card */}
      {selected && (
        <div className="absolute right-4 top-[5.5rem] z-[500] max-h-[calc(100vh-11rem)] overflow-y-auto hw-scroll">
          <ForecastCard
            regionCode={selected}
            illness={illness}
            weekIndex={weekIndex}
            mode={mode}
            onClose={() => setSelected(null)}
          />
        </div>
      )}

      {/* National summary strip */}
      <div className="pointer-events-none absolute bottom-[7.5rem] left-4 z-[500]">
        <div className="glass-panel pointer-events-auto rounded-xl px-3 py-2 text-xs">
          <p className="label-caps mb-1.5">National snapshot · {meta.label}</p>
          <div className="flex items-center gap-4">
            <span className="font-display text-lg">
              {mode === "raw" ? totalCases.toLocaleString() : formatMetric(nationalPer100k, mode)}
            </span>
            <span className="text-muted-foreground">
              {meta.forecast ? "predicted" : "reported"} · {METRIC_META[mode].unit}
            </span>

            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <RiskDot risk="high" /> {counts.high}
              </span>
              <span className="flex items-center gap-1">
                <RiskDot risk="moderate" /> {counts.moderate}
              </span>
              <span className="flex items-center gap-1">
                <RiskDot risk="low" /> {counts.low}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="absolute inset-x-4 bottom-4 z-[500]">
        <TimelineScrubber
          weekIndex={weekIndex}
          onChange={setWeekIndex}
          playing={playing}
          onPlayingChange={setPlaying}
        />
      </div>
    </main>
  );
}
