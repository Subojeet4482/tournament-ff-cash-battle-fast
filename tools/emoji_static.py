"""Build-time emoji -> PNG for the assembled index.html (no flash of text emoji on first paint).
Only emoji that have a PNG in assets/emoji are replaced. Runtime script js/core/emoji-png.js does the same for text set by JS."""
import re
from pathlib import Path

SKIP = ('script', 'style', 'textarea', 'option', 'title', 'noscript', 'head', 'select', 'svg')

def _fname(e):
    return '-'.join('%x' % ord(c) for c in e if c != '\ufe0f')

def make(root):
    have = {p.stem for p in (Path(root) / 'assets' / 'emoji').glob('*.png')}
    # every known emoji (with and without VS16), longest first
    forms = set()
    for n in have:
        cps = ''.join(chr(int(x, 16)) for x in n.split('-'))
        forms.add(cps)
        if len(cps) == 1 or '\u200d' not in cps: forms.add(cps + '\ufe0f')
        if len(cps) > 1 and '\u20e3' in cps: forms.add(cps[0] + '\ufe0f' + cps[1:])
    rx = re.compile('|'.join(re.escape(f) for f in sorted(forms, key=lambda s: (-len(s), s))))

    def repl(m):
        e = m.group(0); n = _fname(e)
        if n not in have: return e
        return '<img class="emj" src="assets/emoji/%s.png" alt="%s" draggable="false" decoding="async">' % (n, e)

    def convert(html):
        parts = re.split(r'(<!--.*?-->|<[^>]+>)', html, flags=re.S)
        depth = {}; out = []
        for p in parts:
            if p.startswith('<') and not p.startswith('<!--'):
                m = re.match(r'<(/?)([a-zA-Z0-9]+)', p)
                if m:
                    tag = m.group(2).lower(); closing = bool(m.group(1))
                    if tag in SKIP and not p.rstrip().endswith('/>'):
                        depth[tag] = max(0, depth.get(tag, 0) + (-1 if closing else 1))
                out.append(p); continue
            if p.startswith('<!--') or any(depth.values()): out.append(p); continue
            out.append(rx.sub(repl, p))
        return ''.join(out)
    return convert
