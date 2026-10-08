# Search and sharing setup for every page. Re-run after adding or renaming pages:  python3 tools/seo.py
#   - writes the Open Graph / Twitter tags, the page's address (og:url) and a canonical link into each page,
#     from its <title>, meta description and hero photo
#   - writes sitemap.xml (every page except 404.html) and points robots.txt at it
# SITE_URL is the live address. Change it here if the site goes live somewhere else, then re-run.
import datetime, glob, os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SITE_URL = 'https://gsassociatesindia.com'
DEFAULT_IMAGE = 'assets/img/projects/curve-1.webp'
NOT_INDEXED = {'404.html'}
# how important each page is to the site, for the sitemap (1.0 = home)
PRIORITY = {'index.html': '1.0', 'services.html': '0.9', 'residential.html': '0.9', 'commercial.html': '0.9', 'contact.html': '0.9',
            'about.html': '0.8', 'architecture.html': '0.8', 'construction.html': '0.8', 'interiors.html': '0.8', 'consultancy.html': '0.8'}

base = SITE_URL.rstrip('/')
url = lambda page: f'{base}/' + ('' if page == 'index.html' else page)
pages = sorted(glob.glob('*.html'))
for f in pages:
    t = open(f).read()
    title = re.search(r'<title>(.*?)</title>', t).group(1)
    desc = re.search(r'<meta name="description" content="([^"]*)">', t).group(1)
    hero = re.search(r'<img src="([^"?]+)[^"]*"[^>]*data-page-hero-img', t)
    image = hero.group(1) if hero else DEFAULT_IMAGE
    tags = [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="GS Associates">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:image" content="{base}/{image}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if f not in NOT_INDEXED:
        tags += [f'<meta property="og:url" content="{url(f)}">', f'<link rel="canonical" href="{url(f)}">']
    block = '<!-- social -->\n  ' + '\n  '.join(tags) + '\n  <!-- /social -->'
    if '<!-- social -->' in t:
        t = re.sub(r'<!-- social -->.*?<!-- /social -->', lambda m: block, t, flags=re.S)
    else:
        t = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + '\n  ' + block, t, count=1)
    open(f, 'w').write(t)

today = datetime.date.today().isoformat()
entries = ''.join(f'''
  <url>
    <loc>{url(f)}</loc>
    <lastmod>{today}</lastmod>
    <priority>{PRIORITY.get(f, '0.7')}</priority>
  </url>''' for f in sorted((p for p in pages if p not in NOT_INDEXED), key=lambda p: (-float(PRIORITY.get(p, '0.7')), p)))
open('sitemap.xml', 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{entries}\n</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n')
print(f'{len(pages)} pages tagged, sitemap.xml lists {len(pages) - len(NOT_INDEXED)} pages for {base}')
