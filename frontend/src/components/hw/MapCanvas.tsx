import { useEffect, useRef } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, Layer, PathOptions } from "leaflet";
import {
  REGION_BY_GEONAME,
  assessRegion,
  climate,
  weekMeta,
  RISK_META,
  type MetricMode,
  type Region,
} from "@/lib/healthwatch/data";

export type DataLayer = "hotspot" | "density" | "precipitation" | "temperature" | "humidity";

interface Props {
  illness: string;
  weekIndex: number;
  layer: DataLayer;
  mode: MetricMode;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  flyToCode?: string | null;
}

const PH_CENTER: [number, number] = [12.8797, 121.774];

function ramp(t: number): string {
  // 0 -> low, 1 -> high, through the risk palette
  if (t < 0.5) return `color-mix(in oklab, var(--risk-low), var(--risk-moderate) ${t * 200}%)`;
  return `color-mix(in oklab, var(--risk-moderate), var(--risk-high) ${(t - 0.5) * 200}%)`;
}

function fillFor(
  region: Region,
  illness: string,
  weekIndex: number,
  layer: DataLayer,
  mode: MetricMode,
): string {
  if (layer === "hotspot") {
    return RISK_META[assessRegion(region.code, illness, weekIndex, mode).risk].color;
  }
  if (layer === "density") {
    const a = assessRegion(region.code, illness, weekIndex, mode);
    const per100k = (a.point.cases / region.population) * 100000;
    return ramp(Math.min(1, per100k / 12));
  }
  const meta = weekMeta(weekIndex);
  const month = Math.min(11, Math.floor(((meta.week - 1) / 52) * 12));
  const c = climate(region.code)[month]!;
  if (layer === "precipitation") return ramp(Math.min(1, c.rainfall / 480));
  if (layer === "temperature") return ramp(Math.min(1, Math.max(0, (c.temp - 24) / 8)));
  return ramp(Math.min(1, Math.max(0, (c.humidity - 65) / 25)));
}

export default function MapCanvas({
  illness,
  weekIndex,
  layer,
  mode,
  selectedCode,
  onSelect,
  flyToCode,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const stateRef = useRef({ illness, weekIndex, layer, mode, selectedCode, onSelect });
  stateRef.current = { illness, weekIndex, layer, mode, selectedCode, onSelect };

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors · Boundaries: PSA PSGC",
        maxZoom: 12,
      }).addTo(map);

      const res = await fetch("/geo/ph-regions.geojson");
      const geo = await res.json();
      if (cancelled || !mapRef.current) return;

      const style = (feature?: { properties?: { REGION?: string } }): PathOptions => {
        const region = REGION_BY_GEONAME[feature?.properties?.REGION ?? ""];
        const s = stateRef.current;
        if (!region) return { fillOpacity: 0, weight: 0 };
        const selected = s.selectedCode === region.code;
        return {
          fillColor: fillFor(region, s.illness, s.weekIndex, s.layer, s.mode),
          fillOpacity: selected ? 0.78 : 0.55,
          color: selected ? "oklch(0.98 0 0 / 90%)" : "oklch(0.98 0 0 / 35%)",
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
          lyr.on("click", () => stateRef.current.onSelect(region.code));
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
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      geoRef.current = null;
    };
  }, []);

  // Restyle on data changes
  useEffect(() => {
    const geoLayer = geoRef.current;
    if (!geoLayer) return;
    geoLayer.eachLayer((lyr) => geoLayer.resetStyle(lyr as never));
  }, [illness, weekIndex, layer, mode, selectedCode]);

  // Fly to a searched/selected region
  useEffect(() => {
    if (!flyToCode || !mapRef.current) return;
    const region = Object.values(REGION_BY_GEONAME).find((r) => r.code === flyToCode);
    if (region) mapRef.current.flyTo([region.lat, region.lng], 7.5, { duration: 0.9 });
  }, [flyToCode]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
