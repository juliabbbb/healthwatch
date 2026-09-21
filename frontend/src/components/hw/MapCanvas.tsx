import { useEffect, useRef, useState } from "react";
import type {
  Map as LeafletMap,
  GeoJSON as LeafletGeoJSON,
  Layer,
  PathOptions,
  TileLayer,
} from "leaflet";
import {
  CURRENT_MONTH_INDEX,
  REGION_BY_GEONAME,
  REGIONS,
  TOTAL_MONTHS,
  assessRegion,
  dataReady,
  formatMetric,
  metricValue,
  RISK_META,
  type MetricMode,
  type Region,
} from "@/lib/healthwatch/data";
import { formatMonthYear } from "@/utils/formatDate";

export type DataLayer = "hotspot" | "density";

interface Props {
  illness: string;
  monthIndex: number;
  mode: MetricMode;
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  flyToCode?: string | null;
  showOutbreakMarkers?: boolean;
}

const PH_CENTER: [number, number] = [12.8797, 121.774];

/** CARTO raster basemaps (Voyager for light, Dark Matter for dark — both labeled). */
const CARTO_KEY = import.meta.env["VITE_CARTO_API_KEY"] as string | undefined;
const TILE_URLS = {
  light: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
  dark: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY}`,
} as const;

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a> · Boundaries: PSA PSGC';

function prefersDark(): boolean {
  return typeof document !== "undefined"
    ? document.documentElement.classList.contains("dark")
    : false;
}

/** Small ring/dot glyph at ~half the previous size — a subtle secondary detail over the fill. */
const OUTBREAK_MARKER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.4" fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="1.6"/><circle cx="7" cy="7" r="5.4" fill="color-mix(in oklab, var(--risk-high) 32%, transparent)" stroke="var(--risk-high)" stroke-width="1.4"/></svg>';

function fillFor(region: Region, illness: string, monthIndex: number, mode: MetricMode): string {
  // Region fill always reflects the risk tier, whatever is overlaid on top.
  return RISK_META[assessRegion(region.code, illness, monthIndex, mode).risk].color;
}

export default function MapCanvas({
  illness,
  monthIndex,
  mode,
  selectedCode,
  onSelect,
  flyToCode,
  showOutbreakMarkers = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const darkRef = useRef<boolean>(false);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const alertIconRef = useRef<import("leaflet").DivIcon | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const stateRef = useRef({ illness, monthIndex, mode, selectedCode, onSelect });
  stateRef.current = { illness, monthIndex, mode, selectedCode, onSelect };

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: MutationObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      darkRef.current = prefersDark();
      map = L.map(containerRef.current, {
        center: PH_CENTER,
        zoom: 6,
        minZoom: 5,
        maxZoom: 12,
        zoomControl: false,
        attributionControl: true,
        maxBounds: L.latLngBounds([3.5, 114.5], [22.0, 129.0]),
        maxBoundsViscosity: 0.85,
      });
      mapRef.current = map;

      // Tap on empty map background dismisses selected region
      map.on("click", () => {
        stateRef.current.onSelect(null);
      });

      tileRef.current = L.tileLayer(darkRef.current ? TILE_URLS.dark : TILE_URLS.light, {
        attribution: CARTO_ATTRIBUTION,
        maxZoom: 12,
        crossOrigin: "anonymous",
      }).addTo(map);

      const res = await fetch("/geo/ph-regions.geojson");
      const geo = await res.json();
      if (cancelled || !mapRef.current) return;

      const style = (feature?: { properties?: { REGION?: string } }): PathOptions => {
        const region = REGION_BY_GEONAME[feature?.properties?.REGION ?? ""];
        const s = stateRef.current;
        if (!region) return { fillOpacity: 0, weight: 0 };
        const selected = s.selectedCode === region.code;
        // Border ink flips with the basemap so regions stay crisp on both.
        const border = darkRef.current
          ? { stroke: selected ? "oklch(0.98 0 0 / 90%)" : "oklch(0.98 0 0 / 35%)" }
          : { stroke: selected ? "oklch(0.24 0.008 85 / 85%)" : "oklch(0.24 0.008 85 / 25%)" };
        return {
          fillColor: fillFor(region, s.illness, s.monthIndex, s.mode),
          fillOpacity: selected ? 0.78 : 0.55,
          color: border.stroke,
          weight: selected ? 2 : 0.8,
        };
      };

      const geoLayer = L.geoJSON(geo, {
        style: style as never,
        onEachFeature: (feature: { properties?: { REGION?: string } }, lyr: Layer) => {
          const region = REGION_BY_GEONAME[feature.properties?.REGION ?? ""];
          if (!region) return;
          lyr.bindTooltip(region.short, {
            direction: "center",
            className: "hw-tooltip",
            opacity: 0.9,
          });
          lyr.on("click", (e: import("leaflet").LeafletMouseEvent) => {
            if (e?.originalEvent) L.DomEvent.stopPropagation(e);
            stateRef.current.onSelect(region.code);
          });
          lyr.on("mouseover", () =>
            (lyr as unknown as { setStyle: (o: PathOptions) => void }).setStyle({
              fillOpacity: 0.85,
              weight: 1.6,
            }),
          );
          lyr.on("mouseout", () => geoRef.current?.resetStyle(lyr as never));
        },
      }).addTo(map);
      geoRef.current = geoLayer;

      // Outbreak markers: small ring glyphs at region centroids, above the
      // risk-tier fill. Opt-in (showOutbreakMarkers) — the basemap loads with
      // fill only; markers are rebuilt when the toggle, illness, baseline month,
      // or metric changes.
      leafletRef.current = L;
      alertIconRef.current = L.divIcon({
        className: "hw-outbreak-marker",
        html: OUTBREAK_MARKER_SVG,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      markerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);

      // Swap basemap + border ink live when the theme toggles.
      observer = new MutationObserver(() => {
        const dark = prefersDark();
        if (dark === darkRef.current) return;
        darkRef.current = dark;
        tileRef.current?.setUrl(dark ? TILE_URLS.dark : TILE_URLS.light);
        const geoLayer = geoRef.current;
        if (geoLayer) {
          geoLayer.eachLayer((lyr) => geoLayer.resetStyle(lyr as never));
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      geoRef.current = null;
      tileRef.current = null;
      markerRef.current = null;
      alertIconRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  // Restyle on data changes (risk-tier fill).
  useEffect(() => {
    const geoLayer = geoRef.current;
    if (!geoLayer) return;
    geoLayer.eachLayer((lyr) => geoLayer.resetStyle(lyr as never));
  }, [illness, monthIndex, mode, selectedCode]);

  // Outbreak-likelihood markers, opt-in. Rebuilt whenever the toggle, illness,
  // baseline month, or metric changes; the off state leaves the risk-tier fill
  // as the only layer. Markers pin to the next projected month after the
  // currently displayed baseline (never earlier than the forecast horizon) so
  // they always reflect forecast data, and appear only when that projected
  // load classifies as high risk (above the seasonal P75 threshold).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await dataReady;
      const Lf = leafletRef.current;
      const group = markerRef.current;
      const icon = alertIconRef.current;
      if (cancelled || !Lf || !group || !icon) return;
      group.clearLayers();
      if (!showOutbreakMarkers) return;
      const nextIdx = Math.min(Math.max(CURRENT_MONTH_INDEX, monthIndex) + 1, TOTAL_MONTHS - 1);
      for (const r of REGIONS) {
        const next = assessRegion(r.code, illness, nextIdx, mode);
        if (next.risk !== "high") continue;

        const targetMonth = formatMonthYear(next.point.label);
        const casesCount = next.point.cases.toLocaleString();
        const perCapitaVal = formatMetric(metricValue(next.point.cases, r, "percapita"), "percapita");

        const tooltipHtml = `
          <div class="hw-outbreak-tip">
            <div class="hw-outbreak-tip-header">
              <span class="hw-outbreak-tip-badge">Next Month Forecast</span>
              <span class="hw-outbreak-tip-month">${targetMonth}</span>
            </div>
            <div class="hw-outbreak-tip-region">${r.short} · ${r.name}</div>
            <div class="hw-outbreak-tip-stat">
              <span class="hw-outbreak-tip-val">${mode === "percapita" ? perCapitaVal : casesCount}</span>
              <span class="hw-outbreak-tip-unit">${mode === "percapita" ? "per 100k/mo" : "cases"}</span>
              ${mode === "percapita" ? `<span class="hw-outbreak-tip-subval">(${casesCount} cases)</span>` : ""}
            </div>
            <div class="hw-outbreak-tip-footer">
              <span class="hw-outbreak-tip-pill">High Risk Alert</span>
              <span class="hw-outbreak-tip-note">Exceeds seasonal P75 threshold</span>
            </div>
          </div>
        `;

        const m = Lf.marker([r.lat, r.lng], { icon, interactive: true })
          .addTo(group)
          .bindTooltip(tooltipHtml, {
            direction: "top",
            offset: [0, -8],
            className: "hw-outbreak-tooltip",
            opacity: 1,
          });

        m.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          if (e?.originalEvent) Lf.DomEvent.stopPropagation(e);
          stateRef.current.onSelect(r.code);
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [illness, monthIndex, mode, showOutbreakMarkers, mapReady, dataReady]);

  // Fly to a searched/selected region
  useEffect(() => {
    if (!flyToCode || !mapRef.current) return;
    const region = Object.values(REGION_BY_GEONAME).find((r) => r.code === flyToCode);
    if (region) mapRef.current.flyTo([region.lat, region.lng], 7.5, { duration: 0.9 });
  }, [flyToCode]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
