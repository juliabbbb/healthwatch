---
## PLAN 5 — MERGE FULL REGIONAL ANALYSIS INTO SEASONALITY PAGE + DELETE REGIONAL ANALYSIS PAGE

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue forecasting system. Frontend is React 19 + TanStack Router + TanStack React Query + Tailwind CSS 4 + Recharts + React PDF Renderer. This is a significant page merge and refactor. Read all affected files fully before making any changes. Plan your moves before executing. Do not break existing routes until the new merged page is confirmed complete. Clean up dead code and unused imports after the merge is done.

### System Context
Currently there are two separate pages:
1. **Seasonality Page** — shows seasonal pattern decomposition, risk tier, outbreak indicators.
2. **Full Regional Analysis Page** — shows illness selector, month horizon selector, season selector, and the Case Volume Forecast chart + Intervention section at the bottom.

**Goal:** Merge everything from Full Regional Analysis INTO the Seasonality page. The merged Seasonality page will be the single comprehensive regional analysis view. The Full Regional Analysis page will be deleted. Any navigation link that previously went to Full Regional Analysis will instead redirect to the Seasonality page (specifically opening to "National Capital Region Seasonal Pattern Identification" as the default view).

### Item 6 — Merge Full Regional Analysis into Seasonality Page

**Step 1 — Read all affected files.**
Before touching anything, fully read:
- The Seasonality page component and all its sub-components.
- The Full Regional Analysis page component and all its sub-components.
- The TanStack Router route definitions (likely in `src/routes/` or `src/router.tsx`). Identify the route path for both pages.
- Any navigation links, sidebar items, or breadcrumbs that link to Full Regional Analysis.
- The `implementation_plan.md` in root (this file) for any prior context.

**Step 2 — Design the merged Seasonality page structure.**
The merged page layout (top to bottom):
1. **Page Header**: "Regional Seasonal Pattern Identification" — with the selected region name displayed dynamically.
2. **Selectors Row** (add these to Seasonality page, carried over from Full Regional Analysis):
   - Region selector (already exists on Seasonality page — keep it)
   - Illness selector (currently only dengue is available; render the dropdown but mark others as "Coming soon" and disable them — do not remove the selector, it future-proofs the system per the study's scope)
   - Month Horizon selector (e.g. 3, 6, 12 months ahead) — this controls the forecast chart horizon
   - Season selector (Wet / Dry / Both) — this filters the outbreak indicator display
3. **Seasonal Pattern Decomposition section** (already on Seasonality page — keep as-is)
4. **Risk Tier Classification section** (already on Seasonality page — keep as-is)
5. **Seasonal Outbreak Indicators section** (already on Seasonality page — keep as-is)
6. **Case Volume Forecast Chart section** (carry over from Full Regional Analysis — this is the Recharts chart fixed in Plan 4/Item 5)
7. **Intervention Recommendations section** (carry over from Full Regional Analysis — this is the AI-generated or static recommendations block at the bottom)
8. **Export button** (already fixed in Plan 1/Item 1 — keep and ensure it now exports ALL sections above, not just the original Seasonality sections)

**Step 3 — Carry over the selectors.**
From Full Regional Analysis, extract the illness, month horizon, and season selector components/state. Add their state to the merged Seasonality page:
```typescript
const [selectedIllness, setSelectedIllness] = useState("dengue");
const [monthHorizon, setMonthHorizon] = useState(12);
const [selectedSeason, setSelectedSeason] = useState<"wet" | "dry" | "both">("both");
```
Pass these as props or context to the relevant child sections. The Case Volume Forecast chart must react to `monthHorizon` (limit x-axis to N months ahead). The Outbreak Indicators section must react to `selectedSeason`.

**Step 4 — Carry over the Case Volume Forecast section.**
Move the entire forecast chart section (with the fixes from Plan 4/Item 5 already applied) into the merged Seasonality page. It should appear BELOW the Risk Tier and Outbreak Indicators sections, ABOVE the Intervention section.

**Step 5 — Carry over the Intervention section.**
Move the Intervention / Recommendations block from Full Regional Analysis to the bottom of the merged Seasonality page. If this section calls the LLM (which after Plan 2/Item 3 will be Groq Llama 4), ensure the call passes the correct context:
```python
# Backend prompt context to include:
# - Selected region name
# - Selected illness (dengue)
# - Risk tier (Low/Moderate/High)
# - Outbreak signal (Rule A/B status)
# - Predicted case volume for next season
# - Season (wet/dry)
```
The Intervention section should show a loading skeleton while the LLM call resolves. If LLM fails, show a static fallback: "Refer to DOH guidelines for dengue prevention and control measures appropriate to the forecasted risk level."

**Step 6 — Update the PDF export to cover the full merged page.**
The PDF export (fixed in Plan 1/Item 1) must now cover all 7 sections of the merged page. Update the PDF Document component to include the Forecast Chart and Intervention section content.

**Step 7 — Redirect Full Regional Analysis route.**
In TanStack Router, find the route for Full Regional Analysis. Replace the component with a redirect to the Seasonality page route:
```typescript
// In the Full Regional Analysis route file:
import { redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/regional-analysis")({
  beforeLoad: () => {
    throw redirect({ to: "/seasonality", search: { region: "NCR" } });
  },
});
```
Adjust the route path and search params to match your actual route structure.

**Step 8 — Delete dead code.**
After confirming the merged page works:
- Delete the Full Regional Analysis page component file.
- Delete any sub-components that were exclusive to Full Regional Analysis and are no longer used.
- Remove unused imports in the merged Seasonality page.
- Run ESLint to catch any remaining dead imports: `bun run lint`
- Remove any unused React Query hooks or API client functions that were only used by the deleted page.
- Do NOT delete shared components that are used by other pages.

**Step 9 — Update navigation.**
- Remove the Full Regional Analysis link from the sidebar/nav (if it exists as a standalone link).
- Ensure the Information tab's "Open Regional Analysis" CTA now navigates to the merged Seasonality page with the correct region pre-selected (see Plan 6/Item 7 below for the Information tab link specifically).