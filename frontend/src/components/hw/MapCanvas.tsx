import { useEffect, useRef } from "react";
import type {
  Map as LeafletMap,
  GeoJSON as LeafletGeoJSON,
  Layer,
  PathOptions,
  TileLayer,
} from "leaflet";
import {
  REGION_BY_GEONAME,
  assessRegion,
  getOutbreak,
  RISK_META,
  type MetricMode,
  type Region,
  type Season,
} from "@/lib/healthwatch/data";

export type DataLayer = "hotspot" | "density" | "outbreak";

interface Props {
  illness: string;
  weekIndex: number;
  layer: DataLayer;
  mode: MetricMode;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  flyToCode?: string | null;
  outbreakSeason?: Season;
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
  outbreakSeason: Season,
): string {
  if (layer === "hotspot") {
    return RISK_META[assessRegion(region.code, illness, weekIndex, mode).risk].color;
  }
  if (layer === "outbreak") {
    // Seasonal outlook (backend /outbreak indicator), dengue pilot: regions
    // with an outbreak flag on the active season read as alert; the rest stay
    // on the normal (low) tone.
    return getOutbreak(region.code)[outbreakSeason]?.outbreak
      ? "var(--risk-high)"
      : "var(--risk-low)";
  }
  const a = assessRegion(region.code, illness, weekIndex, mode);
  const per100k = (a.point.cases / region.population) * 100000;
  return ramp(Math.min(1, per100k / 12));
}

export default function MapCanvas({
  illness,
  weekIndex,
  layer,
  mode,
  selectedCode,
  onSelect,
  flyToCode,
  outbreakSeason = "dry",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const darkRef = useRef<boolean>(false);
  const stateRef = useRef({ illness, weekIndex, layer, mode, selectedCode, onSelect, outbreakSeason });
  stateRef.current = { illness, weekIndex, layer, mode, selectedCode, onSelect, outbreakSeason };

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

      tileRef.current = L.tileLayer(
        darkRef.current ? TILE_URLS.dark : TILE_URLS.light,
        {
          attribution: CARTO_ATTRIBUTION,
          maxZoom: 12,
        },
      ).addTo(map);

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
          fillColor: fillFor(region, s.illness, s.weekIndex, s.layer, s.mode, s.outbreakSeason),
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
    };
  }, []);

  // Restyle on data changes
  useEffect(() => {
    const geoLayer = geoRef.current;
    if (!geoLayer) return;
    geoLayer.eachLayer((lyr) => geoLayer.resetStyle(lyr as never));
  }, [illness, weekIndex, layer, mode, selectedCode, outbreakSeason]);

  // Fly to a searched/selected region
  useEffect(() => {
    if (!flyToCode || !mapRef.current) return;
    const region = Object.values(REGION_BY_GEONAME).find((r) => r.code === flyToCode);
    if (region) mapRef.current.flyTo([region.lat, region.lng], 7.5, { duration: 0.9 });
  }, [flyToCode]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
