import json, os

tokens = {
    "signal-coral": (0.64, 0.19, 35),
    "sky-wash": (0.96, 0.019, 256),
    "sun-wash": (0.91, 0.111, 90),
    "cream-paper": (0.98, 0.007, 81),
    "near-ink": (0.24, 0.008, 85),
    "white-surface": (1.0, 0.0, 0),
    "muted-wash": (0.94, 0.013, 82),
    "faded-ink": (0.46, 0.019, 79),
    "risk-low": (0.62, 0.09, 145),
    "risk-moderate": (0.70, 0.105, 75),
    "risk-high": (0.58, 0.135, 32),
    "risk-low-solid": (0.478, 0.08, 145),
    "risk-moderate-solid": (0.525, 0.09, 70),
    "risk-high-solid": (0.49, 0.12, 30),
    "wet-blue": (0.64, 0.117, 234),
    "dry-amber": (0.68, 0.129, 72),
}


def ramp_for(name):
    l, c, h = tokens[name]
    return [f"oklch({round(0.15 + i * 0.114, 3):.3f} {c:.3f} {h})" for i in range(8)]


meta = {
    "signal-coral": {"role": "primary", "displayName": "Signal Coral", "canonical": "oklch(0.64 0.19 35)", "tonalRamp": ramp_for("signal-coral")},
    "sky-wash": {"role": "secondary", "displayName": "Sky Wash", "canonical": "oklch(0.96 0.019 256)", "tonalRamp": ramp_for("sky-wash")},
    "sun-wash": {"role": "tertiary", "displayName": "Sun Wash", "canonical": "oklch(0.91 0.111 90)", "tonalRamp": ramp_for("sun-wash")},
    "background": {"role": "neutral", "displayName": "Cream Paper", "canonical": "oklch(0.98 0.007 81)", "tonalRamp": ramp_for("cream-paper")},
    "foreground": {"role": "neutral", "displayName": "Near-Ink", "canonical": "oklch(0.24 0.008 85)", "tonalRamp": ramp_for("near-ink")},
    "card": {"role": "neutral", "displayName": "White Surface", "canonical": "oklch(1 0 0)", "tonalRamp": ramp_for("white-surface")},
    "muted": {"role": "neutral", "displayName": "Muted Wash", "canonical": "oklch(0.94 0.013 82)", "tonalRamp": ramp_for("muted-wash")},
    "muted-foreground": {"role": "neutral", "displayName": "Faded Ink", "canonical": "oklch(0.46 0.019 79)", "tonalRamp": ramp_for("faded-ink")},
    "risk-low": {"role": "risk", "displayName": "Risk Green", "canonical": "oklch(0.62 0.129 162)", "tonalRamp": ramp_for("risk-low")},
    "risk-moderate": {"role": "risk", "displayName": "Risk Amber", "canonical": "oklch(0.71 0.152 80)", "tonalRamp": ramp_for("risk-moderate")},
    "risk-high": {"role": "risk", "displayName": "Risk Red", "canonical": "oklch(0.59 0.188 32)", "tonalRamp": ramp_for("risk-high")},
    "risk-low-solid": {"role": "risk", "displayName": "Risk Green Solid", "canonical": "oklch(0.508 0.118 165)", "tonalRamp": ramp_for("risk-low-solid")},
    "risk-moderate-solid": {"role": "risk", "displayName": "Risk Amber Solid", "canonical": "oklch(0.555 0.116 66)", "tonalRamp": ramp_for("risk-moderate-solid")},
    "risk-high-solid": {"role": "risk", "displayName": "Risk Red Solid", "canonical": "oklch(0.517 0.176 27)", "tonalRamp": ramp_for("risk-high-solid")},
    "wet": {"role": "season", "displayName": "Wet Season Blue", "canonical": "oklch(0.64 0.117 234)", "tonalRamp": ramp_for("wet-blue")},
    "dry": {"role": "season", "displayName": "Dry Season Amber", "canonical": "oklch(0.68 0.129 72)", "tonalRamp": ramp_for("dry-amber")},
}

typography_meta = {
    "display": {"displayName": "Display", "purpose": "Page titles and headline figures (24-30px, weight 600, -0.01em)."},
    "title": {"displayName": "Title", "purpose": "Card titles and section labels (20px, weight 600, -0.01em)."},
    "body": {"displayName": "Body", "purpose": "Default reading in Sora at 16px."},
    "label": {"displayName": "Instrument Label", "purpose": "Mono CAPS metadata: season, risk tier, data-through, units. The signature voice."},
}

