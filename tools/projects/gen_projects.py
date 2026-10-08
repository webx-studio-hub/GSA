# Builds the project pages from one template.
#   1) writes the Projects mega menu and the phone menu into every page's header (refreshed on each run, so new
#      projects appear everywhere)
#   2) builds residential.html, commercial.html and one page per project in projects_data.py
# Run from anywhere:  python3 tools/projects/gen_projects.py   (needs Pillow: pip3 install pillow)
# Header/footer come from services.html, the brief form and photo viewer from index.html.
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from projects_data import P, CATS
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ARR = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>'
ARR20 = ARR.replace('width="18" height="18"', 'width="20" height="20"')
CHEV = '<svg class="nav__chev" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>'
SVC_TAG = {'architecture': 'Designs shaped around the way you live.', 'construction': 'Built with care. Delivered on time.',
           'interiors': 'Rooms that feel like you.', 'consultancy': 'Clear advice before you build.'}
img = lambda k, i, sm=False: f'assets/img/projects/{k}-{i}{"-sm" if sm else ""}.webp'
by_cat = {c: [p for p in P if p['cat'] == c] for c in CATS}
EXISTING = ['index', 'about', 'contact', 'services', 'architecture', 'construction', 'interiors', 'consultancy', '404']

# ---------- the Projects mega menu ----------
def mega_projects(current=None):
    def col(c):
        rows = ''.join(f'''
                    <li style="--i: {i + (0 if c == 'residential' else 4)}"><a class="mega__row" href="{p['page']}.html"{' aria-current="page"' if current == p['page'] else ''}>
                      <img src="{img(p['key'], 1, True)}" alt="" decoding="async">
                      <span><b>{p['name']}</b><small>{' · '.join(p['services'])}</small></span>
                    </a></li>''' for i, p in enumerate(by_cat[c]))
        cur = ' aria-current="page"' if current == c else ''
        return f'''
                <div class="mega__col">
                  <a class="mega__colhead" href="{c}.html"{cur}><span>{CATS[c]['name']}</span><small>{len(by_cat[c])} project{'s' if len(by_cat[c]) != 1 else ''}</small>{ARR}</a>
                  <ul class="mega__list" role="list">{rows}
                  </ul>
                </div>'''
    feat = P[1]
    return f'''<div class="nav__item" data-mega-item>
          <a class="nav__trigger" href="residential.html"{' aria-current="page"' if current else ''} aria-expanded="false" aria-controls="mega-projects">Projects {CHEV}</a>
          <!-- full-width projects panel: residential and commercial lists (main.js opens it) -->
          <div class="mega mega--projects" id="mega-projects" data-mega>
            <div class="container mega__inner mega__inner--projects">
              <div class="mega__intro">
                <p class="mega__label">Our projects</p>
                <p class="mega__title">Spaces we've <em>shaped.</em></p>
                <p class="mega__text">Homes, villas, interiors and commercial spaces, designed and built by one team.</p>
                <p class="mega__call">Planning something similar? <a href="contact.html">Talk to us</a></p>
              </div>{col('residential')}{col('commercial')}
              <a class="mega__feature" href="{feat['page']}.html" style="--i: 6">
                <span class="mega__img"><img src="{img(feat['key'], 1, True)}" alt="" decoding="async"></span>
                <span class="mega__tag">Featured project</span>
                <span class="mega__name">{feat['name']} {ARR}</span>
              </a>
            </div>
          </div>
        </div>'''

SERVICES = [('architecture', 'Architecture', 'assets/img/work/house-gabled-sm.webp'),
            ('construction', 'Construction', 'assets/img/work/township-street-sm.webp'),
            ('interiors', 'Interiors', 'assets/img/work/living-chandelier-sm.webp'),
            ('consultancy', 'Consultancy', 'assets/img/projects/refined-3-sm.webp')]

