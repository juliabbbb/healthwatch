---
name: HEALTHWATCH
description: Regional Outbreak Hotspot Map & Forecasts — DOH · LGU dengue risk decision support in the Philippines
colors:
  primary: "oklch(0.63 0.19 45)"
  secondary: "oklch(0.96 0.005 260)"
  accent: "oklch(0.95 0.015 55)"
  background: "oklch(0.99 0.002 260)"
  foreground: "oklch(0.15 0.005 260)"
  card: "oklch(1 0 0)"
  panel: "oklch(1 0 0 / 92%)"
  muted: "oklch(0.96 0.004 260)"
  muted-foreground: "oklch(0.50 0.01 260)"
  destructive: "oklch(0.55 0.20 25)"
  risk-low: "oklch(0.62 0.09 145)"
  risk-moderate: "oklch(0.70 0.105 75)"
  risk-high: "oklch(0.58 0.135 32)"
  risk-low-solid: "oklch(0.478 0.08 145)"
  risk-moderate-solid: "oklch(0.525 0.09 70)"
  risk-high-solid: "oklch(0.49 0.12 30)"
  wet: "oklch(0.58 0.12 240)"
  dry: "oklch(0.62 0.12 75)"
  chart-1: "oklch(0.55 0.17 260)"
  chart-2: "oklch(0.58 0.12 240)"
  chart-3: "oklch(0.62 0.09 145)"
  chart-4: "oklch(0.70 0.105 75)"
  chart-5: "oklch(0.52 0.13 307)"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 450
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.14em"
    textTransform: "uppercase"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
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

**Creative North Star: "The Notion-Polished Operations Console"**

HEALTHWATCH is a calm command center for Philippine dengue surveillance: one glanceable
map of eighteen regions, colored by risk tier, with decision glass floating above the data.
It is a room where epidemics are watched — not a marketing page, not a toy. The aesthetic is
**clean, precise, and quietly official**: cool-white surfaces, near-ink text, and one blue
signal accent used sparingly. Everything else earns its place by being instrument, not ornament.

The interface leans on the metaphor of an operations console refined through Notion and Apple
design language. Depth comes from translucent glass panels hovering over the basemap — the map
is the floor, the panels are flotation above it. Typography is utilitarian: Schibsted Grotesk
carries the reading with a humanist-grotesque precision — digital-first, engineered for
screens, with the warmth of its Schibsted media heritage without decorative weight. JetBrains
Mono uppercase labels (the `label-caps` utility) read as instrument markings: `SEASON`,
`RISK TIER`, `DATA THROUGH`. This is a workbench for epidemiologists and LGU health officers
deciding where to position outbreak response — the visual system must always feel defensible
in a budget office and legible across a meeting room.

Cool white is the light mode's default surface; the dark theme inverts the same vocabulary
into a deep operations-console navy with an aqua signal. Chroma is earned: risk tiers
(sage/amber/brick) own a deliberately **muted, warm-toned ramp** — desaturated so the map
stays calm — the coral accent (light) / blue accent (dark) owns the interaction color, and
the season tokens (wet blue / dry amber) own climatological semantics — nothing else is loud.

**Key Characteristics:**
- Cool white clean background, near-ink (never pure black or white) text.
- Coral accent (light) / blue accent (dark) for interaction; risk ramp green → amber → red for data alone.
- Floating glass panels with refined blur and hairline borders over the map.
- Mono uppercase "instrument label" treatment (`label-caps`) for metadata and section heads.
- Restrained, refined radii (8px base); pill shapes only for status chips and dots.
- Both light (clean white) and dark (operations navy) themes from the same tokens.

## Colors

A cool, low-chroma surface palette with three dedicated semantic groups — risk, season,
chart — so that everyday UI stays quiet and meaning stays scannable.

### Primary
- **Signal Coral** (`oklch(0.63 0.19 45)`): the single interaction accent in light mode. Buttons,
  focus rings, active links, selected map borders, Leaflet attribution links. Rare by design.
  In dark mode the accent shifts to **Lighter Blue** (`oklch(0.72 0.15 250)`) against navy —
  the cool console aesthetic demands it there.

