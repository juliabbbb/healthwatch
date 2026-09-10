---
## PLAN 4 — FIX CASE VOLUME FORECAST CHART IN FULL REGIONAL ANALYSIS

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue forecasting system. Frontend is React 19 + Recharts + TanStack React Query + Tailwind CSS 4. Backend is FastAPI + Prophet. Do not change database schema, Prophet model logic, or routing. Fix only the broken chart rendering in the Full Regional Analysis page's Case Volume Forecast section.

### System Context
The Full Regional Analysis page has a "Case Volume Forecast" section with a Recharts chart. The chart currently renders blank/empty — no data lines, no bars, nothing — despite the page loading and other sections appearing to work. The forecasting engine (Prophet) is functional. The issue is in the data pipeline between the API response and the Recharts component.

### Item 5 — Fix Case Volume Forecast Chart

**Step 1 — Audit the chart component.**
Locate the Full Regional Analysis page (likely `src/pages/regional-analysis.tsx` or similar). Find the Recharts component responsible for "Case Volume Forecast". Read:
- The React Query hook that fetches forecast data for this chart.
- The API endpoint being called (e.g. `/api/forecast/{region}` or `/api/regions/{region}/forecast`).
- The data transformation between API response shape and the `data` prop passed to Recharts.
- The Recharts component type (LineChart? BarChart? ComposedChart?) and its `<Line>` or `<Bar>` children and their `dataKey` values.

**Step 2 — Test the API endpoint directly.**
Using browser devtools (Network tab) or curl, call the forecast endpoint for any region (e.g. NCR). Check:
- Does the endpoint return data at all?
- What is the exact shape of the JSON response? (array of objects? nested object with a `forecasts` key? snake_case or camelCase keys?)
- Are the keys returned by the API matching the `dataKey` values in the Recharts `<Line>` components?

**Step 3 — Identify and fix the data mismatch (most likely root cause).**
Common mismatches:
- API returns `{ ds: "2025-01-01", yhat: 120, yhat_lower: 80, yhat_upper: 160 }` (Prophet's native output) but Recharts dataKey is set to `"predicted"` or `"cases"`.
  - Fix: either rename in the API serializer, or transform in the frontend: `data.map(d => ({ date: d.ds, predicted: d.yhat, lower: d.yhat_lower, upper: d.yhat_upper }))`.
- React Query response is being accessed at the wrong key: `data.data` vs `data.results` vs `data.forecasts`.
- The Recharts `data` prop receives `undefined` or `null` when the query hasn't resolved yet — no `isLoading` guard means Recharts renders with no data and doesn't re-render when data arrives.
  - Fix: add `if (isLoading) return <Skeleton />` before the chart render.
- The chart container has `width: 0` or `height: 0` due to a missing `ResponsiveContainer` height prop.
  - Fix: ensure `<ResponsiveContainer width="100%" height={320}>` wraps the chart.

**Step 4 — Apply the fix.**
Once root cause is identified, fix the data pipeline end-to-end. The chart must display:
- A line for predicted case volume (`yhat`) across the forecast horizon (12 months ahead).
- Shaded area or dashed lines for prediction interval (`yhat_lower`, `yhat_upper`).
- X-axis: month labels in `MMM YYYY` format (e.g. "Jan 2025").
- Y-axis: case count (integer, non-negative — apply `Math.max(0, value)` to lower bound).
- Tooltip: show Month, Predicted Cases, Lower Bound, Upper Bound.
- A reference line or shaded region marking the wet season months (June–November) per the Philippine climate calendar.

**Step 5 — Non-negativity guard.**
On the frontend data transform, enforce non-negativity clipping:
```typescript
const chartData = rawForecast.map(d => ({
  date: d.ds,
  predicted: Math.max(0, d.yhat),
  lower: Math.max(0, d.yhat_lower),
  upper: d.yhat_upper, // upper bound is not clipped per system spec
}));
```

**Step 6 — Empty state.**
If the query returns an empty array or the endpoint errors, show a clear empty state message inside the chart container: "Forecast data unavailable for this region. Please check back later." — not a blank white box.