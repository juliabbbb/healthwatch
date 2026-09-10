import math

def oklch_to_srgb(L, C, H):
    a = C * math.cos(math.radians(H))
    b = C * math.sin(math.radians(H))
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    r = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bb = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    return tuple(max(0.0, min(1.0, c)) for c in (r, g, bb))

def parse(tok):
    t = tok.strip().replace("oklch(", "").rstrip(")").replace("/", " ").split()
    L, C = float(t[0]), float(t[1])
    H = float(t[2]) if len(t) > 2 else 0.0
    A = float(t[3].rstrip("%")) / 100 if len(t) > 3 else 1.0
    rgb = oklch_to_srgb(L, C, H)
    return rgb, A

def blend(fg_rgb, A, bg_rgb):
    return tuple(A*f + (1-A)*b for f, b in zip(fg_rgb, bg_rgb))

def rel_lum(rgb):
    def f(c):
        if c <= 0.04045:
            return c / 12.92
        return ((c + 0.055) / 1.055) ** 2.4
    r, g, b = map(f, rgb)
    return 0.2126*r + 0.7152*g + 0.0722*b

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def token_rgb(tok, bg):
    rgb, A = parse(tok)
    return blend(rgb, A, bg) if A < 1.0 else rgb

LIGHT_BG = (1.0, 1.0, 1.0)
DARK_BG = (0.02, 0.02, 0.024)

LIGHT = {
    "foreground": (0.24, 0.008, 85), "muted-fg": (0.46, 0.019, 79),
    "background": (0.98, 0.007, 81), "card": (1, 0, 0), "secondary": (0.96, 0.019, 256),
    "muted": (0.94, 0.013, 82), "accent": (0.91, 0.111, 90),
    "accent-fg": (0.31, 0.058, 92), "secondary-fg": (0.34, 0.063, 249),
    "primary": (0.64, 0.19, 35), "primary-fg": (1, 0, 0),
    "destructive": (0.59, 0.188, 32), "destructive-fg": (1, 0, 0),
    "risk-low": (0.62, 0.129, 162), "risk-moderate": (0.71, 0.152, 80), "risk-high": (0.59, 0.188, 32),
    "risk-low-solid": (0.508, 0.118, 165), "risk-moderate-solid": (0.555, 0.116, 66),
    "risk-high-solid": (0.517, 0.176, 27), "wet": (0.64, 0.117, 234), "dry": (0.68, 0.129, 72),
    "panel": "oklch(1 0 0 / 88%)", "sidebar": (0.24, 0.008, 85), "sidebar-fg": (0.96, 0.013, 87),
}
for k in ("panel",):
    LIGHT[k] = token_rgb(LIGHT[k], LIGHT_BG) if isinstance(LIGHT[k], str) else oklch_to_srgb(*LIGHT[k])

DARK = {
    "foreground": (0.96, 0.005, 248), "muted-fg": (0.78, 0.014, 248),
    "background": (0.16, 0.014, 248), "card": (0.21, 0.016, 248), "secondary": (0.27, 0.018, 248),
    "muted": (0.25, 0.015, 248), "secondary-fg": (0.94, 0.005, 248),
    "accent": (0.3, 0.03, 210), "accent-fg": (0.96, 0.005, 248),
    "primary": (0.78, 0.14, 196), "primary-fg": (0.18, 0.02, 240),
    "destructive": (0.59, 0.22, 25), "destructive-fg": (0.98, 0.005, 248),
    "risk-low": (0.74, 0.17, 152), "risk-moderate": (0.79, 0.16, 78), "risk-high": (0.66, 0.22, 27),
    "wet": (0.76, 0.13, 236), "dry": (0.8, 0.13, 68),
    "panel": "oklch(0.19 0.016 248 / 82%)", "sidebar": (0.18, 0.016, 248), "sidebar-fg": (0.94, 0.005, 248),
}
DARK["panel"] = token_rgb(DARK["panel"], DARK_BG)

