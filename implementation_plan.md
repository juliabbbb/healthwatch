Standing Directive

You are fixing two broken PDF export features in HEALTHWATCH and enhancing the PDF layout quality across all pages that have export functionality. The Seasonality page's export PDF button does not include the actual chart/data from the page. The Map page's export button does nothing at all. Both must be fixed. Additionally, all existing PDF exports must receive layout and formatting improvements to produce a professional, readable document. This is primarily a frontend task using React PDF Renderer (@react-pdf/renderer), which is already installed.

System Context
Frontend: React 19 + Vite 8 + TypeScript
PDF library: @react-pdf/renderer (already in package.json)
The system has multiple pages with "Export PDF" buttons (at minimum: Seasonality, Map, and at least one other page)
Recharts is used for charts — NOTE: Recharts renders to SVG/Canvas in the DOM, which React PDF cannot directly capture
For chart capture: use html2canvas or dom-to-image to rasterize the chart to a base64 PNG, then embed it in the PDF
Leaflet maps also render to Canvas/DOM — same approach: rasterize to PNG before embedding
The Map page export button appears to have no handler attached at all (dead button)
Full Task List
4.1 — Audit All Export PDF Buttons
Search src/ for all occurrences of:
"Export PDF", "export pdf", exportPdf, handleExport, downloadPDF
@react-pdf/renderer imports
PDFDownloadLink, pdf(), BlobProvider
For each button found: note the page, the handler function name, and what data it currently passes to the PDF
For the Seasonality page: identify exactly what data is NOT being included (the chart image, the table, or both)
For the Map page: confirm the button has no onClick handler or the handler is a no-op
4.2 — Fix: Map Page Export Button
The Map page uses Leaflet (renders to a <div> with canvas layers)
Step 1: Install html2canvas if not present: add to package.json and run bun add html2canvas
Step 2: Create a function captureMapAsImage():
typescript
  import html2canvas from "html2canvas";

  async function captureMapAsImage(): Promise<string> {
    const mapContainer = document.getElementById("map-container"); // adjust selector
    if (!mapContainer) throw new Error("Map container not found");
    const canvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      scale: 2, // 2x resolution for crisp PDF output
    });
    return canvas.toDataURL("image/png");
  }
Step 3: Create a MapPDFDocument React PDF component that:
Has a proper title: "HEALTHWATCH — Philippine Outbreak Hotspot Map"
Includes the generation date
Embeds the captured map image at full page width
Includes a legend section (Low / Moderate / High risk with color swatches)
Includes the data table of all 18 regions with their risk classification and case counts
Step 4: Attach the handler to the export button:
typescript
  async function handleMapExport() {
    const mapImage = await captureMapAsImage();
    const doc = <MapPDFDocument mapImage={mapImage} regions={regionData} />;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthwatch-map-${new Date().toISOString().split("T")[0]}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
4.3 — Fix: Seasonality Page Export — Include Chart Image
The Seasonality page has a chart (Recharts) and possibly a data table below it
The current export is missing the chart — it likely only exports text/table data
Step 1: Assign a ref or id to the chart container: <div id="seasonality-chart-container">
Step 2: Create a function captureChartAsImage(elementId: string):
typescript
  async function captureChartAsImage(elementId: string): Promise<string> {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`Element #${elementId} not found`);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    return canvas.toDataURL("image/png");
  }
Step 3: Update the Seasonality PDF document component to accept and embed the chart image:
Add an <Image> component from @react-pdf/renderer with the captured chart base64 PNG
Place the chart image AFTER the title/header section, BEFORE the data table
Step 4: Update the export handler to capture the chart before generating the PDF:
typescript
  async function handleSeasonalityExport() {
    const chartImage = await captureChartAsImage("seasonality-chart-container");
    const doc = <SeasonalityPDFDocument chartImage={chartImage} data={seasonalityData} />;
    // ... rest of download logic
  }
Also include the currently selected region in the PDF title (e.g., "Region III — Central Luzon")
4.4 — PDF Layout Enhancement — Apply to ALL Export Pages

Apply these formatting improvements to every PDF document component in the system:

Page Layout:

Page size: A4, orientation: portrait
Margins: 40pt top/bottom, 48pt left/right
Add a consistent header to every page (using <View fixed> in React PDF):
Left: HEALTHWATCH logo text or wordmark in bold
Right: Page number (<Text render={({ pageNumber, totalPages }) => \${pageNumber} / ${totalPages}`} fixed />`)

Typography:

Title: font size 18pt, bold, color 
#1e293b (slate-800)
Subtitle/section heading: 13pt, semi-bold, color 
#334155 (slate-700)
Body text: 10pt, color 
#475569 (slate-600)
Table cell text: 9pt
Captions: 8pt, italic, color 
#64748b (slate-500)
Use the same font family throughout — Helvetica (built-in to React PDF, no font loading needed)

Header Section (for every PDF):

HEALTHWATCH
Philippine Regional Disease Surveillance System
─────────────────────────────────────────────
[Page Title]                    Generated: [Date]
Region: [Selected Region]

Chart Section:

Chart image: full width, maintain aspect ratio, add a 2pt border 
#e2e8f0, border-radius not supported in React PDF — use flat border
Caption below chart: "Figure 1. [Chart description] — Source: DOH Philippines"

Data Table:

Header row background: 
#0f172a (slate-900), text white, 9pt bold
Alternating row colors: white and 
#f8fafc (slate-50)
Cell padding: 8pt horizontal, 6pt vertical
Add a thin bottom border 
#e2e8f0 on each row
Column widths: proportional, not equal — wider columns for region names, narrower for numeric values
Align numeric columns right

Footer Section (fixed, on every page):

"Data sourced from the Department of Health (DOH), Philippines."
"This report is generated by HEALTHWATCH and is for surveillance purposes only."
Font size: 7pt, color 
#94a3b8 (slate-400)
Thin top border line
4.5 — Add Export Loading State
All export buttons must show a loading state while capturing DOM and generating PDF:
typescript
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      // ... capture and generate
    } finally {
      setIsExporting(false);
    }
  }
Button text: "Export PDF" (idle) → "Generating…" (loading) → back to "Export PDF"
Disable the button during export to prevent double-clicks
4.6 — Pages to Update
Seasonality page (BROKEN — fix chart capture + enhance layout)
Map page (BROKEN — implement from scratch + enhance layout)
Any other page that already has a working export (enhance layout only — do NOT break what works)
4.7 — Do NOT Touch
Any data fetching logic
Any non-PDF UI components
The Recharts chart rendering itself
The Leaflet map rendering itself
Any route or API code

Do NOT change any feature behavior — only what is explicitly stated in each plan
Do NOT upgrade or downgrade any package versions unless required by the plan
Do NOT rename any existing API routes, query keys, or data shapes
Do NOT touch the render.yaml (Render Blueprint IaC) unless adding an env var reference
When in doubt about scope: do less, not more — then ask
All new files must follow the existing project's file naming convention (kebab-case or PascalCase as observed in the project)
All TypeScript must be strictly typed — no any unless the existing codebase already uses it in that file