def mobile_nav(current_file):
    """The phone/tablet menu: Projects and Services open as dropdowns (main.js), About and Contact are plain links."""
    cur = lambda f: ' aria-current="page"' if f == current_file else ''
    def group(gid, label, inner):
        return f'''
      <div class="mm-group" data-mm-group>
        <button class="mm-toggle" type="button" aria-expanded="false" aria-controls="mm-{gid}"><span>{label}</span>{CHEV.replace('nav__chev', 'mm-chev').replace('width="16" height="16"', 'width="28" height="28"')}</button>
        <div class="mm-panel" id="mm-{gid}">
          <div class="mm-panel__inner">{inner}
          </div>
        </div>
      </div>'''
    tile = lambda href, src, name: f'''
              <a href="{href}"{cur(href)}><img src="{src}" alt="" loading="lazy" decoding="async"><span>{name}</span></a>'''
    projects = ('\n            <div class="mobile-menu__services">' + tile('residential.html', 'assets/img/projects/manor-1-sm.webp', 'Residential')
                + tile('commercial.html', 'assets/img/projects/urban-1-sm.webp', 'Commercial') + '\n            </div>'
                + '\n            <ul class="mm-list" role="list">' + ''.join(f'''
              <li><a href="{p['page']}.html"{cur(p['page'] + '.html')}><img src="{img(p['key'], 1, True)}" alt="" loading="lazy" decoding="async"><span>{p['name']}<small>{CATS[p['cat']]['name']}</small></span></a></li>''' for p in P)
                + '\n            </ul>')
    services = ('\n            <div class="mobile-menu__services">' + ''.join(tile(f'{k}.html', src, n) for k, n, src in SERVICES) + '\n            </div>'
                + f'\n            <a class="link-arrow mm-all" href="services.html"{cur("services.html")}>All services →</a>')
    return ('<nav aria-label="Mobile">' + group('projects', 'Projects', projects) + group('services', 'Services', services)
            + f'\n      <a href="about.html"{cur("about.html")}>About us</a>\n      <a href="contact.html"{cur("contact.html")}>Contact</a>\n    </nav>')

def set_mobile_nav(t, current_file):
    a = t.index('<nav aria-label="Mobile">'); b = t.index('</nav>', a) + len('</nav>')
    return t[:a] + mobile_nav(current_file) + t[b:]

for pg in EXISTING:
    p = pg + '.html'; t = open(p).read()
    a = t.index('<nav class="nav" aria-label="Main">')
    if 'id="mega-projects"' in t:  # refresh the existing panel (it sits just before the Services one)
        s0 = t.index('<div class="nav__item" data-mega-item>', a); s1 = t.index('<div class="nav__item" data-mega-item>', s0 + 10)
        t = t[:s0] + mega_projects() + '\n        ' + t[s1:]
    else:
        b = t.index('<div class="nav__item" data-mega-item>', a)
        seg = t[a:b]
        seg2 = re.sub(r'<a href="(index\.html)?#projects">Projects</a>', mega_projects(), seg, count=1)
        assert seg2 != seg, p
        t = t[:a] + seg2 + t[b:]
    t = set_mobile_nav(t, p)
    open(p, 'w').write(t)

# ---------- shared shell for the new pages ----------
svc = open('services.html').read()
idx = open('index.html').read()
HEAD = svc[:svc.index('  <main id="main">')]
FOOT = svc[svc.index('  <!-- ============ FOOTER ============ -->'):]
CTA = idx[idx.index('    <!-- ============ CTA — project brief ============ -->'):idx.index('  </main>')]
LIGHTBOX = idx[idx.index('  <!-- ============ LIGHTBOX ============ -->'):idx.index('  <div class="cursor"')]

def shell(title, desc, body, current, main, lightbox=False):
    h = re.sub(r'<title>.*?</title>', lambda m: f'<title>{title}</title>', HEAD, count=1)
    h = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', h)
    h = h.replace('<body class="page-services has-photo-hero">', f'<body class="{body} has-photo-hero">')
    h = h.replace('<a class="nav__trigger" href="services.html" aria-current="page"', '<a class="nav__trigger" href="services.html"')
    a = h.index('<div class="nav__item" data-mega-item>'); b = h.index('<div class="nav__item" data-mega-item>', a + 10)
    h = h[:a] + mega_projects(current) + '\n        ' + h[b:]
    f = FOOT
    if lightbox: f = f.replace('  <div class="cursor"', LIGHTBOX + '  <div class="cursor"', 1)
    h = set_mobile_nav(h, current + '.html')
    return h + main + CTA + '  </main>\n\n' + f

def hero(src, alt, pos, crumbs, l1, l2, lead, after_lead, strip):
    return f'''  <main id="main">

    <!-- ============ PAGE HERO ============ -->
    <section class="page-hero" id="top" aria-labelledby="page-title" data-page-hero>
      <div class="page-hero__media">
        <img src="{src}" alt="{alt}" style="object-position: {pos}" fetchpriority="high" decoding="async" data-page-hero-img>
      </div>
      <div class="container page-hero__inner">
        <nav class="crumbs" aria-label="Breadcrumb">{crumbs}</nav>
        <h1 class="page-hero__title" id="page-title" aria-label="{l1} {re.sub('<[^>]+>', '', l2)}">
          <span class="line" aria-hidden="true"><span>{l1}</span></span>
          <span class="line" aria-hidden="true"><span><em>{l2}</em></span></span>
        </h1>
        <div class="page-hero__foot" data-intro>
          <p class="page-hero__lead">{lead}</p>{after_lead}
        </div>{strip}
      </div>
    </section>
'''

