#!/usr/bin/env python3
"""Build the website for https://spellbricks.gilagames.com into site/.
Usage: python3 tools/build_site.py
Bundles the game into one index.html (tools/build.py) and adds the web meta tags, manifest,
security headers and robots.txt. Icons and og-image.png in site/ are kept as they are."""
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
URL = 'https://spellbricks.gilagames.com/'
TITLE = 'Spellbricks'
DESC = 'Pixel-art block battle roguelike. Every block is a card, every line is an attack. Climb five dungeons against elemental foes.'

subprocess.run([sys.executable, str(ROOT / 'tools' / 'build.py')], check=True)
html = (ROOT / 'dist' / 'elemental-blocks.html').read_text()

head = f'''<link rel="canonical" href="{URL}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{URL}">
  <meta property="og:title" content="{TITLE}">
  <meta property="og:description" content="{DESC}">
  <meta property="og:image" content="{URL}og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{TITLE}">
  <meta name="twitter:description" content="{DESC}">
  <meta name="twitter:image" content="{URL}og-image.png">
'''
marker = '<meta name="description"'
assert marker in html
html = html.replace(marker, head + '  ' + marker, 1)
SITE.mkdir(exist_ok=True)
(SITE / 'index.html').write_text(html)

(SITE / 'site.webmanifest').write_text(json.dumps({
    'name': TITLE, 'short_name': 'Spellbricks', 'start_url': '/', 'display': 'standalone',
    'orientation': 'portrait', 'background_color': '#0b0d1a', 'theme_color': '#0b0d1a',
    'icons': [
        {'src': '/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': '/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': '/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}, indent=2) + '\n')

(SITE / '_headers').write_text('''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Strict-Transport-Security: max-age=15552000
  X-Frame-Options: SAMEORIGIN

/site.webmanifest
  Content-Type: application/manifest+json
''')
# public stats page (reads /api/stats from the Worker in src/worker.js)
(SITE / 'stats').mkdir(exist_ok=True)
(SITE / 'stats' / 'index.html').write_text((ROOT / 'stats' / 'index.html').read_text())
(SITE / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n')
print('site built:', ', '.join(sorted(p.name for p in SITE.iterdir())))