### Secondary
- **Cool Wash** (`oklch(0.96 0.005 260)`): pale cool gray fill for secondary buttons and
  secondary-container fills; paired with **Dark Ink** (`oklch(0.30 0.01 260)`).

### Tertiary
- **Accent Wash** (`oklch(0.94 0.008 260)`): subtle cool highlight on hover/focus fill on
  ghost and outline controls; sparing.

### Neutral
- **Clean White** (`oklch(0.99 0.002 260)`): page background. Cool, never warm cream.
- **Near-Ink** (`oklch(0.15 0.005 260)`): primary text and glazed stroke base; never pure black.
- **White Surface** (`oklch(1 0 0)`): cards, popovers, sheets above the page.
- **Panelled Glass** (`oklch(1 0 0 / 92%)`): translucent panel fill over the map.
- **Muted Wash** (`oklch(0.96 0.004 260)`): secondary surfaces and map background.
- **Faded Ink** (`oklch(0.50 0.01 260)`): secondary text; the caption voice.
- **Hairline Border** (`oklch(0.18 0.005 260 / 10%)`): strokes and dividers.

### Risk Ramp
The map and status colors are a **muted warm ramp** — sage (`oklch(0.62 0.09 145)`) →
muted amber (`oklch(0.70 0.105 75)`) → muted brick (`oklch(0.58 0.135 32)`). Three moves keep
the semantics intact:
- **Desaturated:** chroma drops (0.13→0.09, 0.15→0.105, 0.19→0.135) so eighteen filled
  regions read as a calm field instead of a signal flare; the tier separation still holds.
- **Warm-toned:** the ramp tilts warm (green 162→145, amber and red hold their warm hue) so
  the data voice belongs to the coral/cream world rather than a cool app-palette clone.
- **WCAG held:** the `*-solid` variants stay dark enough for the white-text badges
  (`oklch(0.478/0.525/0.49 …)` → contrast ≥ 14:1) and the base tokens still pass AA as
  risk-colored text on white (≥ 6.5:1).

### Named Rules
**The Risk Reservation Rule.** Green, amber, and red (`--risk-*`) are reserved exclusively
for risk data — map fills, risk badges, risk legend. They are never used for chrome or
decoration; UI feedback uses blue/ring tokens instead.
**The One Stamp Rule.** Signal Coral (light) / Signal Blue (dark) is used on a minority of any
screen. Only one interactive item is "stamped" accent at a time — its rarity is what makes it
a signal.
**The Never Pure Rule.** Text and chrome never use pure black or white. Clean white/near-ink
light, navy/aqua dark. Pure white appears only as *glass*, never as painted light.

## Typography

**Display/Body Font:** Schibsted Grotesk (with `ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, monospace`)

**Character:** A digital-first humanist grotesque doing all the reading, paired with a
technical monospace reserved for instrument markings. Schibsted Grotesk was designed for
user interfaces — its clean geometry carries institutional presence without coldness, with
the subtle warmth of its Schibsted media heritage. The pairing says "public-health
professional", not "startup brochure". All headings share tight `-0.015em` tracking at
weight 600.

### Hierarchy
- **Display** (600, 1.5rem/24px `--text-2xl`): page titles. Headline numbers reach
  `--text-3xl` (1.875rem/30px).
- **Title** (600, 1.25rem/20px `--text-xl`): card titles and section labels.
- **Body** (450, 1rem/16px `--text-base`): default reading; comfortable line measure kept
  inside floating panels.
- **Label / Instrument** (`label-caps`: mono, 0.6875rem/11px, 500, `0.14em` tracking,
  uppercase, muted): the signature. Every meta line — `SEASON`, `RISK TIER`, `DATA THROUGH`,
  `LAUNCH / 14` — is set this way. Tooltips on the map use the same mono caps at 10px.

