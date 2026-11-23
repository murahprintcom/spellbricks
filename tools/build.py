#!/usr/bin/env python3
"""Bundle Spellbricks into ONE self-contained HTML file (CSS, JS and font inlined).
Usage: python3 tools/build.py [page.html] [out.html]
  default: index.html -> dist/elemental-blocks.html
  arena:   python3 tools/build.py arena-prototype.html arena-prototype.html
The modular source in js/ stays the source of truth; index.html also runs directly."""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUTNAME = sys.argv[2] if len(sys.argv) > 2 else 'elemental-blocks.html'
html = (ROOT / PAGE).read_text()

css = (ROOT / 'css/style.css').read_text()
def font_url(m):
    data = base64.b64encode((ROOT / 'fonts' / m.group(1)).read_bytes()).decode()
    return f"url(data:font/woff2;base64,{data})"
css = re.sub(r"url\('\.\./fonts/([^']+)'\)", font_url, css)
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>\n{css}\n</style>')

def inline_js(m):
    src = (ROOT / m.group(1)).read_text()
    return f'<script>/* {m.group(1)} */\n{src}\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

out = ROOT / 'dist' / OUTNAME
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(f'wrote {out} ({out.stat().st_size // 1024} KB)')
