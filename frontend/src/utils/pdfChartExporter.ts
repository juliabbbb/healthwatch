/**
 * PDF chart rasterization utilities.
 *
 * Two capture strategies are provided:
 *  1. `captureChartAsImage` — rasterize a live chart DOM wrapper with
 *     html2canvas at scale 2 (high-DPI), preserving the dark background.
 *  2. Off-screen SVG generators — produce crisp data-URI PNGs directly from the
 *     data layer, so the PDF can embed trajectory / seasonality visuals without
 *     requiring the dashboard charts to be mounted or on screen.
 */
// html2canvas is browser-only, so it is dynamic-imported at call time to keep
// this module safe on the server (SSR / SSG never executes the import).

export interface CaptureOptions {
  scale?: number;
  backgroundColor?: string | null;
  width?: number;
  height?: number;
}

/** Rasterize a live DOM element (its chart wrapper) to a PNG data-URI. */
export async function captureChartAsImage(
  elementIdOrElement: string | HTMLElement,
  options: CaptureOptions = {},
): Promise<string> {
  const { default: html2canvas } = await import("html2canvas");

  const el =
    typeof elementIdOrElement === "string"
      ? document.getElementById(elementIdOrElement)
      : elementIdOrElement;

  if (!el) throw new Error(`Chart element not found: ${elementIdOrElement}`);

  const canvas = await html2canvas(el, {
    scale: options.scale ?? 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: options.backgroundColor ?? "#0f172a",
    ...(options.width !== undefined ? { width: options.width } : {}),
    ...(options.height !== undefined ? { height: options.height } : {}),
  });

  return canvas.toDataURL("image/png");
}

/** Rasterize many chart wrappers, reporting progress (0..1) between steps. */
export async function captureAllCharts(
  elements: Array<string | HTMLElement>,
  options: CaptureOptions = {},
  onProgress?: (step: number, total: number) => void,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const total = elements.length;
  for (let i = 0; i < total; i++) {
    const key = typeof elements[i] === "string" ? (elements[i] as string) : `chart-${i}`;
    out[key] = await captureChartAsImage(elements[i]!, options);
    onProgress?.(i + 1, total);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Off-screen SVG renderers (no DOM dependency)                        */
/* ------------------------------------------------------------------ */

interface SeriePoint {
  label: string;
  cases: number;
  forecast: boolean;
  lower?: number | null;
  upper?: number | null;
}

const NAVY = "#0f172a";
const TEAL = "#0d9488";
const FOREGROUND = "#f8fafc";
const MUTED = "#94a3b8";
const GRID = "#334155";

function toDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Trajectory SVG with forecast dashed line + optional 95% CI band. */
export function renderTrajectorySVG(
  points: SeriePoint[],
  riskColor: string = TEAL,
  options: { width?: number; height?: number } = {},
): string {
  const width = options.width ?? 720;
  const height = options.height ?? 200;
  const padL = 46;
  const padR = 16;
  const padT = 18;
  const padB = 32;
  const dw = width - padL - padR;
  const dh = height - padT - padB;

  let max = 1;
  for (const p of points) {
    const hi = p.upper ?? p.cases;
    if (hi > max) max = hi;
  }
  max = max * 1.1;

  const xAt = (i: number) =>
    points.length <= 1 ? padL + dw / 2 : padL + (i / (points.length - 1)) * dw;
  const yAt = (v: number) => padT + dh - (v / max) * dh;

  const actualPts = points.filter((p) => !p.forecast);
  const forecastPts = points.filter((p) => p.forecast);
  const bridge =
    actualPts.length && forecastPts.length
      ? [actualPts[actualPts.length - 1]!, ...forecastPts]
      : forecastPts;

  const path = (arr: SeriePoint[]) =>
    arr
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xAt(points.indexOf(p)).toFixed(1)} ${yAt(p.cases).toFixed(1)}`,
      )
      .join(" ");

  // CI band polygon over forecast points
  let ci = "";
  if (forecastPts.length > 1) {
    const top = forecastPts
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xAt(points.indexOf(p)).toFixed(1)} ${yAt(p.upper ?? p.cases).toFixed(1)}`,
      )
      .join(" ");
    const bottom = [...forecastPts]
      .reverse()
      .map((p) => `L ${xAt(points.indexOf(p)).toFixed(1)} ${yAt(p.lower ?? p.cases).toFixed(1)}`)
      .join(" ");
    ci = `${top} ${bottom} Z`;
  }

  const grid = [0, 0.5, 1]
    .map((r) => {
      const y = padT + dh * (1 - r);
      const val = (max * r).toFixed(max >= 1000 ? 0 : 1);
      return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="${GRID}" stroke-dasharray="3 3"/>
        <text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="${MUTED}">${val}</text>`;
    })
    .join("");

  const xLabels = points
    .map((p, i) => {
      if (i % 4 !== 0 && i !== points.length - 1) return "";
      return `<text x="${xAt(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="${MUTED}">${p.label.slice(2)}</text>`;
    })
    .join("");

  const dots = points
    .map((p, i) => {
      const color = p.forecast ? riskColor : FOREGROUND;
      const x = xAt(i).toFixed(1);
      const y = yAt(p.cases).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="2.5" fill="${NAVY}" stroke="${color}" stroke-width="1.2"/>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:${NAVY}">
    ${grid}
    ${ci ? `<path d="${ci}" fill="${riskColor}" fill-opacity="0.18"/>` : ""}
    ${actualPts.length ? `<path d="${path(actualPts)}" fill="none" stroke="${FOREGROUND}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${bridge.length ? `<path d="${path(bridge)}" fill="none" stroke="${riskColor}" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${dots}
    ${xLabels}
  </svg>`;

  return toDataUri(svg);
}

/** Seasonal / decomposition spectrum bars (wet vs dry drivers). */
export function renderSeasonalitySVG(
  buckets: { label: string; value: number }[],
  wetColor: string = TEAL,
  dryColor: string = "#f59e0b",
  options: { width?: number; height?: number } = {},
): string {
  const width = options.width ?? 720;
  const height = options.height ?? 160;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const dw = width - padL - padR;
  const dh = height - padT - padB;

  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.value)));
  const barW = dw / Math.max(1, buckets.length) - 4;
  const baseline = padT + dh / 2;

  const bars = buckets
    .map((b, i) => {
      const h = (Math.abs(b.value) / max) * (dh / 2) - 2;
      const x = padL + (i / Math.max(1, buckets.length)) * dw + 2;
      const color = b.value >= 0 ? wetColor : dryColor;
      const y = b.value >= 0 ? baseline - h : baseline;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${color}"/>
        <text x="${(x + barW / 2).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="9" fill="${MUTED}">${b.label}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:${NAVY}">
    <line x1="${padL}" y1="${baseline}" x2="${width - padR}" y2="${baseline}" stroke="${GRID}" stroke-dasharray="3 3"/>
    ${bars}
    <text x="${padL - 8}" y="${baseline + 3.5}" text-anchor="end" font-size="10" fill="${MUTED}">0</text>
  </svg>`;

  return toDataUri(svg);
}

/** Rasterize an SVG string to a PNG data-URI via an off-screen canvas. */
export function svgToPngDataUri(svg: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const onError = () => reject(new Error("Failed to rasterize SVG"));
    img.onerror = onError;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ratio = scale;
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        ctx.scale(ratio, ratio);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.src = svg;
  });
}