### Named Rules
**The Instrument Label Rule.** Uppercase mono is the metadata voice, not a title voice.
`label-caps` labels, numbers, and footnotes; it never headlines content.

## Layout

The application is a map-first console. The CARTO basemap is the floor and fills the
viewport; decision surfaces float above it as a top toolbar (search + actions), a left
national snapshot and active-alerts dock, and a bottom timeline scrubber. Panels dock to
fixed positions rather than scrolling a page — the map stays the constant.

Density is high but airy: `glass-panel` surfaces use comfortable 16px (`spacing.md`)
padding scales, 8px gaps for tight clusters (toolbar icon rows), and 24px for section
rhythm. Radius derives from one base token (`--radius: 0.5rem` → 8px) so corners scale
together: `sm` 4px, `md` 6px, `lg` 8px, `xl` 12px.

Responsive: below `md`, controls collapse into a mobile bottom sheet and the dock becomes a
roll-up drawer; the map remains full-bleed with glass overlays in both tiers. No layout
depends on horizontal scroll.

## Elevation & Depth

**Floating glass, not stacked paper.** Surfaces hover over the basemap as translucent
panels; the map is always the rearmost plane. Light mode depth is a whisper (hairline border
+ soft ambient drop), dark mode depth is a deeper void behind the glass.

`glass-panel` (light):
```
background: oklch(1 0 0 / 92%);
backdrop-filter: blur(12px) saturate(125%);
border: 1px solid oklch(0.18 0.005 260 / 8%);
box-shadow:
  0 1px 3px oklch(0.15 0.005 260 / 5%),
  0 6px 20px -10px oklch(0.15 0.005 260 / 10%);
```
`glass-panel` (dark, `.dark .glass-panel`):
```
backdrop-filter: blur(16px) saturate(130%);
box-shadow:
  0 16px 48px -16px oklch(0 0 0 / 65%),
  inset 0 1px 0 oklch(1 0 0 / 5%);
```

### Named Rules
**The Glass Floor Rule.** Nothing lifts off the page unless it is a real surface the user
acts on. Content inside a panel never casts its own shadow; depth belongs to panels, and
panels belong above the map.

## Shapes

A refined, restrained geometry built from one 8px (`--radius: 0.5rem`) base token.
Panels and cards land at `xl` (12px); controls (buttons, inputs, selects) at `md` (6px);
map tooltips at `sm` (4px). Status pills are the one fully rounded shape (`pill`/9999px),
used only for risk badges, season tags, and tiny dot glyphs — never containers.

Edges stay crisp: borders are hairline (`10%` glazed ink) both on and off panels, and the
map's own edge is treated as floor, not a framed photograph.

## Icons

The icon system is Lucide, drawn in one **uniform stroke weight** — `1.75` applied once to
every `svg.lucide` (below the stock `2`) so controls read as a family rather than a
collection. Weight is set at the system level, never per instance.

**Size rhythm** — one class per role, no drifting sizes:
- `size-4` (16px) — controls: toolbar actions, buttons, modal/sheet close, search.
- `size-3.5` (14px) — inline with text: links, chip labels, list rows, AI actions.
- `size-3` (12px) — compact rows: dense-table chevrons and micro affordances.
- `size-5` (20px) — status/brand glyphs: the HEALTHWATCH mark, panel lead icons.

**Color rules:** icons inherit `currentColor`. Neutral controls sit in
`muted-foreground`, hover/pressed in `foreground`, and the single interactive accent uses
`text-primary` — precisely one coral stamp at a time. Icon color never comes from a raw
hex or a non-risk green/amber/red; a "copied" confirm uses the primary token, not emerald.
Large glyphs and custom SVG marks (outbreak rings, chart dots) follow their own documented
geometry but respect the risk tokens when they carry risk meaning.

## Components

### Buttons
- **Shape:** refined curves (`md`/6px), 36px height at default (`h-9`), full-height icon
  variants; `transition-colors`.
