#!/usr/bin/env python3
"""
Builds src/styles/dark.css: the dark theme.

The app's colours are written straight into the class names (bg-[#FCFAF5], text-stone-900 ...).
Instead of changing hundreds of places, this file gives each light colour a dark counterpart
that applies when <html> has the class "dark". Run it again after adding a new colour:

    python3 scripts/build-dark-theme.py

It reads every .tsx file, finds the colour classes in use (with hover:, active: and so on, and
with /opacity) and writes a rule for each one that has a dark counterpart below.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Dark counterparts. A value is a hex colour or an rgba() with its own opacity.
# Keys are "<colour>"; the same colour is used for bg, text, border and so on unless a
# property-specific key "<prop>:<colour>" is given.
BG = '#1B1916'        # the app's background (light: warm linen)
SURFACE = '#25221E'   # boxes, sheets, cards (light: white)
SUNKEN = '#201D1A'    # slightly set off areas (light: stone-50)
RAISED = '#2E2A25'    # buttons, chips (light: stone-100)
RAISED2 = '#3A352F'   # stone-200
LINE = '#3A352E'      # borders and dividers (light: #EBE7DF)
TEXT = '#DCD4C7'      # main text (light: stone-900)
GREEN = '#3F7458'     # filled green buttons (light: #284235)
GREEN_TEXT = '#A3CDB4'

DARK = {
    # Backgrounds
    'bg:white': SURFACE,
    'bg:[#FCFAF5]': BG,
    'bg:[#F0ECE1]': SURFACE,
    'bg:[#F3EFE6]': SURFACE,
    'bg:[#F0EDE6]': SURFACE,
    'bg:[#EBE7DF]': LINE,
    'bg:stone-50': SUNKEN,
    'bg:stone-100': RAISED,
    'bg:stone-200': RAISED2,
    'bg:stone-300': '#4A443D',
    'bg:stone-400': '#5A544C',
    # Dark boxes (toasts, timer when done ...) are lifted so they stand out from the background
    'bg:stone-900': '#3A352F',
    'bg:stone-800': '#332F2A',
    'bg:[#284235]': GREEN,
    'bg:[#1C3026]': '#34624A',
    'bg:black': None,  # photo overlays stay black
    'bg:emerald-50': 'rgba(52,211,153,0.10)',
    'bg:emerald-100': 'rgba(52,211,153,0.16)',
    'bg:emerald-200': 'rgba(52,211,153,0.24)',
    'bg:amber-50': 'rgba(245,158,11,0.10)',
    'bg:amber-100': 'rgba(245,158,11,0.16)',
    'bg:amber-200': 'rgba(245,158,11,0.22)',
    'bg:rose-50': 'rgba(244,63,94,0.10)',
    'bg:rose-100': 'rgba(244,63,94,0.16)',
    # Text
    'text:stone-950': TEXT,
    'text:stone-900': TEXT,
    'text:stone-800': '#D0C8BB',
    'text:stone-700': '#BBB3A6',
    'text:stone-600': '#9F978B',
    'text:stone-500': '#888075',
    'text:stone-400': '#6C665D',
    'text:stone-300': '#57524B',
    'text:black': TEXT,
    'text:[#284235]': GREEN_TEXT,
    'text:emerald-600': '#6FCF9F',
    'text:emerald-700': '#86D6AD',
    'text:emerald-800': '#94DAB6',
    'text:emerald-900': '#A6E0C2',
    'text:emerald-950': '#B8E6CE',
    'text:amber-700': '#E3B565',
    'text:amber-800': '#E8C48A',
    'text:amber-900': '#ECCD9A',
    'text:amber-950': '#F0D6AA',
    'text:rose-600': '#F08A9C',
    'text:rose-700': '#F2A0AE',
    'text:rose-800': '#F4B0BC',
    'text:rose-950': '#F7C4CD',
    'text:orange-800': '#EDB48A',
    # Borders and dividers
    'border:[#EBE7DF]': LINE,
    'border:[#E8E4DC]': LINE,
    'border:stone-100': LINE,
    'border:stone-200': '#433E37',
    'border:stone-300': '#4A443D',
    'border:[#284235]': '#5E9478',
    'border:emerald-300': 'rgba(52,211,153,0.35)',
    'border:amber-200': 'rgba(245,158,11,0.30)',
    'border:amber-300': 'rgba(245,158,11,0.40)',
    'border:rose-200': 'rgba(244,63,94,0.30)',
    'border:rose-300': 'rgba(244,63,94,0.40)',
    'border:stone-900': 'rgba(255,250,240,0.10)',
    'border:black': 'rgba(255,250,240,0.10)',
    'divide:[#EBE7DF]': LINE,
    'divide:stone-100': LINE,
    'divide:amber-200': 'rgba(245,158,11,0.25)',
    # Rings, accents, placeholders, gradients
    'ring:[#284235]': '#5E9478',
    'ring:[#FCFAF5]': BG,
    'accent:[#284235]': '#5E9478',
    'placeholder:stone-400': '#6C665D',
    'from:[#FCFAF5]': BG,
    'to:[#F1EBE0]': '#211E1A',
    # A hover to black on green buttons becomes a darker green
    'bg:black@hover': '#34624A',
}

PROP_CSS = {
    'bg': ['background-color'],
    'text': ['color'],
    'border': ['border-color'],
    'divide': ['border-color'],  # applied to children
    'ring': ['--tw-ring-color'],
    'accent': ['accent-color'],
    'placeholder': ['color'],
    'from': ['--tw-gradient-from'],
    'to': ['--tw-gradient-to'],
}
VARIANTS = {'': '', 'hover': ':hover', 'active': ':active', 'focus': ':focus', 'disabled': ':disabled', 'group-hover': ''}

CLASS_RE = re.compile(
    r'(?<![\w-])((?:hover|active|focus|disabled|group-hover):)?'
    r'(bg|text|border|divide|ring|accent|placeholder|from|to)-'
    r'(white|black|stone-\d+|emerald-\d+|amber-\d+|rose-\d+|orange-\d+|\[#[0-9A-Fa-f]{6}\])'
    r'(?:/(\d+))?'
)


def with_alpha(value: str, alpha: int | None) -> str:
    if alpha is None:
        return value
    a = alpha / 100
    if value.startswith('#'):
        r, g, b = int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)
        return f'rgba({r},{g},{b},{a:.2f})'
    m = re.match(r'rgba\((\d+),(\d+),(\d+),([\d.]+)\)', value)
    if m:
        r, g, b, base = m.groups()
        return f'rgba({r},{g},{b},{float(base) * a:.2f})'
    return value


def escape(cls: str) -> str:
    return re.sub(r'([:\[\]#/.%])', r'\\\1', cls)


def main() -> None:
    found = set()
    for path in (ROOT / 'src').rglob('*.tsx'):
        for m in CLASS_RE.finditer(path.read_text(encoding='utf-8')):
            found.add(m.group(0))

    rules = []
    for cls in sorted(found):
        m = CLASS_RE.fullmatch(cls)
        variant, prop, colour, alpha = m.group(1), m.group(2), m.group(3), m.group(4)
        variant = (variant or '').rstrip(':')
        value = None
        if variant == 'hover' and prop == 'bg' and colour == 'black':
            value = DARK['bg:black@hover']
        else:
            value = DARK.get(f'{prop}:{colour}')
        if not value:
            continue
        value = with_alpha(value, int(alpha) if alpha else None)
        sel = f'.dark .{escape(cls)}'
        if variant == 'group-hover':
            sel = f'.dark .group:hover .{escape(cls)}'
        else:
            sel += VARIANTS[variant]
        if prop == 'divide':
            sel += ' > :not(:last-child)'
        if prop == 'placeholder':
            sel += '::placeholder'
        decls = '; '.join(f'{p}: {value} !important' for p in PROP_CSS[prop])
        rules.append(f'{sel} {{ {decls}; }}')

    header = (
        '/* Dark theme. Made by scripts/build-dark-theme.py, do not edit by hand.\n'
        '   Applies when <html> has the class "dark". */\n'
        '.dark { color-scheme: dark; }\n'
        f'html.dark, html.dark body {{ background-color: {BG} !important; color: {TEXT} !important; }}\n'
        '.dark nav svg path[stroke] { stroke: #3A352E; }\n'
        '.dark .shadow-xs, .dark .shadow-2xs, .dark .shadow-sm { --tw-shadow: 0 0 #0000 !important; }\n'
        '/* A selected tab (white on a grey track in the light theme) is lighter than its track */\n'
        '.dark .bg-stone-100 > .bg-white, .dark .bg-\\[\\#F0ECE1\\] > .bg-white, .dark .bg-stone-100 > * > .bg-white { background-color: #474038 !important; }\n'
    )
    out = ROOT / 'src' / 'styles' / 'dark.css'
    out.parent.mkdir(exist_ok=True)
    out.write_text(header + '\n'.join(rules) + '\n', encoding='utf-8')
    print(f'{len(rules)} rules for {len(found)} colour classes -> {out.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
