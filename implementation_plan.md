---
## PLAN 6 — INFORMATION TAB: MOBILE PULL-UP ANIMATION + FULL SCREEN COVERAGE

### Standing Directive
You are working on HealthWatch — a Philippine regional dengue forecasting system. Frontend is React 19 + Tailwind CSS 4 + TanStack Router. This plan covers mobile UX only. Do not change desktop layout. Do not touch data fetching, forecasting logic, or routing. Only fix the Information tab bottom sheet behavior on mobile. Read the component fully before touching any CSS or animation code.

### System Context
HealthWatch has an Information tab that appears as a bottom sheet / pull-up drawer on mobile. Currently:
1. When the user starts pulling it up, the content inside is not visible during the animation — the tab appears blank/empty while dragging, and content only appears after the animation completes or after a delay.
2. When fully pulled up, the bottom sheet only covers roughly half the screen instead of the full viewport height.

### Item 7 — Fix Information Tab Mobile Pull-Up Animation and Full Screen Coverage

**Step 1 — Locate the component.**
Find the Information tab / bottom sheet component. It is likely one of:
- A dedicated component like `src/components/InfoSheet.tsx`, `src/components/BottomSheet.tsx`, or `src/components/InfoTab.tsx`.
- A section of the Map page (`src/pages/index.tsx` or `src/pages/map.tsx`) since the Info tab overlays the map on mobile.
Read the full component including any CSS transitions or animation logic.

**Step 2 — Fix content visibility during drag/animation.**
Root cause: content is being conditionally rendered AFTER the animation completes (e.g. using a state flag `isOpen` that triggers mount, or using `display: none` during transition).
Fix:
- **Always keep the content mounted** — do not conditionally render the inner content based on sheet open state.
- Use `visibility: visible` and `opacity: 1` on the content at all times.
- The sheet's height/transform animates; the content inside does not change visibility.
- If using `AnimatePresence` from Framer Motion or a CSS `transition` on `transform: translateY(...)`, ensure the content children are rendered immediately and only the container transform animates.
In Tailwind + CSS approach (no Framer Motion):
```typescript
// Sheet container — always rendered
<div
  className={`
    fixed bottom-0 left-0 right-0 z-40
    bg-background rounded-t-2xl shadow-2xl
    transition-transform duration-300 ease-out
    ${isOpen ? "translate-y-0" : "translate-y-[calc(100%-3rem)]"}
  `}
  style={{ maxHeight: "100dvh" }} // dynamic viewport height
>
  {/* Handle bar */}
  <div className="flex justify-center pt-3 pb-2 cursor-grab" onPointerDown={handleDragStart}>
    <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
  </div>
  {/* Content — ALWAYS mounted, never conditionally rendered */}
  <div className="overflow-y-auto" style={{ height: "calc(100dvh - 3rem)" }}>
    {children}
  </div>
</div>
```

**Step 3 — Fix full screen coverage.**
Root cause: the sheet's max height is set to `50vh`, `50%`, or a fixed pixel value that caps it at half the screen.
Fix:
- Set the sheet container height when fully open to `100dvh` (dynamic viewport height — accounts for mobile browser chrome).
- Use CSS custom property or inline style: `style={{ height: isOpen ? "100dvh" : "3rem" }}` or use the `translate-y` approach above where the container is always full height and only its transform changes.
- When fully open (`isOpen: true` or drag position at top), the sheet must cover the entire screen from top to bottom. The handle bar stays at top inside the sheet. The content scrolls below it.
- Use `100dvh` (not `100vh`) because on iOS Safari `100vh` doesn't account for the browser address bar.

**Step 4 — Implement or improve drag gesture.**
If the current drag implementation is using raw pointer events and is janky, improve it:
```typescript
const [dragOffset, setDragOffset] = useState(0);
const [startY, setStartY] = useState(0);

const handlePointerDown = (e: React.PointerEvent) => {
  setStartY(e.clientY);
  e.currentTarget.setPointerCapture(e.pointerId);
};

const handlePointerMove = (e: React.PointerEvent) => {
  const delta = e.clientY - startY;
  if (delta > 0) setDragOffset(delta); // only allow dragging down
};

const handlePointerUp = () => {
  if (dragOffset > 80) {
    setIsOpen(false); // threshold: 80px drag down closes sheet
  }
  setDragOffset(0);
};
```
Apply `transform: translateY(${dragOffset}px)` as an inline style during drag, then remove it and rely on the CSS transition class on pointer up.

**Step 5 — Navigation from Information tab.**
When the Information tab has a button/link that says "Open Regional Analysis" or similar (which previously linked to Full Regional Analysis), update it to navigate to the merged Seasonality page (from Plan 5/Item 6):
```typescript
import { useNavigate } from "@tanstack/react-router";
const navigate = useNavigate();
// In the button onClick:
navigate({ to: "/seasonality", search: { region: selectedRegion ?? "NCR" } });
```
After navigation, the bottom sheet should close (`setIsOpen(false)`).

**Step 6 — Desktop guard.**
All changes in this plan are mobile-only. Wrap the bottom sheet component in a responsive check:
- On desktop (≥ 768px), the Information tab should NOT be a pull-up drawer — it should be a sidebar panel or inline section as it currently is on desktop.
- Use `useWindowSize` or a Tailwind `md:hidden` class on the bottom sheet and `hidden md:block` on the desktop equivalent.
- Do not merge the mobile and desktop implementations into one component if it risks breaking the desktop layout.