---
name: HEALTHWATCH
description: Regional Outbreak Hotspot Map & Forecasts â€” DOH Â· LGU dengue risk decision support in the Philippines
colors:
  primary: "oklch(0.64 0.19 35)"
  secondary: "oklch(0.96 0.019 256)"
  accent: "oklch(0.91 0.111 90)"
  background: "oklch(0.98 0.007 81)"
  foreground: "oklch(0.24 0.008 85)"
  card: "oklch(1 0 0)"
  panel: "oklch(1 0 0 / 88%)"
  muted: "oklch(0.94 0.013 82)"
  muted-foreground: "oklch(0.46 0.019 79)"
  destructive: "oklch(0.59 0.188 32)"
  risk-low: "oklch(0.62 0.129 162)"
  risk-moderate: "oklch(0.71 0.152 80)"
  risk-high: "oklch(0.59 0.188 32)"
  risk-low-solid: "oklch(0.508 0.118 165)"
  risk-moderate-solid: "oklch(0.555 0.116 66)"
  risk-high-solid: "oklch(0.517 0.176 27)"
  wet: "oklch(0.64 0.117 234)"
  dry: "oklch(0.68 0.129 72)"
  chart-1: "oklch(0.64 0.19 35)"
  chart-2: "oklch(0.64 0.117 234)"
  chart-3: "oklch(0.62 0.129 162)"
  chart-4: "oklch(0.71 0.152 80)"
  chart-5: "oklch(0.56 0.129 307)"
typography:
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.14em"
    textTransform: "uppercase"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
    typography: "{typography.body}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 16px"
  chip-risk-low:
    backgroundColor: "{colors.risk-low-solid}"
    textColor: "oklch(0.99 0.003 95)"
    rounded: "{rounded.pill}"
  chip-risk-moderate:
    backgroundColor: "{colors.risk-moderate-solid}"
    textColor: "oklch(0.99 0.003 95)"
    rounded: "{rounded.pill}"
  chip-risk-high:
    backgroundColor: "{colors.risk-high-solid}"
    textColor: "oklch(0.99 0.003 95)"
    rounded: "{rounded.pill}"
  panel-card:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
---

# Design System: HEALTHWATCH

## Overview

**Creative North Star: "The Public-Health Wire Room"**

HEALTHWATCH is a calm command center for Philippine dengue surveillance: one glanceable
map of eighteen regions, colored by risk tier, with decision glass floating above the data.
It is a room where epidemics are watched â€” not a marketing page, not a toy. The aesthetic is
**calm, precise, and quietly official**: warm daylight surfaces, near-ink text, and one coral
signal accent used sparingly. Everything else earns its place by being instrument, not ornament.

The interface leans on the metaphor of an operations console. Depth comes from translucent
glass panels hovering over the basemap â€” the map is the floor, the panels are flotation above
it. Typography is utilitarian: Sora carries the reading with a contemporary geometric
presence, while
JetBrains Mono uppercase
labels (the `label-caps` utility) read as instrument markings: `SEASON`, `RISK TIER`,
`DATA THROUGH`. This is a workbench for epidemiologists and LGU health officers deciding where
to position outbreak response â€” the visual system must always feel defensible in a budget
office and legible across a meeting room.

Warm cream is the light mode's default daylight; the dark theme inverts the same vocabulary
into a deep operations-console navy with an aqua signal. Chroma is earned: risk tiers
(green/amber/red) own the saturated color, the coral accent owns the interaction color, and
the season tokens (wet blue / dry amber) own climatological semantics â€” nothing else is loud.

**Key Characteristics:**
- Warm cream "paper" background, near-ink (never pure black or white) text.
- One coral/signal accent for interaction; risk ramp green â†’ amber â†’ red for data alone.
- Floating glass panels with backdrop blur and hairline borders over the map.
- Mono uppercase "instrument label" treatment (`label-caps`) for metadata and section heads.
- Rounded-but-restrained radii (~10px base); pill shapes only for status chips and dots.
- Both light (daylight cream) and dark (operations navy) themes from the same tokens.

## Colors

A warm, low-chroma daylight palette with three dedicated semantic groups â€” risk, season,
chart â€” so that everyday UI stays quiet and meaning stays scannable.

### Primary
- **Signal Coral** (`oklch(0.64 0.19 35)`): the single interaction accent. Buttons, focus
  rings, active links, selected map borders, Leaflet attribution links. Rare by design.
  In dark mode it becomes an **Aqua Signal** (`oklch(0.78 0.14 196)`) against navy.

### Secondary
- **Sky Wash** (`oklch(0.96 0.019 256)`): pale cool blue fill for secondary buttons and
  secondary-container fills; paired with **Deep Sky Ink** (`oklch(0.34 0.063 249)`).

### Tertiary
- **Sun Wash** (`oklch(0.91 0.111 90)`): pale warm-yellow hover/focus fill on ghost and
  outline controls; sparing.

