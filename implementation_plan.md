Standing Directive

You are making two targeted UI improvements to the HEALTHWATCH frontend. First: on the Seasonality page, replace the current "all regions displayed at once" layout with a single dropdown selector, reducing visual clutter and keeping focus on one region's data at a time. Second: on the Compare page, fix the region selection buttons — they must ALL remain visible and accessible, but their layout must be properly spaced, aligned, and visually consistent. These are layout/UX changes only. No data-fetching, no API changes, no computation changes.

System Context
Frontend: React 19 + TypeScript
Styling: Tailwind CSS 4 + Radix UI (shadcn/ui pattern)
The 18 Philippine regions: NCR, CAR, Region I, II, III, IV-A, IV-B, V, VI, VII, VIII, IX, X, XI, XII, XIII, BARMM
Seasonality page: currently shows data for all regions, needs to be filtered to one at a time via dropdown
Compare page: currently has region buttons that are misaligned/inconsistently spaced — all 18 must stay, just fix the layout
Full Task List
5.1 — Audit the Current Seasonality Page Layout
Identify how the current region display works:
Is it a list of cards? A set of stacked charts? A table with region rows?
Is there already a selectedRegion state variable, or does the page show all regions simultaneously?
Identify how the data is fetched: is it one query for all regions, or one per region?
Identify where the region selection UI currently exists (if at all)
Document the exact component tree before changing anything
5.2 — Implement Region Dropdown on Seasonality Page
Add a selectedRegion state:
typescript
  const PHILIPPINE_REGIONS = [
    "NCR", "CAR", "Region I", "Region II", "Region III",
    "Region IV-A", "Region IV-B", "Region V", "Region VI",
    "Region VII", "Region VIII", "Region IX", "Region X",
    "Region XI", "Region XII", "Region XIII", "BARMM"
  ];

  const [selectedRegion, setSelectedRegion] = useState<string>("NCR");
Use a Radix UI Select component (from the existing shadcn/ui setup):
If Select from shadcn is already in src/components/ui/select.tsx, use it directly
If not, use the native HTML <select> styled with Tailwind as a fallback
Dropdown placement: above the chart area, on the same row as the page section title
Label: "Region:" to the left of the dropdown
Dropdown width: w-48 or min-w-[12rem] — wide enough for "Region IV-A" without truncation
Layout row:
  [ Seasonality Analysis ]        [ Region: ▼ Region III — Central Luzon ]
5.3 — Filter Chart and Table Data by Selected Region
After adding the dropdown, the chart and any data table on the Seasonality page must reflect ONLY the selected region's data
If data is fetched for all regions at once: filter the data client-side using the selectedRegion value
If data is fetched per region: pass selectedRegion as a query parameter to the useQuery hook — it will automatically refetch when the region changes (TanStack Query handles this)
DO NOT change the data fetching URL structure unless it is already parameterized by region
DO NOT change any computation or the shape of the data
5.4 — Handle Loading State During Region Switch
When selectedRegion changes and a new API call is triggered, show a loading skeleton where the chart is:
typescript
  if (isLoading) return <div className="h-64 animate-pulse bg-slate-100 rounded-lg" />;
This prevents a flash of stale data from the previous region
5.5 — Audit the Current Compare Page Button Layout
Identify the current region selector on the Compare page:
How many regions are shown? (Should be all 18)
Are they rendered as a flex-wrap, a grid, or a list?
What is the current spacing/gap issue? (overflow, misalignment, inconsistent widths, buttons of different heights)
Are multiple regions selectable simultaneously (multi-select for comparison)?
Document the exact current layout structure
5.6 — Fix Compare Page Region Button Layout
The goal: all 18 region buttons must be visible, accessible, properly spaced, and consistently sized
Use a CSS Grid layout for predictable alignment:
tsx
  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
    {PHILIPPINE_REGIONS.map((region) => (
      <button
        key={region}
        onClick={() => toggleRegion(region)}
        className={cn(
          "px-3 py-2 text-sm font-medium rounded-md border transition-colors",
          "truncate text-center", // prevent text overflow on narrow buttons
          selectedRegions.includes(region)
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-foreground border-border hover:bg-accent"
        )}
      >
        {region}
      </button>
    ))}
  </div>
Grid columns: 3 on mobile, 4 on small screens, 6 on large — so all 18 fit in exactly 3 rows of 6 on desktop
Button width: uniform within each column (grid enforces this automatically)
Button height: uniform — use consistent py-2 padding
Text: use truncate to handle long names like "Region IV-A" gracefully
cn() utility: the project already uses this from shadcn — import from lib/utils
Preserve the existing multi-select toggle logic — only change the layout wrapper and button classes
5.7 — Preserve Compare Page Functionality
All 18 region buttons must remain clickable
Multi-select behavior (if currently present) must be preserved exactly
The chart/graph that responds to region selection must continue to work
Only the visual layout of the button group changes — nothing else
5.8 — Apply Consistent Button Styling
The Compare page region buttons must visually match the active/inactive style already used in the app
Check: what color/style does the app use for "active" vs "inactive" buttons elsewhere (e.g., on the nav, on other filter components)?
Mirror that exact style — do not introduce new design tokens
If using Tailwind, use the same class names for the active state as the rest of the app
5.9 — Responsive Check
After implementing both changes:
Test the Seasonality dropdown on a narrow viewport (375px) — it must not overflow
Test the Compare button grid on a narrow viewport — it must wrap to 3 columns and remain scrollable if needed
Do NOT add horizontal scrolling — let it wrap
5.10 — Do NOT Touch
Any data fetching or API calls on either page
The chart components themselves (Recharts)
The comparison logic that determines which regions' data is shown in the compare chart
Any other page (Map, Dashboard, Forecast, etc.)
PDF export buttons on these pages

Do NOT change any feature behavior — only what is explicitly stated in each plan
Do NOT upgrade or downgrade any package versions unless required by the plan
Do NOT rename any existing API routes, query keys, or data shapes
Do NOT touch the render.yaml (Render Blueprint IaC) unless adding an env var reference
When in doubt about scope: do less, not more — then ask
All new files must follow the existing project's file naming convention (kebab-case or PascalCase as observed in the project)
All TypeScript must be strictly typed — no any unless the existing codebase already uses it in that file