components = [
    {
        "name": "Primary Button",
        "kind": "button",
        "refersTo": "button-primary",
        "description": "The single coral stamp on a screen — the one default action.",
        "html": '<button class="ds-btn-primary">REVIEW RESPONSE PLAN</button>',
        "css": '.ds-btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;height:36px;padding:0 16px;border-radius:8px;cursor:pointer;background:var(--color-primary);color:var(--color-primary-foreground);border:1px solid transparent;box-shadow:0 1px 2px oklch(0.24 0.008 85/12%);font:500 14px/1 "Sora",ui-sans-serif,system-ui,sans-serif;transition:background-color .15s,box-shadow .15s;}.ds-btn-primary:hover{background:color-mix(in oklab,var(--color-primary) 90%,transparent);}.ds-btn-primary:focus-visible{outline:none;box-shadow:0 0 0 1px var(--color-ring);}.ds-btn-primary:disabled{opacity:.5;cursor:not-allowed;pointer-events:none;}',
    },
    {
        "name": "Ghost Icon Button",
        "kind": "button",
        "refersTo": "button-ghost",
        "description": "The toolbar's quiet workhorse: a transparent square that gains Sun Wash on hover. Carries a 16px icon.",
        "html": '<button class="ds-btn-ghost" aria-label="Settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>',
        "css": ".ds-btn-ghost{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--color-foreground);cursor:pointer;transition:background-color .15s,color .15s;}.ds-btn-ghost:hover{background:var(--color-accent);color:var(--color-accent-foreground);}.ds-btn-ghost:focus-visible{outline:none;box-shadow:0 0 0 1px var(--color-ring);}",
    },
    {
        "name": "Risk Badge",
        "kind": "chip",
        "refersTo": "chip-risk-high",
        "description": "Fully-rounded pill in the solid risk token with white text and a leading dot. The badge voice is uppercase; the dot is the at-a-glance glyph.",
        "html": '<span class="ds-chip-risk">High risk</span>',
        "css": ".ds-chip-risk{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:9999px;background:var(--color-risk-high-solid);color:oklch(0.99 0.003 95);font:500 10px/1.2 \"JetBrains Mono\",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;}.ds-chip-risk::before{content:'';width:6px;height:6px;border-radius:9999px;background:rgba(255,255,255,.8);}",
    },
    {
        "name": "Season Tag",
        "kind": "chip",
        "refersTo": "chip-season-wet",
        "description": "Tinted climatological chip: 12% wet-blue or dry-amber wash over transparent, season color as text. Readable, never a filled block.",
        "html": '<span class="ds-chip-season">Wet season</span>',
        "css": ".ds-chip-season{display:inline-block;padding:2px 6px;border-radius:4px;color:var(--color-wet);background:color-mix(in oklab,var(--color-wet) 12%,transparent);font:500 10px/1.2 \"JetBrains Mono\",ui-monospace,monospace;letter-spacing:.05em;text-transform:uppercase;}",
    },
    {
        "name": "Text Input",
        "kind": "input",
        "refersTo": "input-field",
        "description": "Transparent field on glass with a hairline glazed-ink border; focus is a calm 1px coral ring.",
        "html": '<input class="ds-input" type="text" placeholder="Search region or code..."/>',
        "css": ".ds-input{height:36px;padding:0 12px;border-radius:8px;background:transparent;border:1px solid var(--color-input);color:var(--color-foreground);font:500 14px/1 \"Sora\",ui-sans-serif,system-ui,sans-serif;}.ds-input::placeholder{color:var(--color-muted-foreground);}.ds-input:focus-visible{outline:none;border-color:var(--color-ring);box-shadow:0 0 0 1px var(--color-ring);}",
    },
    {
        "name": "Glass Panel",
        "kind": "card",
        "refersTo": "panel-card",
        "description": "The floating decision surface: 88% translucent panel, backdrop blur, hairline border, ambient-only shadow. Label is the mono instrument voice.",
        "html": '<div class="ds-panel"><p class="ds-label">NATIONAL SNAPSHOT</p><div style="font:700 30px/1.2 \'Sora\',ui-sans-serif,system-ui,sans-serif;letter-spacing:-.02em">2,847 <span style="font-size:14px;color:var(--color-muted-foreground)">cases \u00b7 Aug 2026</span></div></div>',
        "css": ".ds-panel{padding:16px;border-radius:14px;background:var(--color-panel);border:1px solid var(--color-panel-border);backdrop-filter:blur(10px) saturate(120%);box-shadow:0 1px 2px oklch(0.24 0.008 85/6%),0 8px 24px -12px oklch(0.24 0.008 85/12%);}.ds-label{margin:0 0 8px;font:500 11px/1 \"JetBrains Mono\",ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--color-muted-foreground);}",
    },
]