### Neutral
- **Cream Paper** (`oklch(0.98 0.007 81)`): page background. Warm, never white.
- **Near-Ink** (`oklch(0.24 0.008 85)`): primary text and glazed stroke base; never pure black.
- **White Surface** (`oklch(1 0 0)`): cards, popovers, sheets above the cream page.
- **Panelled Glass** (`oklch(1 0 0 / 88%)`): translucent panel fill over the map.
- **Muted Wash** (`oklch(0.94 0.013 82)`): secondary surfaces and map background.
- **Faded Ink** (`oklch(0.46 0.019 79)`): secondary text; the caption voice.
- **Hairline Border** (`oklch(0.24 0.008 85 / 10%)`): strokes and dividers.

### Named Rules
**The Risk Reservation Rule.** Green, amber, and red (`--risk-*`) are reserved exclusively
for risk data â€” map fills, risk badges, risk legend. They are never used for chrome or
decoration; UI feedback uses coral/ring tokens instead.
**The One Stamp Rule.** Signal Coral is used on a minority of any screen. Only one
interactive item is "stamped" coral at a time â€” its rarity is what makes it a signal.
**The Never Pure Rule.** Text and chrome never use pure black or white. Cream paper/near-ink
light, navy/aqua dark. Pure white appears only as *glass*, never as painted light.

## Typography

**Display/Body Font:** Hanken Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, monospace`)

**Character:** A precise, neutral neo-grotesque doing all the reading, paired with a technical
monospace reserved for instrument markings. Hanken Grotesk' even, open counters give the dashboard
the clarity of an Apple system surface â€” the pairing says "public-health professional",
not "startup brochure". All headings share a tight `-0.01em` tracking at weight 600.

### Hierarchy
- **Display** (600, 1.5rem/24px `--text-2xl`): page titles. Headline numbers reach
  `--text-3xl` (1.875rem/30px).
- **Title** (600, 1.25rem/20px `--text-xl`): card titles and section labels.
- **Body** (400, 1rem/16px `--text-base`): default reading; comfortable line measure kept
  inside floating panels.
- **Label / Instrument** (`label-caps`: mono, 0.6875rem/11px, 500, `0.14em` tracking,
  uppercase, muted): the signature. Every meta line â€” `SEASON`, `RISK TIER`, `DATA THROUGH`,
  `LAUNCH / 14` â€” is set this way. Tooltips on the map use the same mono caps at 10px.

### Named Rules
**The Instrument Label Rule.** Uppercase mono is the metadata voice, not a title voice.
`label-caps` labels, numbers, and footnotes; it never headlines content. The incumbent
system also carries sans-uppercase `10px` meta labels (`text-[10px] tracking-wider`);
those migrate to `label-caps` during cleanup â€” one label voice across the app, with pill
chips as the exception for risk and season data.

## Layout

The application is a map-first console. The CARTO basemap is the floor and fills the
viewport; decision surfaces float above it as a top toolbar (search + actions), a left
national snapshot and active-alerts dock, and a bottom timeline scrubber. Panels dock to
fixed positions rather than scrolling a page â€” the map stays the constant.

Density is high but airy: `glass-panel` surfaces use comfortable 16px (`spacing.md`)
padding scales, 8px gaps for tight clusters (toolbar icon rows), and 24px for section
rhythm. Radius derives from one base token (`--radius: 0.625rem` â†’ 10px) so corners scale
together: `sm` 6px, `md` 8px, `lg` 10px, `xl` 14px.

Responsive: below `md`, controls collapse into a mobile bottom sheet and the dock becomes a
roll-up drawer; the map remains full-bleed with glass overlays in both tiers. No layout
depends on horizontal scroll.

## Elevation & Depth

**Floating glass, not stacked paper.** Surfaces hover over the basemap as translucent
panels; the map is always the rearmost plane. Light mode depth is a whisper (hairline border
+ soft ambient drop), dark mode depth is a deeper void behind the glass.

`glass-panel` (light):
```
background: oklch(1 0 0 / 88%);
backdrop-filter: blur(10px) saturate(120%);
border: 1px solid oklch(0.24 0.008 85 / 10%);
box-shadow:
  0 1px 2px oklch(0.24 0.008 85 / 6%),
  0 8px 24px -12px oklch(0.24 0.008 85 / 12%);
```
`glass-panel` (dark, `.dark .glass-panel`):
```
backdrop-filter: blur(12px) saturate(140%);
box-shadow:
  0 18px 50px -20px oklch(0 0 0 / 70%),
  inset 0 1px 0 oklch(1 0 0 / 6%);
