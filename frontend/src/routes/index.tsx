import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Globe, X } from "lucide-react";
import type { DataLayer } from "@/components/hw/MapCanvas";
import { TimelineScrubber } from "@/components/hw/TimelineScrubber";
import { TopToolbar } from "@/components/hw/TopToolbar";
import { ForecastCard } from "@/components/hw/ForecastCard";
import { MobileBottomSheet } from "@/components/hw/MobileBottomSheet";
import { NationalSnapshot } from "@/components/hw/NationalSnapshot";
import { AlertsPanel } from "@/components/hw/AlertsPanel";
import {
  CURRENT_MONTH_INDEX,
  OUTBREAK_BENCHMARK_SEASON,
  assessAll,
  formatMetric,
  monthMeta,
  type MetricMode,
  type Season,
} from "@/lib/healthwatch/data";
import { deriveAlerts } from "@/lib/healthwatch/alerts";
import { formatMonthYear } from "@/utils/formatDate";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

const MapCanvas = lazy(() => import("@/components/hw/MapCanvas"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HealthWatch" },
      {
        name: "description",
        content:
          "Regional time-series forecasting and hotspot classification for seasonal illness outbreaks across all 18 Philippine regions.",
      },
      { property: "og:title", content: "HEALTHWATCH — PH Outbreak Hotspot Map" },
      {
        property: "og:description",
        content:
          "Live choropleth of Low/Moderate/High outbreak risk per Philippine region with 12-month case forecasts.",
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
  const [monthIndex, setMonthIndex] = useState(CURRENT_MONTH_INDEX);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<string | null>(null);
  const [mode, setMode] = useState<MetricMode>("percapita");
  const [layer, setLayer] = useState<DataLayer>("hotspot");
  const [outbreakSeason, setOutbreakSeason] = useState<Season>(OUTBREAK_BENCHMARK_SEASON);
  const [showOutbreakMarkers, setShowOutbreakMarkers] = useState(false);
  const [mobileNationalOpen, setMobileNationalOpen] = useState(false);

  // Lock background scroll while the mobile national drawer is open
  useBodyScrollLock(mobileNationalOpen);

  useEffect(() => setMounted(true), []);

  const assessments = useMemo(
    () => assessAll(illness, monthIndex, mode),
    [illness, monthIndex, mode],
  );
  const counts = useMemo(() => {
    const c = { high: 0, moderate: 0, low: 0 };
    assessments.forEach((a) => (c[a.risk] += 1));
    return c;
  }, [assessments]);
  const alerts = useMemo(
    () => deriveAlerts(assessments, illness, outbreakSeason),
    [assessments, illness, outbreakSeason],
  );

  const totalCases = assessments.reduce((a, r) => a + r.point.cases, 0);
  const nationalPer100k =
    (totalCases / assessments.reduce((s, a) => s + a.region.population, 0)) * 100000;

  const meta = monthMeta(monthIndex);

  const handleSelect = useCallback((code: string | null) => setSelected(code), []);
  const handleFocusRegion = useCallback((code: string) => {
    setSelected(code);
    setFlyTo(code);
    setMobileNationalOpen(false);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      {/* 1. Interactive Map Layer */}
      <div className="absolute inset-0 z-0">
        {mounted && (
          <Suspense fallback={null}>
            <MapCanvas
              illness={illness}
              monthIndex={monthIndex}
              mode={mode}
              selectedCode={selected}
              onSelect={handleSelect}
              flyToCode={flyTo}
              outbreakSeason={outbreakSeason}
              showOutbreakMarkers={showOutbreakMarkers}
            />
          </Suspense>
        )}
      </div>

      {/* 2. DESKTOP ONLY: Top-Left Dock (National Snapshot + Active Alerts) - Perfectly matched widths */}
      <div className="pointer-events-none absolute left-4 top-4 z-30 hidden md:flex max-h-[calc(100vh-11rem)] w-[30rem] lg:w-[31.5rem] max-w-[calc(100vw-2rem)] flex-col items-start gap-3 overflow-hidden">
        <NationalSnapshot
          monthLabel={meta.label}
          isForecast={meta.forecast}
          value={mode === "raw" ? totalCases : nationalPer100k}
          mode={mode}
          onModeChange={setMode}
          illness={illness}
          onIllnessChange={setIllness}
          counts={counts}
          dominantIllness={assessments[0]?.dominantIllness.name ?? "—"}
          showOutbreakMarkers={showOutbreakMarkers}
          onOutbreakMarkersChange={setShowOutbreakMarkers}
          className="shrink-0"
        />

        {/* Active Alerts */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <AlertsPanel alerts={alerts} onFocusRegion={handleFocusRegion} />
        </div>
      </div>

      {/* 5. DESKTOP ONLY: Floating Forecast Card on Right */}
      {selected && (
        <div className="pointer-events-auto absolute right-4 top-[5.5rem] z-30 hidden md:block max-h-[calc(100vh-11rem)] overflow-y-auto hw-scroll">
          <ForecastCard
            regionCode={selected}
            illness={illness}
            monthIndex={monthIndex}
            mode={mode}
            onModeChange={setMode}
            onClose={() => setSelected(null)}
            outbreakSeason={outbreakSeason}
            onOutbreakSeasonChange={setOutbreakSeason}
          />
        </div>
      )}

      {/* 7. DESKTOP ONLY: Repositioned Logo (Bottom-Left) */}
      <div className="pointer-events-none absolute left-4 bottom-20 z-30 hidden md:block">
        <div className="glass-panel pointer-events-auto flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 shadow-md">
          <Activity className="size-5 text-primary" />
          <div>
            <p className="text-sm font-bold leading-none tracking-wide text-foreground">
              HEALTHWATCH
            </p>
            <p className="mt-1 label-caps text-[10px]">Regional Outbreak Hotspot Map & Forecasts</p>
          </div>
        </div>
      </div>

      {/* 3. MOBILE ONLY: Top-Left Floating National Overview Trigger Pill */}
      <div className="pointer-events-auto absolute left-3 top-3 z-30 flex md:hidden items-center">
        <button
          onClick={() => setMobileNationalOpen(true)}
          aria-label="Open national surveillance overview"
          aria-expanded={mobileNationalOpen}
          className="glass-panel flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-foreground shadow-md hover:shadow-lg hover:border-primary/50 hover:bg-secondary/60 active:scale-95 transition-all duration-150 border border-border/80 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <Globe className="size-3.5 text-primary shrink-0 transition-transform group-hover:scale-110" />
          <span>PH · {counts.high} High</span>
          <ChevronDown className="size-3 text-muted-foreground/80 shrink-0 ml-0.5 transition-transform duration-150 group-hover:translate-y-0.5" />
        </button>
      </div>

      {/* 4. Top Navigation Bar (Desktop Toolbar / Mobile Hamburger Bar) */}
      <div className="absolute right-3 top-3 md:right-4 md:top-4 z-30">
        <TopToolbar onPick={handleFocusRegion} />
      </div>

      {/* 6. MOBILE ONLY: Collapsible Bottom Sheet for Region Data (Mutually exclusive with DatePlayer) */}
      <MobileBottomSheet
        regionCode={mobileNationalOpen ? null : selected}
        illness={illness}
        monthIndex={monthIndex}
        mode={mode}
        onModeChange={setMode}
        layer={layer}
        onLayerChange={setLayer}
        onClose={() => setSelected(null)}
      />

      {/* 8. DatePlayer / Timeline Scrubber (Mutually exclusive with MobileBottomSheet on mobile) */}
      <div
        className={`absolute inset-x-3 md:inset-x-4 z-30 transition-all duration-300 ease-in-out md:bottom-4 md:translate-y-0 md:opacity-100 md:pointer-events-auto ${
          selected || mobileNationalOpen
            ? "bottom-3 translate-y-16 opacity-0 pointer-events-none"
            : "bottom-3 translate-y-0 opacity-100 pointer-events-auto"
        }`}
      >
        <TimelineScrubber
          monthIndex={monthIndex}
          onChange={setMonthIndex}
          playing={playing}
          onPlayingChange={setPlaying}
        />
      </div>

      {/* 9. MOBILE ONLY: Slide-Over Drawer for National Overview & Alerts (Full width alignment) */}
      {mobileNationalOpen && (
        <div className="fixed inset-0 z-[700] flex flex-col justify-end bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in-0 duration-200">
          <div onClick={() => setMobileNationalOpen(false)} className="flex-1" aria-hidden="true" />
          <div className="flex max-h-[88vh] flex-col rounded-t-2xl border-t border-border/80 bg-card/98 backdrop-blur-2xl p-4 sm:p-5 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto hw-scroll">
            <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  National Surveillance Overview
                </h2>
              </div>
              <button
                onClick={() => setMobileNationalOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95"
                aria-label="Close national snapshot"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 pb-6">
              <NationalSnapshot
                monthLabel={meta.label}
                isForecast={meta.forecast}
                value={mode === "raw" ? totalCases : nationalPer100k}
                mode={mode}
                onModeChange={setMode}
                illness={illness}
                onIllnessChange={setIllness}
                counts={counts}
                dominantIllness={assessments[0]?.dominantIllness.name ?? "—"}
                className="shadow-none border-none bg-transparent"
              />

              <div className="border-t border-border/70 pt-3">
                <AlertsPanel
                  alerts={alerts}
                  onFocusRegion={(code) => {
                    handleFocusRegion(code);
                    setMobileNationalOpen(false);
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
