# Builds blog.html and one page per post in posts.py, from one template.
# Run from anywhere:  python3 tools/blog/gen_blog.py
# Header/footer come from services.html, the brief form from index.html. Also writes the Blog mega menu (featured
# articles) into the header of every page, then runs tools/projects/gen_projects.py (phone menu, share tags, sitemap).
import datetime, glob, html, os, re, runpy, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from posts import POSTS, CATEGORIES, featured
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))

ARR = '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>'
nice_date = lambda d: datetime.date.fromisoformat(d).strftime('%-d %B %Y')
read_mins = lambda p: max(1, -(-len(re.sub('<[^>]+>', ' ', p['body']).split()) // 200))   # 200 words a minute, rounded up

svc = open('services.html').read()
idx = open('index.html').read()
HEAD = svc[:svc.index('  <main id="main">')].replace(' aria-current="page"', '')
FOOT = svc[svc.index('  <!-- ============ FOOTER ============ -->'):].replace(' aria-current="page"', '')
CTA = idx[idx.index('    <!-- ============ CTA — project brief ============ -->'):idx.index('  </main>')]

def shell(title, desc, body_class, main):
    h = re.sub(r'<title>.*?</title>', lambda m: f'<title>{title}</title>', HEAD, count=1)
    h = re.sub(r'<meta name="description" content="[^"]*">', lambda m: f'<meta name="description" content="{desc}">', h, count=1)
    h = re.sub(r'<body class="[^"]*">', f'<body class="{body_class} has-photo-hero">', h, count=1)
    h = h.replace('<a href="blog.html">Blog</a>', '<a href="blog.html" aria-current="page">Blog</a>')
    f = FOOT.replace('<a href="blog.html">Blog</a>', '<a href="blog.html" aria-current="page">Blog</a>')
    return h + main + CTA + '  </main>\n\n' + f

def hero(img, alt, pos, crumbs, title_html, aria, lead, strip=''):
    return f'''  <main id="main">

    <!-- ============ PAGE HERO ============ -->
    <section class="page-hero page-hero--blog" id="top" aria-labelledby="page-title" data-page-hero>
      <div class="page-hero__media">
        <img src="{img}" alt="{alt}" style="object-position: {pos}" fetchpriority="high" decoding="async" data-page-hero-img>
      </div>
      <div class="container page-hero__inner">
        <nav class="crumbs" aria-label="Breadcrumb">{crumbs}</nav>
        <h1 class="page-hero__title" id="page-title" aria-label="{aria}">{title_html}</h1>
        <div class="page-hero__foot" data-intro>
          <p class="page-hero__lead">{lead}</p>
        </div>{strip}
      </div>
    </section>
'''

def card(p, extra=''):
    return f'''
          <li class="blog-card{extra}" data-cat="{p['category']}" data-reveal>
            <a href="{p['slug']}.html">
              <span class="blog-card__media"><img src="{p['image']}" alt="{p['image_alt']}" loading="lazy" decoding="async"></span>
              <span class="blog-card__meta"><b>{p['category']}</b> · {nice_date(p['date'])} · {read_mins(p)} min read</span>
              <span class="blog-card__title">{p['title']}</span>
              <span class="blog-card__excerpt">{p['excerpt']}</span>
              <span class="blog-card__more">Read article {ARR}</span>
            </a>
          </li>'''

def with_toc(body):
    """Gives every <h2> an id and returns (body, table-of-contents items)."""
    items = []
    def anchor(m):
        text = re.sub('<[^>]+>', '', m.group(1))
        slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
        items.append((slug, re.sub(r'^\d+\.\s*', '', text)))
        return f'<h2 id="{slug}">{m.group(1)}</h2>'
    return re.sub(r'<h2>(.*?)</h2>', anchor, body), items

# ---------- one page per post ----------
for i, p in enumerate(POSTS):
    facts = [('Category', p['category']), ('Published', nice_date(p['date'])), ('Reading time', f'{read_mins(p)} minute{"s" if read_mins(p) != 1 else ""}'), ('Written by', 'GS Associates team')]
    strip = '\n        <dl class="page-hero__facts page-hero__facts--dl" data-intro>' + ''.join(f'<div><dt>{a}</dt><dd>{b}</dd></div>' for a, b in facts) + '</dl>'
    crumbs = f'<a href="blog.html">Blog</a><span aria-hidden="true">/</span><span aria-current="page">{p["category"]}</span>'
    main = hero(p['image'], p['image_alt'], p['pos'], crumbs, f'<span class="line" aria-hidden="true"><span>{p["title"]}</span></span>', html.escape(re.sub('<[^>]+>', '', p['title']), quote=True), p['excerpt'], strip)
    body, toc = with_toc(p['body'])
    same = [q for q in POSTS if q is not p and q['category'] == p['category']]
    related = (same + [q for q in POSTS if q is not p and q not in same])[:3]
    main += f'''
    <!-- ============ ARTICLE ============ -->
    <!-- the contents list sits beside the text on large screens and as a folding box above it on smaller ones -->
    <article class="post" aria-labelledby="page-title">
      <div class="container post__layout">
        <details class="toc" open data-toc data-minutes="{read_mins(p)}">
          <summary class="toc__bar">
            <span class="toc__label">In this article</span>
            <span class="toc__current" data-toc-current>{toc[0][1] if toc else ''}</span>
            <span class="toc__left" data-toc-left>{read_mins(p)} min read</span>
            <span class="toc__progress" aria-hidden="true"><i data-toc-progress></i></span>
          </summary>
          <ol class="toc__list" role="list">{''.join(f'<li class="toc__item"><a href="#{a}"><span class="toc__num">{n:02d}</span><span class="toc__text">{t}</span></a></li>' for n, (a, t) in enumerate(toc, 1))}</ol>
        </details>
        <div class="post__main">
        <div class="post__body">{body}
        </div>
        <div class="post__share">
          <span>Share this article</span>
          <a class="post__share-btn" href="https://wa.me/" target="_blank" rel="noopener" data-share="whatsapp" aria-label="Share on WhatsApp"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg></a>
          <a class="post__share-btn" href="https://www.facebook.com/sharer/sharer.php" target="_blank" rel="noopener" data-share="facebook" aria-label="Share on Facebook"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21Z"/></svg></a>
          <a class="post__share-btn" href="https://www.linkedin.com/sharing/share-offsite/" target="_blank" rel="noopener" data-share="linkedin" aria-label="Share on LinkedIn"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M6.9 8.7H3.6V20h3.3V8.7ZM5.2 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM20.4 13.5c0-3-1.6-5-4.3-5a3.7 3.7 0 0 0-3.3 1.8V8.7H9.6V20h3.3v-5.6c0-1.5.3-2.9 2.1-2.9s1.9 1.7 1.9 3V20h3.3Z"/></svg></a>
          <button class="post__share-btn post__share-copy" type="button" data-share="copy"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg><span data-share-label>Copy link</span></button>
        </div>
        </div>
      </div>
    </article>

    <!-- ============ MORE ARTICLES ============ -->
    <section class="blog-more" aria-labelledby="more-title">
      <div class="container">
        <div class="section-head section-head--split">
          <div>
            <p class="eyebrow"><span class="eyebrow__line" aria-hidden="true"></span><span class="eyebrow__text">Keep reading</span></p>
            <h2 class="h2" id="more-title" data-reveal>More from the <em>blog.</em></h2>
          </div>
          <a class="link-arrow" href="blog.html" data-reveal>All articles →</a>
        </div>
        <ul class="blog-grid" role="list">{''.join(card(q) for q in related)}
        </ul>
      </div>
    </section>

'''
    open(p['slug'] + '.html', 'w').write(shell(p['seo_title'], p['seo_desc'], 'page-blog page-post', main))
    print('wrote', p['slug'])

# ---------- the listing ----------
feat = POSTS[0]
filters = ''.join(f'<button type="button" data-blog-filter="{c}" aria-pressed="false">{c}</button>' for c in CATEGORIES if any(p['category'] == c for p in POSTS))
title_html = '<span class="line" aria-hidden="true"><span>Ideas, advice</span></span>\n          <span class="line" aria-hidden="true"><span><em>&amp; stories.</em></span></span>'
main = hero('assets/img/projects/refined-6.webp', 'A concept sketch of a couple relaxing in a living room', '50% 55%',
            '<span>GS Associates</span><span aria-hidden="true">/</span><span aria-current="page">Blog</span>', title_html,
            'Ideas, advice and stories.', 'Practical guides on planning, building and furnishing your home, from the people who do it every day.')
main += f'''
    <!-- ============ FEATURED ARTICLE ============ -->
    <section class="blog-feature" aria-label="Latest article" data-blog-feature>
      <div class="container">
        <a class="blog-feature__card" href="{feat['slug']}.html" data-reveal>
          <span class="blog-feature__media"><img src="{feat['image']}" alt="{feat['image_alt']}" loading="lazy" decoding="async"></span>
          <span class="blog-feature__body">
            <span class="blog-feature__label">Latest article</span>
            <span class="blog-card__meta"><b>{feat['category']}</b> · {nice_date(feat['date'])} · {read_mins(feat)} min read</span>
            <span class="blog-feature__title">{feat['title']}</span>
            <span class="blog-card__excerpt">{feat['excerpt']}</span>
            <span class="btn btn--dark btn--lg"><span>Read article</span>{ARR}</span>
          </span>
        </a>
      </div>
    </section>

    <!-- ============ ALL ARTICLES ============ -->
    <section class="blog-list" aria-labelledby="list-title">
      <div class="container">
        <div class="blog-list__head">
          <h2 class="h2" id="list-title" data-reveal>All <em>articles.</em></h2>
          <div class="blog-filters" role="group" aria-label="Filter articles by topic"><button type="button" data-blog-filter="all" aria-pressed="true">All</button>{filters}</div>
        </div>
        <ul class="blog-grid" role="list" data-blog-grid>{card(feat, ' blog-card--feat')}{''.join(card(q) for q in POSTS[1:])}
        </ul>
        <p class="blog-empty" hidden data-blog-empty>No articles in this topic yet.</p>
      </div>
    </section>

'''
open('blog.html', 'w').write(shell('Blog: Home Building, Architecture &amp; Interior Ideas | GS Associates',
                                   'Practical advice on planning, building and furnishing your home in Punjab: guides on architecture, construction and interior design from GS Associates.',
                                   'page-blog page-blog-list', main))
print('wrote blog')

# ---------- the Blog mega menu, in every page's header ----------
CHEV = '<svg class="nav__chev" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>'
ARR18 = ARR.replace('width="20" height="20"', 'width="18" height="18"')
post_files = {q['slug'] + '.html' for q in POSTS}

def mega_blog(current_file):
    in_blog = current_file == 'blog.html' or current_file in post_files
    topics = ''.join(f'<a href="blog.html?topic={c}">{c}</a>' for c in CATEGORIES if any(q['category'] == c for q in POSTS))
    cards = ''.join(f'''
                <li style="--i: {n}"><a class="mega__post" href="{q['slug']}.html"{' aria-current="page"' if current_file == q['slug'] + '.html' else ''}>
                  <span class="mega__img"><img src="{q['image']}" alt="" decoding="async"></span>
                  <span class="mega__meta"><b>{q['category']}</b> · {read_mins(q)} min read</span>
                  <span class="mega__posttitle">{q['title']}</span>
                </a></li>''' for n, q in enumerate(featured()))
    return f'''<!-- mega:blog -->
        <div class="nav__item" data-mega-item>
          <a class="nav__trigger" href="blog.html"{' aria-current="page"' if in_blog else ''} aria-expanded="false" aria-controls="mega-blog">Blog {CHEV}</a>
          <!-- full-width blog panel: topics and featured articles (tools/blog/gen_blog.py writes it; main.js opens it) -->
          <div class="mega mega--blog" id="mega-blog" data-mega>
            <div class="container mega__inner mega__inner--blog">
              <div class="mega__intro">
                <p class="mega__label">From the blog</p>
                <p class="mega__title">Ideas, advice <em>&amp; stories.</em></p>
                <p class="mega__text">Practical guides on planning, building and furnishing your home.</p>
                <div class="mega__topics" aria-label="Topics">{topics}</div>
                <a class="btn btn--dark mega__all" href="blog.html"><span>All articles</span>{ARR18}</a>
              </div>
              <ul class="mega__cards mega__cards--blog" role="list">{cards}
              </ul>
            </div>
          </div>
        </div>
        <!-- /mega:blog -->'''

for f in sorted(glob.glob('*.html')):
    t = open(f).read()
    a = t.index('<nav class="nav" aria-label="Main">')
    if '<!-- mega:blog -->' in t:
        s0 = t.index('<!-- mega:blog -->', a); s1 = t.index('<!-- /mega:blog -->', s0) + len('<!-- /mega:blog -->')
        t = t[:s0] + mega_blog(f) + t[s1:]
    else:
        b = t.index('</nav>', t.rindex('</div>', a, t.index('</nav>', t.rindex('data-mega-item', a, t.index('<div class="mobile-menu"'))) + 1))
        seg = t[a:b]
        seg2 = re.sub(r'<a href="blog\.html"(?: aria-current="page")?>Blog</a>', lambda m: mega_blog(f), seg, count=1)
        assert seg2 != seg, f
        t = t[:a] + seg2 + t[b:]
    open(f, 'w').write(t)
print('blog menu written into every page')

# the phone menu (with its Blog dropdown) and the share tags/sitemap are owned by the project generator and seo.py:
# running it here leaves every page in the same state whichever generator was run last
runpy.run_path(os.path.join('tools', 'projects', 'gen_projects.py'))