```

### Named Rules
**The Glass Floor Rule.** Nothing lifts off the page unless it is a real surface the user
acts on. Content inside a panel never casts its own shadow; depth belongs to panels, and
panels belong above the map.

## Shapes

A restrained, gently curved geometry built from one 10px (`--radius: 0.625rem`) base token.
Panels and cards land at `xl` (14px); controls (buttons, inputs, selects) at `md` (8px);
map tooltips at `sm` (6px). Status pills are the one fully rounded shape (`pill`/9999px),
used only for risk badges, season tags, and tiny dot glyphs â€” never containers.

Edges stay crisp: borders are hairline (`10%` glazed ink) both on and off panels, and the
map's own edge is treated as floor, not a framed photograph.

## Components

### Buttons
- **Shape:** gently curved (`md`/8px), 36px height at default (`h-9`), full-height icon
  variants; `transition-colors`.
- **Primary â€” Signal Coral:** coral fill (`var(--color-primary)`), white text, soft `shadow`;
  hover dims to `primary/90`. The one coral stamp on a screen.
- **Hover / Focus:** hover shifts only fill tone (calm), focus is a `1px` `--ring` outline
  (`oklch(0.64 0.19 35 / 55%)`); disabled at `opacity-50` with `cursor-not-allowed`.
- **Secondary â€” Sky Wash:** pale sky fill + deep-sky ink; hover `secondary/80`.
- **Outline:** cream background, glazed-input border, hover drops Sun Wash fill + ink text.
- **Ghost:** transparent, Sun Wash hover fill â€” the toolbar's quiet workhorse.
- **Link:** coral text, underline on hover only.

### Chips / Badges
- **Risk Badge:** fully-rounded pill with the *solid* risk token as fill (`risk-low-solid`,
  `risk-moderate-solid`, `risk-high-solid`), near-white uppercase text (`oklch(0.99 0.003 95)`),
  and an 6px white/80 leading dot â€” e.g. `â— HIGH RISK`. The map keeps the *brighter* risk
  tokens; badges use the solid, white-text-safe variants (WCAG AA â‰¥ 4.5:1).
- **Season Tag:** 10px uppercase tag, tinted via `color-mix` (12% wet-blue or dry-amber over
  transparent) with the season color as text â€” readable chips, not filled blocks.
- **Risk Dot:** 8px bare circle in the bright risk token for inline mention.

### Cards / Panels
- **Corner Style:** `xl` (14px).
- **Background:** `glass-panel` â€” 88% translucent surface, `blur(10px) saturate(120%)`,
  hairline `--panel-border`.
- **Shadow Strategy:** ambient-only (see Elevation); never clipped shadows.
- **Border:** 1px hairline glazed ink.
- **Internal Padding:** 16px rhythm, 24px for sectioned content.

### Inputs / Fields
- **Style:** transparent or cream fill, hairline `--input` border (`14%` glazed ink),
  `md` radius, mono `label` for field captions.
- **Focus:** `1px --ring` coral outline; calm, not glowing.
- **Error / Disabled:** destructive text for error messages; `opacity-50` for disabled.

### Navigation / Toolbar
- **Style:** floating `glass-panel` strip with grouped icon controls on the right (theme,
  share, PDF/PNG export, settings) and a search field with an autocomplete dropdown of
  regions on the left.
- **Typographic voice:** instrument labels in `label-caps`, not nav-branding type.
- **Mobile:** search collapses behind an icon; further actions fold into an OS-style menu.

### The Map (Signature Component)
The Leaflet choropleth *is* the product. Eighteen PSGC regions are filled with the bright
risk tokens (`fillOpacity 0.55`, 0.78 when selected), stroked near-ink hairline (selected:
`2px` 85% ink / dark: white 35%â†’90%), and hovered regions lift to `fillOpacity 0.85` with a
`1.6px` stroke. CARTO Voyager (light) / Dark Matter (dark) basemaps are calmed with
`saturate(0.9) brightness(1.02)`; tooltips are mono-caps glass (`hw-tooltip`). Outbreak
markers are neutral ring glyphs â€” white ring, semi-transparent risk-tinted center â€” off by
default.

### Timeline Scrubber
A compact bottom glass transport rail scrubbing 68 months (56 observed + 12 forecast)
with play/step controls and a forecast-horizon divider; the expanded state adds horizon
captions and a jump-to-latest affordance. The active month wears a `SeasonTag`. The wet/dry
tokens (`--wet`, `--dry`) mark season inside forecast previews and climate charts, not on
the timeline itself.

## Do's and Don'ts

### Do:
- **Do** keep the map the constant: floats over it, never covers it fully.
- **Do** use `label-caps` for every metadata line â€” season, risk tier, data-through, units.
- **Do** use the solid risk tokens for badges carrying white text; the bright tokens for the
  map and legend.
- **Do** let near-white panels read as glass: translucent fill + blur + hairline border.
- **Do** reserve coral for the single interactive item that should win attention.

### Don't:
- **Don't** use green/amber/red outside risk semantics; they are data colors, not brand colors.
- **Don't** introduce pure-black text or pure-white chrome â€” the warm ink/cream pair is the voice.
- **Don't** dress content in shadows; only panels float.
- **Don't** invent a second accent while Signal Coral is live â€” one stamp at a time.
- **Don't** set a meta label in body sans; instrument language is mono caps or it's decoration.
- **Don't** frame the map like a photo â€” the basemap is the floor of the room.