design = {
    "schemaVersion": 2,
    "generatedAt": "2026-09-10T00:00:00Z",
    "title": "Design System: HEALTHWATCH",
    "extensions": {
        "colorMeta": meta,
        "typographyMeta": typography_meta,
        "shadows": [
            {"name": "panel-ambient", "value": "0 1px 2px oklch(0.24 0.008 85/6%), 0 8px 24px -12px oklch(0.24 0.008 85/12%)", "purpose": "Ambient layering under floating glass panels (light mode)."},
            {"name": "panel-void", "value": "0 18px 50px -20px oklch(0 0 0/70%), inset 0 1px 0 oklch(1 0 0/6%)", "purpose": "Deeper glass void over the dark basemap (.dark .glass-panel)."},
            {"name": "tooltip", "value": "0 4px 12px oklch(0.24 0.008 85/12%)", "purpose": "Map tooltip lift; dark adds oklch(0 0 0/45%)."},
        ],
        "motion": [
            {"name": "ease-standard", "value": "cubic-bezier(0.4,0,0.2,1)", "purpose": "Default easing for color/state transitions."},
            {"name": "color-duration", "value": "150ms", "purpose": "Button and control state transitions (Tailwind transition-colors default)."},
        ],
        "breakpoints": [
            {"name": "sm", "value": "640px"},
            {"name": "md", "value": "768px"},
            {"name": "lg", "value": "1024px"},
        ],
    },
    "components": components,
    "narrative": {
        "northStar": "The Public-Health Wire Room",
        "overview": "HEALTHWATCH is a calm command center for Philippine dengue surveillance: one glanceable map of eighteen regions, colored by risk tier, with decision glass floating above the data. The aesthetic is calm, precise, and quietly official: warm daylight surfaces, near-ink text, and one coral signal accent used sparingly. Depth comes from translucent glass panels hovering over the basemap; typography is utilitarian — Sora carries the reading with contemporary geometric presence while JetBrains Mono uppercase labels read as instrument markings. Warm cream is the light default; the dark theme inverts the same vocabulary into a deep operations-console navy with an aqua signal. Chroma is earned: risk tiers own a deliberately muted warm ramp (sage → amber → brick), the coral accent owns interaction, and season tokens own climatological semantics — nothing else is loud.",
        "keyCharacteristics": [
            "Warm cream paper background, near-ink (never pure black or white).",
            "One coral/signal accent for interaction; risk ramp green \u2192 amber \u2192 red for data alone.",
            "Floating glass panels with backdrop blur and hairline borders over the map.",
            "Mono uppercase instrument labels (label-caps) for metadata and section heads.",
            "Rounded-but-restrained radii (~10px base); pills only for status chips and dots.",
            "Both light (daylight cream) and dark (operations navy) themes from the same tokens.",
        ],
        "rules": [
            {"name": "The Risk Reservation Rule", "body": "Green, amber, and red (--risk-*) are reserved exclusively for risk data — map fills, risk badges, risk legend. Never used for chrome or decoration.", "section": "colors"},
            {"name": "The One Stamp Rule", "body": "Signal Coral is used on a minority of any screen. Only one interactive item is 'stamped' coral at a time — its rarity is what makes it a signal.", "section": "colors"},
            {"name": "The Never Pure Rule", "body": "Text and chrome never use pure black or white. Cream paper/near-ink light, navy/aqua dark. Pure white appears only as glass, never as painted light.", "section": "colors"},
            {"name": "The Instrument Label Rule", "body": "Uppercase mono is a metadata voice, not a title voice. It labels, numbers, and footnotes; it never headlines content.", "section": "typography"},
            {"name": "The Glass Floor Rule", "body": "Nothing lifts off the page unless it is a real surface the user acts on. Content inside a panel never casts its own shadow; depth belongs to panels above the map.", "section": "elevation"},
        ],
        "dos": [
            "Keep the map the constant: floats over it, never covers it fully.",
            "Use label-caps for every metadata line — season, risk tier, data-through, units.",
            "Use the solid risk tokens for badges carrying white text; the bright tokens for the map and legend.",
            "Let near-white panels read as glass: translucent fill + blur + hairline border.",
            "Reserve coral for the single interactive item that should win attention.",
        ],
        "donts": [
            "Use green/amber/red outside risk semantics; they are data colors, not brand colors.",
            "Introduce pure-black text or pure-white chrome — the warm ink/cream pair is the voice.",
            "Dress content in shadows; only panels float.",
            "Invent a second accent while Signal Coral is live — one stamp at a time.",
            "Set a meta label in body sans; instrument language is mono caps or it's decoration.",
            "Frame the map like a photo — the basemap is the floor of the room.",
        ],
    },
}

os.makedirs(".impeccable", exist_ok=True)
with open(".impeccable/design.json", "w", encoding="utf-8") as f:
    json.dump(design, f, indent=2, ensure_ascii=False)
print("wrote .impeccable/design.json", os.path.getsize(".impeccable/design.json"), "bytes")