- **Primary — Signal Blue:** blue fill (`var(--color-primary)`), white text, soft `shadow`;
  hover dims to `primary/90`. The one blue stamp on a screen.
- **Hover / Focus:** hover shifts only fill tone (calm), focus is a `1px` `--ring` outline
  (`oklch(0.55 0.17 260 / 40%)`); disabled at `opacity-50` with `cursor-not-allowed`.
- **Secondary — Cool Wash:** pale gray fill + dark ink; hover `secondary/80`.
- **Outline:** white background, glazed-input border, hover drops Accent Wash fill + ink text.
- **Ghost:** transparent, Accent Wash hover fill — the toolbar's quiet workhorse.
- **Link:** blue text, underline on hover only.

### Chips / Badges
- **Risk Badge:** fully-rounded pill with the *solid* risk token as fill (`risk-low-solid`,
  `risk-moderate-solid`, `risk-high-solid`), near-white uppercase text (`oklch(0.99 0.003 95)`),
  and a 6px white/80 leading dot — e.g. `● HIGH RISK`. The map keeps the *base* risk
  tokens; badges use the solid, white-text-safe variants (WCAG AA ≥ 4.5:1).
- **Season Tag:** 10px uppercase tag, tinted via `color-mix` (12% wet-blue or dry-amber over
  transparent) with the season color as text — readable chips, not filled blocks.
- **Risk Dot:** 8px bare circle in the bright risk token for inline mention.

### Cards / Panels
- **Corner Style:** `xl` (12px).
- **Background:** `glass-panel` — 92% translucent surface, `blur(12px) saturate(125%)`,
  hairline `--panel-border`.
- **Shadow Strategy:** ambient-only (see Elevation); never clipped shadows.
- **Border:** 1px hairline glazed ink.
- **Internal Padding:** 16px rhythm, 24px for sectioned content.

### Inputs / Fields
- **Style:** transparent or white fill, hairline `--input` border (`14%` glazed ink),
  `md` radius, mono `label` for field captions.
- **Focus:** `1px --ring` blue outline; calm, not glowing.
- **Error / Disabled:** destructive text for error messages; `opacity-50` for disabled.

### Navigation / Toolbar
- **Style:** floating `glass-panel` strip with grouped icon controls on the right (theme,
  share, PDF/PNG export, settings) and a search field with an autocomplete dropdown of
  regions on the left.
- **Typographic voice:** instrument labels in `label-caps`, not nav-branding type.
- **Mobile:** search collapses behind an icon; further actions fold into an OS-style menu.

### The Map (Signature Component)
The Leaflet choropleth *is* the product. Eighteen PSGC regions are filled with the muted
risk tokens (`fillOpacity 0.55`, 0.78 when selected), stroked near-ink hairline (selected:
`2px` 85% ink / dark: white 35%→90%), and hovered regions lift to `fillOpacity 0.85` with a
`1.6px` stroke. CARTO Voyager (light) / Dark Matter (dark) basemaps are calmed with
`saturate(0.88) brightness(1.02)`; tooltips are mono-caps glass (`hw-tooltip`). Outbreak
markers are neutral ring glyphs — white ring, semi-transparent risk-tinted center — off by
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
- **Do** use `label-caps` for every metadata line — season, risk tier, data-through, units.
- **Do** use the solid risk tokens for badges carrying white text; the bright tokens for the
  map and legend.
- **Do** let near-white panels read as glass: translucent fill + blur + hairline border.
- **Do** reserve coral (light) / blue (dark) for the single interactive item that should win
  attention.

### Don't:
- **Don't** use green/amber/red outside risk semantics; they are data colors, not brand colors.
- **Don't** introduce pure-black text or pure-white chrome — the cool ink/white pair is the voice.
- **Don't** dress content in shadows; only panels float.
- **Don't** invent a second accent while Signal Coral/Blue is live — one stamp at a time.
- **Don't** set a meta label in body sans; instrument language is mono caps or it's decoration.
- **Don't** frame the map like a photo — the basemap is the floor of the room.