def rgb_of(theme, name):
    base = name.replace("( chip)", "")
    if name != base:
        rgb = oklch_to_srgb(*theme[base])
        bg = oklch_to_srgb(*theme["background"])
        return blend(rgb, 0.3, bg)
    if name.endswith("(panel)"):
        return theme["panel"]
    return oklch_to_srgb(*theme[name])

def run(theme, pairs, label):
    print(f"=== {label} ===")
    fails = []
    for fg_name, bg_name, note in pairs:
        fg_rgb = rgb_of(theme, fg_name)
        bg_rgb = rgb_of(theme, bg_name)
        r = contrast(fg_rgb, bg_rgb)
        flag = "PASS" if r >= 4.5 else ("LARGE" if r >= 3.0 else "FAIL")
        if flag != "PASS":
            fails.append((fg_name, bg_name, r, flag))
        print(f"{r:5.2f}  {flag:5s}  {fg_name:16s} on {bg_name:16s}  {note}")
    return fails

LIGHT_PAIRS = [
    ("foreground","background",""), ("foreground","card",""), ("foreground","secondary( chip)",""),
    ("muted-fg","background","SECONDARY TEXT"), ("muted-fg","card","SECONDARY TEXT"),
    ("muted-fg","muted","SECONDARY TEXT"), ("muted-fg","secondary","label chips"),
    ("muted-fg","secondary( chip)","label on tinted chip"), ("muted-fg","panel","glass panels"),
    ("secondary-fg","secondary","secondary badge"), ("accent-fg","accent","accent badge"),
    ("primary-fg","primary","PRIMARY BUTTONS"), ("primary","background","links/accents"),
    ("primary","card","links/accents"), ("destructive-fg","destructive","destructive"),
    ("risk-low","background","risk text"), ("risk-moderate","background","risk text"),
    ("risk-high","background","risk text"), ("risk-low","card","risk text"),
    ("risk-moderate","card","risk text"), ("risk-high","card","risk text"),
    ("wet","background","season text"), ("dry","background","season text"),
    ("wet","card","season text"), ("dry","card","season text"),
    ("sidebar-fg","sidebar","sidebar"),
]
DARK_PAIRS = [
    ("foreground","background",""), ("foreground","card",""), ("foreground","secondary",""),
    ("foreground","secondary( chip)",""), ("muted-fg","background","SECONDARY TEXT"),
    ("muted-fg","card","SECONDARY TEXT"), ("muted-fg","secondary","label chips"),
    ("muted-fg","panel","glass panels"), ("muted-fg","muted","SECONDARY TEXT"),
    ("secondary-fg","secondary","secondary badge"), ("accent-fg","accent","accent badge"),
    ("primary-fg","primary","PRIMARY BUTTONS"), ("primary","background","links/accents"),
    ("primary","card","links/accents"), ("destructive-fg","destructive","destructive"),
    ("risk-low","background","risk text"), ("risk-moderate","background","risk text"),
    ("risk-high","background","risk text"), ("risk-low","card","risk text"),
    ("risk-moderate","card","risk text"), ("risk-high","card","risk text"),
    ("wet","background","season text"), ("dry","background","season text"),
    ("wet","card","season text"), ("dry","card","season text"),
    ("sidebar-fg","sidebar","sidebar"),
]

all_fails = []
all_fails += run(LIGHT, LIGHT_PAIRS, "LIGHT")
print("\nwhite text on solid risk badge fills (light)")
for name in ("risk-low-solid", "risk-moderate-solid", "risk-high-solid"):
    r = contrast((1,1,1), oklch_to_srgb(*LIGHT[name]))
    print(f"{r:5.2f}  white on {name}")
    if r < 4.5: all_fails.append((name, "white", r, "FAIL" if r < 3 else "LARGE"))
all_fails += run(DARK, DARK_PAIRS, "DARK")

print("\n=== SUMMARY ===")
if not all_fails:
    print("all pairs >= 3.0 (large text); check FAIL rows above for normal text")
else:
    for fg, bg, r, flag in all_fails:
        print(f"  [{flag}] {fg} on {bg}: {r:.2f}")