def orient(k, i):
    w, h = Image.open(img(k, i)).size
    return 'land' if w > h else 'port'

# ---------- one page per project ----------
order = P  # "next project" cycles through every project
for n, p in enumerate(P):
    k = p['key']; cat = CATS[p['cat']]
    nxt = order[(n + 1) % len(order)]
    facts = [('Category', cat['name']), ('Type', p['type']), ('Style', p['style']), ('Services', ' · '.join(p['services']))]
    strip = '\n        <dl class="page-hero__facts page-hero__facts--dl" data-intro>' + ''.join(f'<div><dt>{a}</dt><dd>{b}</dd></div>' for a, b in facts) + '</dl>'
    after = f'\n          <button class="btn btn--glass btn--lg" type="button" data-project="{k}"><span>View all {p["n"]} photos</span>{ARR20}</button>' if p['n'] > 1 else f'\n          <a class="btn btn--glass btn--lg" href="#contact"><span>Discuss a similar project</span>{ARR20}</a>'
    crumbs = f'<a href="{cat["page"]}.html">{cat["name"]} projects</a><span aria-hidden="true">/</span><span aria-current="page">{p["name"]}</span>'
    main = hero(img(k, 1), f'{p["name"]}, designed by GS Associates', p['pos'], crumbs, p['l1'], p['l2'], p['lead'], after, strip)
    paras = ''.join(f'\n          <p>{x}</p>' for x in p['paras'])
    dl = ''.join(f'<div><dt>{a}</dt><dd>{b}</dd></div>' for a, b in facts + [('Photos', str(p['n']))])
    main += f'''
    <!-- ============ OVERVIEW ============ -->
    <section class="story pj-overview" aria-labelledby="overview-title">
      <div class="container story__grid">
        <div>
          <p class="eyebrow" id="overview-title"><span class="eyebrow__line" aria-hidden="true"></span><span class="eyebrow__text">The project</span></p>
          <p class="statement__text" data-words>{p["statement"]}</p>
        </div>
        <div class="story__text" data-reveal>{paras}
          <dl class="pj-facts">{dl}</dl>
        </div>
      </div>
    </section>
'''
    # photo story: landscape photos run full width, portrait photos pair up side by side
    if p['n'] > 1:
        idxs = list(range(2, p['n'] + 1)); rows = []; i = 0
        while i < len(idxs):
            a = idxs[i]
            if orient(k, a) == 'port' and i + 1 < len(idxs) and orient(k, idxs[i + 1]) == 'port':
                rows.append([a, idxs[i + 1]]); i += 2
            else:
                rows.append([a]); i += 1
        def fig(j, cls):
            return f'<button class="pj-shot {cls}" type="button" data-project="{k}" data-index="{j - 1}" data-cursor="View" aria-label="Open photo {j} of {p["n"]}"><img src="{img(k, j)}" alt="{p["name"]}, photo {j} of {p["n"]}" loading="lazy" decoding="async"{" data-parallax" if cls == "pj-shot--full" else ""}></button>'
        html_rows = ''.join(f'\n        <div class="pj-row{" pj-row--pair" if len(r) == 2 else ""}" data-reveal>' + ''.join(fig(j, 'pj-shot--full' if len(r) == 1 else 'pj-shot--half') for j in r) + '</div>' for r in rows)
        main += f'''
    <!-- ============ PHOTO STORY ============ -->
    <section class="pj-gallery" aria-labelledby="gallery-title">
      <div class="container">
        <div class="section-head section-head--split">
          <div>
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span><span class="eyebrow__text">Photo story</span></p>
            <h2 class="h2" id="gallery-title" data-reveal>A closer <em>look.</em></h2>
          </div>
          <p class="lead" data-reveal>Tap any photo to see it full screen.</p>
        </div>{html_rows}
      </div>
    </section>
'''
    feats = ''.join(f'<li>{f}</li>' for f in p['features'])
    svc_links = ''.join(f'''
            <li><a class="pj-svc" href="{s}.html"><span><b>{s.capitalize()}</b><small>{SVC_TAG[s]}</small></span>{ARR}</a></li>''' for s in p['links'])
    main += f'''
    <!-- ============ HIGHLIGHTS ============ -->
    <section class="pj-highlights" aria-labelledby="highlights-title">
      <div class="container pj-highlights__grid">
        <div>
          <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span><span class="eyebrow__text">Highlights</span></p>
          <h2 class="h2" id="highlights-title" data-reveal>What makes it <em>special.</em></h2>
          <ul class="svc__list" role="list" data-reveal>{feats}</ul>
        </div>
        <div class="pj-highlights__side" data-reveal>
          <h3 class="chapter__sub">Services on this project</h3>
          <ul class="pj-svcs" role="list">{svc_links}
          </ul>
        </div>
      </div>
    </section>

    <!-- ============ NEXT PROJECT ============ -->
    <section class="pj-next" aria-label="Next project">
      <a class="pj-next__link" href="{nxt['page']}.html">
        <span class="pj-next__media"><img src="{img(nxt['key'], 1)}" alt="" loading="lazy" decoding="async" data-parallax></span>
        <span class="container pj-next__text">
          <span class="pj-next__label">Next project · {CATS[nxt['cat']]['name']}</span>
          <span class="pj-next__name">{nxt['name']} <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </span>
      </a>
    </section>

'''
    out = shell(p['seo_title'], p['seo_desc'],
                f'page-project page-{p["cat"]}-project', p['page'], main, lightbox=True)
    open(p['page'] + '.html', 'w').write(out)
    print('wrote', p['page'])

