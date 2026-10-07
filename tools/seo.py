# Writes the social-sharing tags (Open Graph / Twitter) into every page, from its <title>, meta description and
# hero photo. Re-run after adding pages:  python3 tools/seo.py
# Set SITE_URL to the live address (e.g. "https://gsassociatesindia.com") before launch: link previews need
# absolute image URLs, and it also adds a canonical link to every page.
import glob, os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE_URL = ''
DEFAULT_IMAGE = 'assets/img/projects/curve-1.webp'

for f in sorted(glob.glob('*.html')):
    t = open(f).read()
    title = re.search(r'<title>(.*?)</title>', t).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)">', t).group(1)
    hero = re.search(r'<img src="([^"]+)"[^>]*data-page-hero-img', t)
    image = hero.group(1) if hero else DEFAULT_IMAGE
    page = '' if f == 'index.html' else f
    abs_ = lambda p: f'{SITE_URL.rstrip("/")}/{p}' if SITE_URL else p
    tags = [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="GS Associates">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:image" content="{abs_(image)}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if SITE_URL:
        tags += [f'<meta property="og:url" content="{abs_(page)}">', f'<link rel="canonical" href="{abs_(page)}">']
    block = '<!-- social -->\n  ' + '\n  '.join(tags) + '\n  <!-- /social -->'
    if '<!-- social -->' in t:
        t = re.sub(r'<!-- social -->.*?<!-- /social -->', lambda m: block, t, flags=re.S)
    else:
        t = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n  ' + block, t, count=1)
    open(f, 'w').write(t)
    print('ok', f)
