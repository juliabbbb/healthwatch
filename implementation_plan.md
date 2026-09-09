Standing Directive

You are adding a chart-type toggle to every existing chart in the HEALTHWATCH frontend. HEALTHWATCH displays Philippine regional disease surveillance data using Recharts. Every existing chart currently renders as a Line Chart (or Area Chart). You will add a toggle button that lets the user switch the same data to a Bar Chart view, and back. This is a UI enhancement only. Do NOT change any data-fetching logic, API calls, query keys, computations, or route structures. Do NOT redesign anything — match the existing visual style exactly.

System Context
Frontend: React 19 + Vite 8 + TypeScript 5.8
Charting library: Recharts (already installed)
State management for server data: TanStack React Query
Styling: Tailwind CSS 4 + Radix UI (shadcn/ui pattern)
Routing: TanStack Router (file-based)
Charts are distributed across multiple pages: Seasonality, Forecast/Predictions, Compare, possibly Dashboard/Overview
All chart components likely live in src/components/ or co-located with route files
Full Task List
2.1 — Audit All Chart Components
Search the entire src/ directory for Recharts usage:
<LineChart, <AreaChart, <ComposedChart, <ResponsiveContainer
List every file, component name, and the chart type currently used
Note: some charts may already use ComposedChart — these are the easiest to extend
Document the full list before making any changes
2.2 — Create a Reusable ChartTypeToggle Component
Create file: src/components/ui/ChartTypeToggle.tsx
This component renders two toggle buttons: "Line" and "Bar"
Props interface:
typescript
  interface ChartTypeToggleProps {
    value: "line" | "bar";
    onChange: (type: "line" | "bar") => void;
  }
Style using existing Tailwind classes that match the current button style in the app
Use Radix UI ToggleGroup if it is already imported in the project; otherwise use plain styled <button> elements
Active state: match the existing active/selected button style already used in the app (e.g., on the region selector buttons)
Icons: use a simple SVG or text label — "Line" / "Bar" — no external icon library needed unless Lucide is already in the project (check package.json)
2.3 — Create a useChartType Hook
Create file: src/hooks/useChartType.ts
Simple hook that holds chart type state:
typescript
  import { useState } from "react";

  export type ChartType = "line" | "bar";

  export function useChartType(defaultType: ChartType = "line") {
    const [chartType, setChartType] = useState<defaultType>(defaultType);
    return { chartType, setChartType };
  }
This is used by every chart parent component to avoid duplicating state logic
2.4 — Refactor Each Chart Component to Support Both Types
For each chart found in Step 2.1, apply this pattern:
Import both LineChart (or AreaChart) and BarChart, plus Bar and Line from Recharts
Accept chartType: "line" | "bar" as a prop (or manage state internally if simpler)
Switch the outer chart component conditionally:
typescript
    const ChartComponent = chartType === "bar" ? BarChart : LineChart;
Switch the series renderer conditionally:
typescript
    const SeriesComponent = chartType === "bar" ? Bar : Line;
Use the same data, XAxis, YAxis, CartesianGrid, Tooltip, Legend props for both — they are identical in Recharts
For Bar, add radius={[4, 4, 0, 0]} for slightly rounded bar tops (matches modern look)
For Line, keep existing dot, strokeWidth, and type props as-is
Wrap the toggle with the chart in the parent component, NOT inside the chart component itself
2.5 — Multi-Series Charts (Compare Page)
The Compare page likely renders multiple data series (one per region)
For Bar charts with multiple series, use BarChart with grouped bars:
Each region gets its own <Bar dataKey="regionName" /> with its own color
This is identical to how multiple <Line> components work — one per series
Do NOT use stacked bars — keep the same grouped approach as the line chart's multi-series display
2.6 — Placement of the Toggle
Place the ChartTypeToggle in the top-right corner of each chart's card/container
It should sit on the same row as the chart title, aligned to the right
Use flex justify-between items-center on the chart header row
Example layout:
  [ Chart Title                          ] [ Line | Bar ]
  [                                                     ]
  [              Chart renders here                     ]
  [                                                     ]
Do not add extra padding or margin — match existing card spacing exactly
2.7 — Pages to Update

Apply the toggle to charts on ALL of these pages (based on the audit in 2.1):

Seasonality page — regional seasonality trend chart(s)
Forecast/Predictions page — forecast line charts (Prophet output)
Compare page — multi-region comparison charts
Dashboard/Overview page — any summary charts present
Any other page that renders a Recharts chart component
2.8 — Do NOT Touch
Data fetching (React Query hooks, useQuery calls)
API endpoints
Any computation or data transformation logic
The map page (Leaflet — not a Recharts chart)
PDF export logic
Routing configuration

Do NOT change any feature behavior — only what is explicitly stated in each plan
Do NOT upgrade or downgrade any package versions unless required by the plan
Do NOT rename any existing API routes, query keys, or data shapes
Do NOT touch the render.yaml (Render Blueprint IaC) unless adding an env var reference
When in doubt about scope: do less, not more — then ask
All new files must follow the existing project's file naming convention (kebab-case or PascalCase as observed in the project)
All TypeScript must be strictly typed — no any unless the existing codebase already uses it in that file