# ---------- category listing pages ----------
for c, cat in CATS.items():
    items = by_cat[c]; other = 'commercial' if c == 'residential' else 'residential'
    strip = '\n        <ul class="page-hero__reach page-hero__jump" role="list" data-intro>' + ''.join(
        f'\n          <li><a href="{p["page"]}.html"><span class="page-hero__label">{p["type"]}</span><span class="page-hero__jumptext">{p["name"]}</span></a></li>' for p in items) + '\n        </ul>'
    crumbs = f'<span>Projects</span><span aria-hidden="true">/</span><span aria-current="page">{cat["name"]}</span>'
    main = hero(cat['hero'][0], cat['hero'][1], cat['hero'][2], crumbs, cat['l1'], cat['l2'], cat['lead'], '', strip)
    cards = ''.join(f'''
          <li class="plist__item" data-reveal>
            <a class="plist__card" href="{p['page']}.html" data-cursor="View">
              <span class="plist__media"><img src="{img(p['key'], 1)}" alt="{p['name']}" loading="lazy" decoding="async"></span>
              <span class="plist__meta">{p['type']} · {' · '.join(p['services'])}</span>
              <span class="plist__name">{p['name']} {ARR20}</span>
              <span class="plist__desc">{p['lead']}</span>
              <span class="plist__count">{p['n']} photo{'s' if p['n'] != 1 else ''}</span>
            </a>
          </li>''' for p in items)
    if len(items) % 2:  # keep the grid even with an invitation card
        cards += f'''
          <li class="plist__item plist__item--note" data-reveal>
            <div class="plist__note">
              <p class="mega__label">More coming soon</p>
              <p class="plist__notetitle">Planning a {cat['name'].lower()} project?</p>
              <p>We'd love to hear about it. Tell us what you have in mind and we'll get back to you.</p>
              <a class="btn btn--dark btn--lg" href="#contact"><span>Start a conversation</span>{ARR20}</a>
            </div>
          </li>'''
    oc = CATS[other]
    main += f'''
    <!-- ============ INTRO ============ -->
    <section class="story plist-intro" aria-labelledby="intro-title">
      <div class="container">
        <p class="eyebrow" id="intro-title"><span class="eyebrow__line" aria-hidden="true"></span><span class="eyebrow__text">{cat['name']} work</span></p>
        <p class="statement__text" data-words>{cat['statement']}</p>
      </div>
    </section>

    <!-- ============ PROJECTS ============ -->
    <section class="plist" aria-label="{cat['name']} projects">
      <div class="container">
        <ul class="plist__grid" role="list">{cards}
        </ul>
      </div>
    </section>

    <!-- ============ THE OTHER CATEGORY ============ -->
    <section class="pj-next" aria-label="{oc['name']} projects">
      <a class="pj-next__link" href="{other}.html">
        <span class="pj-next__media"><img src="{oc['hero'][0]}" alt="" loading="lazy" decoding="async" data-parallax></span>
        <span class="container pj-next__text">
          <span class="pj-next__label">Also explore</span>
          <span class="pj-next__name">{oc['name']} projects <svg aria-hidden="true" viewBox="0 0 24 24" width="48" height="48"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </span>
      </a>
    </section>

'''
    out = shell(cat['seo_title'], cat['seo_desc'],
                f'page-projects page-{c}', c, main)
    open(c + '.html', 'w').write(out)
    print('wrote', c)

# refresh the social-sharing tags (the copied header carries the Services page's ones)
import runpy
runpy.run_path(os.path.join('tools', 'seo.py'))
