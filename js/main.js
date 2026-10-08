/* GS Associates — site interactions (home + inner pages) */
(() => {
  document.documentElement.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ideaScripts = ['vendor/three.idea.min.js?v=1', 'idea3d.js?v=6'].map((f) => new URL(f, document.currentScript.src).href);
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------
     Intro: reveal once fonts + hero art are ready
     --------------------------------------------------------- */
  const heroImages = ['assets/img/hero/find-placeholder/sky.webp', 'assets/img/hero/find-placeholder/house.webp', 'assets/img/hero/find-placeholder/cloud.webp'];
  const imgReady = (src) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = src; });
  const ready = Promise.all([document.fonts ? document.fonts.ready : null, ...($('[data-hero]') ? heroImages : []).map(imgReady)]);
  Promise.race([ready, new Promise((r) => setTimeout(r, 1400))]).then(() => {
    document.documentElement.classList.add('is-loaded');
  });

  /* ---------------------------------------------------------
     HERO — scroll story (timings measured from findrealestate.com)
       0.00–0.18  headline fades and sinks
       0.00–1.00  building rises and grows (ease-out)
       0.08–0.32  GS outline draws itself over the building
       0.29–0.38  building fades away everywhere except inside the letters
       ~0.6–0.85  clouds rise over the lettering (plain page scroll, see .hero__overlap)
     --------------------------------------------------------- */
  const BUILDING_RATIO = 2135 / 2400; // height / width of the building image

  const hero = $('[data-hero]');
  const H = {};
  if (hero) {
    H.sticky = $('.hero__sticky', hero);
    H.svg = $('[data-hero-svg]', hero);
    H.houseImgs = $$('[data-house-img]', hero);
    H.house = $('[data-house]', hero);
    H.outline = $('[data-outline]', hero);
    H.composite = $('[data-composite]', hero);
    H.gs = $$('[data-mark-gs]', hero);
    H.sub = $$('[data-mark-sub]', hero);
    H.cloudL = $('[data-cloud="l"]', hero);
    H.cloudR = $('[data-cloud="r"]', hero);
    H.content = $('[data-hero-content]', hero);
    H.outlineTexts = $$('text', H.outline);
    H.q = 0;
  }

  function layoutHero() {
    const W = H.sticky.clientWidth;
    const Hh = H.sticky.clientHeight;
    if (!W || !Hh) return;
    H.W = W; H.Hh = Hh;
    H.svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);

    // building: full width, top edge 60% down the screen, grows from its bottom edge
    const hh = W * BUILDING_RATIO;
    H.box = { x: 0, y: Hh * 0.6, w: W, h: hh, cx: W / 2, by: Hh * 0.6 + hh };
    H.houseImgs.forEach((img) => {
      img.setAttribute('x', 0); img.setAttribute('y', H.box.y);
      img.setAttribute('width', W); img.setAttribute('height', hh);
    });

    // GS / ASSOCIATES lockup, centred
    const mobile = W < 768;
    const markW = mobile ? W * 0.66 : W * 0.42;
    const [gsEl, subEl] = H.outlineTexts;
    gsEl.setAttribute('font-size', 100);
    const fsGs = (100 * markW) / (gsEl.getComputedTextLength() || 145);
    subEl.setAttribute('font-size', 100);
    subEl.removeAttribute('textLength');
    const fsSub = ((100 * markW) / (subEl.getComputedTextLength() || 760)) * 0.92;
    const capGs = fsGs * 0.7, capSub = fsSub * 0.7, gap = fsGs * 0.13;
    const yGs = Hh / 2 - (capGs + gap + capSub) / 2 + capGs;
    const ySub = yGs + gap + capSub;
    H.gs.forEach((t) => {
      t.setAttribute('x', W / 2); t.setAttribute('y', yGs);
      t.setAttribute('font-size', fsGs.toFixed(2)); t.setAttribute('text-anchor', 'middle');
    });
    H.sub.forEach((t) => {
      t.setAttribute('x', W / 2); t.setAttribute('y', ySub);
      t.setAttribute('font-size', fsSub.toFixed(2)); t.setAttribute('text-anchor', 'middle');
      t.setAttribute('textLength', markW.toFixed(1)); t.setAttribute('lengthAdjust', 'spacing');
    });
    H.dash = Math.ceil(fsGs * 5.2);
    renderHero();
  }

  function heroTarget() {
    const r = hero.getBoundingClientRect();
    const v = -r.top / r.height;
    return Number.isFinite(v) ? clamp(v) : 0;
  }

  function renderHero() {
    const q = H.q;
    const e = easeOutQuad(q);
    const { W, Hh, box } = H;

    // building rises + grows from its bottom edge
    const s = 1 + 0.3 * e;
    const ty = -0.4 * box.h * e;
    const tf = `translate(${box.cx} ${(box.by + ty).toFixed(2)}) scale(${s.toFixed(4)}) translate(${-box.cx} ${(-box.by).toFixed(2)})`;
    H.houseImgs.forEach((img) => img.setAttribute('transform', tf));

    // headline
    const cOp = 1 - smooth(0, 0.18, q);
    H.content.style.opacity = cOp.toFixed(3);
    H.content.style.transform = `translate3d(0, ${(Hh * 0.2 * e).toFixed(1)}px, 0) scale(${(1 - 0.1 * e).toFixed(4)})`;
    H.content.style.visibility = cOp < 0.01 ? 'hidden' : '';

    // outline draws, then the building shows only through the letters
    const draw = clamp((q - 0.085) / 0.23);
    H.outline.style.opacity = (smooth(0.06, 0.11, q) * (1 - smooth(0.30, 0.40, q))).toFixed(3);
    const d = (H.dash * draw).toFixed(1);
    const g = (H.dash * (1 - draw) + 1).toFixed(1);
    H.outlineTexts.forEach((t) => (t.style.strokeDasharray = `${d} ${g}`));
    const comp = smooth(0.29, 0.38, q);
    H.composite.style.opacity = comp.toFixed(3);
    H.house.style.opacity = (1 - comp).toFixed(3);

    // clouds part
    H.cloudL.style.transform = `translate3d(${(-W * 0.09 * e).toFixed(1)}px, 0, 0)`;
    H.cloudR.style.transform = `translate3d(${(W * 0.075 * e).toFixed(1)}px, 0, 0)`;
  }

  if (hero) {
    // a page opened in a hidden tab has no size yet: layout (and the first render) wait for the first resize
    const start = () => { H.q = reduceMotion ? 0 : heroTarget(); layoutHero(); };
    const fonts = document.fonts
      ? Promise.all([document.fonts.load('900 100px Montserrat'), document.fonts.load('800 100px Montserrat')])
      : Promise.resolve();
    fonts.then(start, start);
    addEventListener('resize', () => { if (H.q !== undefined) layoutHero(); });
  }

  /* ---------------------------------------------------------
     Header: hide on the way down, show on the way up
     --------------------------------------------------------- */
  const pageHero = $('[data-page-hero]');
  const header = $('[data-header]');
  let lastY = scrollY;
  function updateHeader() {
    const y = scrollY;
    const heroEnd = hero ? hero.offsetTop + hero.offsetHeight - innerHeight * 1.05 : pageHero ? pageHero.offsetHeight - 80 : 200;
    const menuOpen = document.body.classList.contains('menu-open');
    if (!menuOpen && !megaOpen) {
      if (y > 140 && y > lastY + 4) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 140) header.classList.remove('is-hidden');
    }
    header.classList.toggle('is-solid', y > heroEnd || menuOpen);
    lastY = y;
  }

  /* ---------------------------------------------------------
     Inner-page hero: the photo drifts down a little slower than the page
     --------------------------------------------------------- */
  const pageHeroImg = pageHero && $('[data-page-hero-img]', pageHero);
  if (pageHeroImg) setTimeout(() => pageHero.classList.add('is-settled'), 3000); // zoom-in done, follow the scroll directly
  function updatePageHero() {
    if (!pageHeroImg || reduceMotion) return;
    const y = Math.min(scrollY, pageHero.offsetHeight);
    pageHeroImg.style.setProperty('--drift', `${(y * 0.35).toFixed(1)}px`);
  }

  /* ---------------------------------------------------------
     Mega menus (Projects, Services): open on hover (with a little patience, so they don't flicker) or keyboard
     focus; only one is open at a time
     --------------------------------------------------------- */
  let megaOpen = false;
  const megas = $$('[data-mega-item]').map((item) => ({ item, trigger: $('.nav__trigger', item), timer: 0, open: false }));
  let quiet = false; // set while Escape hands focus back to a trigger, so that doesn't reopen its panel
  const setMega = (m, open) => {
    clearTimeout(m.timer);
    if (open) megas.forEach((o) => { if (o !== m) setMega(o, false); });
    if (open === m.open) return;
    m.open = open;
    m.item.classList.toggle('is-open', open);
    m.trigger.setAttribute('aria-expanded', String(open));
    megaOpen = megas.some((o) => o.open);
    header.classList.toggle('is-mega', megaOpen);
    if (open) header.classList.remove('is-hidden');
  };
  megas.forEach((m) => {
    const later = (open, ms) => { clearTimeout(m.timer); m.timer = setTimeout(() => setMega(m, open), ms); };
    // moving straight from one trigger to the other switches at once
    m.item.addEventListener('mouseenter', () => later(true, megaOpen ? 0 : 90));
    m.item.addEventListener('mouseleave', () => later(false, 220));
    m.item.addEventListener('focusin', () => { if (!quiet) setMega(m, true); });
    m.item.addEventListener('focusout', (e) => { if (!m.item.contains(e.relatedTarget)) setMega(m, false); });
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !megaOpen) return;
    const m = megas.find((o) => o.open);
    setMega(m, false);
    quiet = true; m.trigger.focus(); quiet = false;
  });
  addEventListener('scroll', () => { megas.forEach((m) => { if (m.open && !m.item.matches(':hover')) setMega(m, false); }); }, { passive: true });

  /* ---------------------------------------------------------
     Mobile menu
     --------------------------------------------------------- */
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
    header.classList.remove('is-hidden');
    updateHeader();
  }
  // Projects and Services open as dropdowns; only one at a time. The one holding the current page starts open.
  const groups = $$('[data-mm-group]', menu).map((g) => ({ g, btn: $('.mm-toggle', g) }));
  const setGroup = (grp, open) => {
    grp.g.classList.toggle('is-open', open);
    grp.btn.setAttribute('aria-expanded', String(open));
  };
  groups.forEach((grp) => {
    grp.btn.addEventListener('click', () => {
      const open = !grp.g.classList.contains('is-open');
      groups.forEach((o) => setGroup(o, o === grp && open));
    });
    if ($('[aria-current="page"]', grp.g)) setGroup(grp, true);
  });
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ---------------------------------------------------------
     Statement: words light up as you read
     --------------------------------------------------------- */
  const statement = $('[data-words]');
  let words = [];
  if (statement) {
    const text = statement.textContent.trim();
    statement.setAttribute('aria-label', text);
    statement.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    words = $$('.w', statement);
    if (reduceMotion) words.forEach((w) => w.classList.add('is-on'));
  }
  function updateWords() {
    if (!words.length || reduceMotion) return;
    const r = statement.getBoundingClientRect();
    const vh = innerHeight;
    const p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.38));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('is-on', i < n));
  }

  /* ---------------------------------------------------------
     Reveal on scroll + counters
     --------------------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('.eyebrow').forEach((el) => io.observe(el));
  $$('[data-reveal]').forEach((el, i) => {
    if (el.matches('.stat, .step')) el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(el);
  });

  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      const el = en.target;
      const to = +el.dataset.count;
      if (reduceMotion) { el.textContent = to; return; }
      const t0 = performance.now();
      const dur = 1800;
      const tick = (t) => {
        const k = clamp((t - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* ---------------------------------------------------------
     Pictures tied to the scrollbar
     As a framed picture comes up the screen it opens from a smaller rounded window to full size
     while the photo inside settles from a slight zoom; scroll back up and it shrinks again.
     The photo also drifts gently inside its frame, and overlapping inset photos float a little faster.
     --------------------------------------------------------- */
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const scrubs = $$('.svc__frame, .proj__media, .cta__media, .about__media, .about__photo, .leader__portrait--photo, .chapter__big, .pj-shot--full, .pj-next__media').map((frame) => {
    frame.setAttribute('data-scrub', '');
    const media = frame.closest('.svc__media');
    return {
      frame,
      img: $('[data-parallax]', frame),
      inset: media ? $('[data-float]', media) : null,
      radius: parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0,
      p: 0,
      ready: false,
    };
  });

  // dimension-line dividers draw themselves left to right as they come up the screen
  const rules = $$('[data-rule]').map((el) => ({ el, p: 0, ready: false }));

  // project sheets: as the next sheet slides over, the one underneath shrinks a touch and fades
  const sheets = $$('.proj');
  function updateStack() {
    const vh = innerHeight;
    for (let i = 0; i < sheets.length - 1; i++) {
      const next = sheets[i + 1];
      const top = parseFloat(getComputedStyle(next).top);
      if (!Number.isFinite(top)) { sheets[i].style.removeProperty('--cover'); continue; }
      const nr = next.getBoundingClientRect();
      const cover = clamp(1 - (nr.top - top) / Math.max(1, vh - top));
      sheets[i].style.setProperty('--cover', cover.toFixed(4));
    }
  }

  function updateScrubs(instant) {
    if (reduceMotion) return;
    updateStack();
    const vh = innerHeight;
    rules.forEach((ru) => {
      const r = ru.el.getBoundingClientRect();
      const target = clamp((vh * 0.92 - r.top) / (vh * 0.45));
      ru.p = instant || !ru.ready ? target : ru.p + (target - ru.p) * 0.1;
      ru.ready = true;
      ru.el.style.setProperty('--p', ru.p.toFixed(4));
      ru.el.classList.toggle('is-done', ru.p > 0.985);
    });
    scrubs.forEach((sc) => {
      const r = sc.frame.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) { if (!sc.ready) return; }
      // 0 when the frame's top touches the bottom of the screen, 1 once it has climbed 70% of the screen
      const target = clamp((vh - r.top) / (vh * 0.7));
      sc.p = instant || !sc.ready ? target : sc.p + (target - sc.p) * 0.12;
      sc.ready = true;
      const e = easeOutCubic(sc.p);
      const iy = (1 - e) * 12;
      const ix = (1 - e) * 9;
      sc.frame.style.clipPath = `inset(${iy.toFixed(2)}% ${ix.toFixed(2)}% ${iy.toFixed(2)}% ${ix.toFixed(2)}% round ${sc.radius}px)`;

      const center = r.top + r.height / 2 - vh / 2;
      if (sc.img) {
        const max = r.height * 0.075;
        const y = clamp((-center / vh) * max * 1.6, -max, max);
        sc.img.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${(1 + 0.2 * (1 - e)).toFixed(4)})`;
      }
      if (sc.inset) {
        const amp = innerWidth < 860 ? 0.3 : 1; // keep the drift small on phones so it never covers text
        const y = (clamp((-center / vh) * 70, -70, 70) + (1 - e) * 60) * amp;
        sc.inset.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${(0.86 + 0.14 * e).toFixed(4)})`;
        sc.inset.style.opacity = clamp(e * 1.6).toFixed(3);
      }
    });
  }

  /* ---------------------------------------------------------
     Strengths: image follows the point you are reading
     --------------------------------------------------------- */
  const strengthImgs = $$('[data-strength-img]');
  const strengthItems = $$('[data-strength]');
  const setStrength = (i) => {
    strengthItems.forEach((el) => el.classList.toggle('is-active', +el.dataset.strength === i));
    strengthImgs.forEach((el) => el.classList.toggle('is-active', +el.dataset.strengthImg === i));
  };
  setStrength(0);
  const sIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setStrength(+en.target.dataset.strength); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  strengthItems.forEach((el) => sIO.observe(el));

  /* ---------------------------------------------------------
     About video: muted loop that only plays while on screen; the round button pauses / plays it
     --------------------------------------------------------- */
  const video = $('[data-about-video]');
  const vToggle = $('[data-video-toggle]');
  if (video && vToggle) {
    let userPaused = reduceMotion; // calmer default for people who prefer less motion
    const sync = () => {
      const paused = video.paused;
      vToggle.classList.toggle('is-paused', paused);
      vToggle.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
    };
    const tryPlay = () => { const pr = video.play(); if (pr && pr.catch) pr.catch(() => sync()); };
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    vToggle.addEventListener('click', () => {
      if (video.paused) { userPaused = false; tryPlay(); } else { userPaused = true; video.pause(); }
    });
    new IntersectionObserver((entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !userPaused) tryPlay();
      if (!visible && !video.paused) video.pause();
    }, { threshold: 0.25 }).observe(video);
    sync();
  }

  /* ---------------------------------------------------------
     How we work: each step's line draws in as it arrives; the step in the middle of the screen is highlighted
     --------------------------------------------------------- */
  const stepEls = $$('[data-step]');
  const seenIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-seen'); seenIO.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -25% 0px' });
  const activeIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      stepEls.forEach((el) => el.classList.toggle('is-active', el === en.target));
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  stepEls.forEach((el) => { seenIO.observe(el); activeIO.observe(el); });
  if (reduceMotion) stepEls.forEach((el) => el.classList.add('is-seen'));

  /* ---------------------------------------------------------
     Sketch → reality comparison
     --------------------------------------------------------- */
  const compare = $('[data-compare]');
  if (compare) {
    const range = $('[data-compare-range]', compare);
    const before = $('[data-compare-before]', compare);
    const after = $('[data-compare-after]', compare);
    let pos = 50;
    let hinted = false;
    const setPos = (v) => {
      pos = clamp(v, 0, 100);
      compare.style.setProperty('--pos', `${pos}%`);
      range.value = pos;
    };
    const fromEvent = (e) => {
      const r = compare.getBoundingClientRect();
      setPos(((e.clientX - r.left) / r.width) * 100);
    };
    let dragging = false;
    let startX = 0, startY = 0, decided = false;
    compare.addEventListener('pointerdown', (e) => {
      dragging = true; decided = e.pointerType === 'mouse'; startX = e.clientX; startY = e.clientY;
      if (decided) { compare.setPointerCapture(e.pointerId); fromEvent(e); compare.classList.add('is-dragging'); }
    });
    compare.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!decided) {
        const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true; compare.setPointerCapture(e.pointerId); compare.classList.add('is-dragging');
      }
      fromEvent(e);
    });
    const end = (e) => {
      if (dragging && !decided && e.type === 'pointerup') fromEvent(e); // a simple tap moves the line too
      dragging = false; compare.classList.remove('is-dragging');
    };
    compare.addEventListener('pointerup', end);
    compare.addEventListener('pointercancel', end);
    range.addEventListener('input', () => setPos(+range.value));

    const animateTo = (target, dur = 900) => new Promise((res) => {
      const from = pos; const t0 = performance.now();
      const tick = (t) => {
        const k = clamp((t - t0) / dur);
        const ee = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        setPos(lerp(from, target, ee));
        if (k < 1 && !dragging) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });

    // a gentle "this moves" hint the first time it is seen
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting || hinted || reduceMotion) return;
      hinted = true; obs.disconnect();
      animateTo(78, 1000).then(() => animateTo(22, 1300)).then(() => animateTo(50, 900));
    }, { threshold: 0.6 }).observe(compare);

    $$('[data-compare-tabs] [role="tab"]').forEach((tab, i, all) => {
      tab.addEventListener('click', () => {
        all.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        [before, after].forEach((img) => (img.style.opacity = 0));
        setTimeout(() => {
          before.src = tab.dataset.before;
          after.src = tab.dataset.after;
          const names = ['staircase', 'bedroom', 'living room'];
          after.alt = `Finished ${names[i]}`;
          before.alt = `Concept sketch of the same ${names[i]}`;
          Promise.all([before, after].map((img) => (img.decode ? img.decode().catch(() => {}) : null))).then(() => {
            [before, after].forEach((img) => (img.style.opacity = 1));
            if (!reduceMotion) { setPos(85); animateTo(50, 1100); }
          });
        }, 250);
      });
    });
  }

  /* ---------------------------------------------------------
     Idea to creation — the 3D drawing loads only as the section comes near
     --------------------------------------------------------- */
  const ideaTrack = $('[data-idea]');
  if (ideaTrack) {
    const ideaSection = ideaTrack.closest('.idea');
    if (reduceMotion) {
      ideaSection.classList.add('idea--still');
      const lead = $('[data-idea-lead]', ideaSection);
      if (lead) lead.textContent = 'Tap a step to see one of our homes go from a plan on paper to a finished house.';
    }
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      // plain scripts rather than an ES module, so this also runs when the page is opened from disk (file://)
      const load = (src) => new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      ideaScripts.reduce((p, src) => p.then(() => load(src)), Promise.resolve())
        .then(() => window.GSAIdea.initIdea(ideaSection, { reduceMotion }))
        .catch(() => ideaSection.classList.add('idea--static'));
    }, { rootMargin: '200% 0px' }).observe(ideaTrack);
  }

  /* ---------------------------------------------------------
     Instagram marquee — duplicate for a seamless loop
     --------------------------------------------------------- */
  const track = $('[data-marquee] .marquee__track');
  if (track && !reduceMotion) {
    $$('a', track).forEach((a) => { const c = a.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
  }

  /* ---------------------------------------------------------
     Project lightbox
     --------------------------------------------------------- */
  const PROJECTS = {
    manor: { title: 'French Classical Residence', n: 4 },
    curve: { title: 'Contemporary Curve House', n: 6 },
    stone: { title: 'The Stone Villa', n: 10 },
    refined: { title: 'Refined Everyday Living', n: 6 },
    urban: { title: 'Urban Square', n: 1 },
  };
  const lb = $('[data-lightbox]') || document.createElement('div'); // inner pages have no lightbox
  const hasLb = !!lb.parentNode;
  const lbImg = $('[data-lb-img]', lb);
  const lbTitle = $('[data-lb-title]', lb);
  const lbCount = $('[data-lb-count]', lb);
  const lbThumbs = $('[data-lb-thumbs]', lb);
  let lbKey = null, lbIndex = 0, lbTrigger = null;

  function lbShow(i) {
    const p = PROJECTS[lbKey];
    lbIndex = (i + p.n) % p.n;
    const src = `assets/img/projects/${lbKey}-${lbIndex + 1}.webp`;
    lbImg.classList.add('is-swapping');
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      lbImg.src = src;
      lbImg.alt = `${p.title} — photo ${lbIndex + 1} of ${p.n}`;
      requestAnimationFrame(() => lbImg.classList.remove('is-swapping'));
    };
    pre.src = src;
    lbCount.textContent = `${lbIndex + 1} / ${p.n}`;
    $$('button', lbThumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === lbIndex)));
    const cur = lbThumbs.children[lbIndex];
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  function lbOpen(key, trigger, start = 0) {
    lbKey = key; lbTrigger = trigger;
    const p = PROJECTS[key];
    lbTitle.textContent = p.title;
    lbThumbs.innerHTML = Array.from({ length: p.n }, (_, k) =>
      `<button type="button" aria-label="Photo ${k + 1}"><img src="assets/img/projects/${key}-${k + 1}-sm.webp" alt="" loading="lazy"></button>`).join('');
    $$('button', lbThumbs).forEach((b, k) => b.addEventListener('click', () => lbShow(k)));
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lbShow(start);
    $('[data-lb-close]', lb).focus();
  }

  function lbClose() {
    lb.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(() => { lb.hidden = true; lbImg.removeAttribute('src'); }, 350);
    if (lbTrigger) lbTrigger.focus({ preventScroll: true });
  }

  if (hasLb) {
  $$('[data-project]').forEach((el) => el.addEventListener('click', () => lbOpen(el.dataset.project, el, +(el.dataset.index || 0))));
  $('[data-lb-close]', lb).addEventListener('click', lbClose);
  $('[data-lb-prev]', lb).addEventListener('click', () => lbShow(lbIndex - 1));
  $('[data-lb-next]', lb).addEventListener('click', () => lbShow(lbIndex + 1));
  addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
    if (e.key === 'ArrowLeft') lbShow(lbIndex - 1);
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $$('button', lb);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  let swipeX = null;
  const stage = $('.lightbox__stage', lb);
  stage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
  });
  }

  /* ---------------------------------------------------------
     "View" cursor on project cards
     --------------------------------------------------------- */
  const cursor = $('[data-cursor-el]');
  const C = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer && !reduceMotion) {
    addEventListener('pointermove', (e) => { C.tx = e.clientX; C.ty = e.clientY; }, { passive: true });
    $$('[data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => { cursor.classList.add('is-on'); C.x = C.tx; C.y = C.ty; });
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-on'));
    });
  }

  /* ---------------------------------------------------------
     One loop for everything scroll/pointer driven
     --------------------------------------------------------- */
  function frame() {
    if (hero && !reduceMotion && H.W !== undefined) {
      // values glide toward the scroll position instead of jumping (smooth, like the reference)
      const dq = heroTarget() - H.q;
      if (Math.abs(dq) > 0.00005) {
        H.q += Math.abs(dq) < 0.0005 ? dq : dq * 0.09;
        renderHero();
      }
    }
    updateScrubs(false);
    if (cursor.classList.contains('is-on')) {
      C.x = lerp(C.x, C.tx, 0.2); C.y = lerp(C.y, C.ty, 0.2);
      cursor.style.transform = `translate3d(${C.x}px, ${C.y}px, 0)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHeader(); updateWords(); updatePageHero();
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------------------------------------------------------
     Footer wordmark — always exactly as wide as the page
     --------------------------------------------------------- */
  const word = $('.footer__word');
  function fitWord() {
    if (!word) return;
    word.style.fontSize = '100px';
    const range = document.createRange();
    range.selectNodeContents(word);
    const w = range.getBoundingClientRect().width;
    const avail = word.clientWidth;
    if (w) word.style.fontSize = `${Math.floor((100 * avail) / w * 0.995)}px`;
  }
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitWord);
  addEventListener('resize', fitWord);

  /* ---------------------------------------------------------
     Blog: topic filter on the listing, share buttons on articles
     --------------------------------------------------------- */
  const blogGrid = $('[data-blog-grid]');
  if (blogGrid) {
    const feature = $('[data-blog-feature]');
    const empty = $('[data-blog-empty]');
    const btns = $$('[data-blog-filter]');
    btns.forEach((btn) => btn.addEventListener('click', () => {
      const cat = btn.dataset.blogFilter;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      blogGrid.classList.toggle('is-filtered', cat !== 'all');
      if (feature) feature.hidden = cat !== 'all';
      let shown = 0;
      $$('.blog-card', blogGrid).forEach((c) => { const on = cat === 'all' || c.dataset.cat === cat; c.hidden = !on; if (on) { shown += 1; c.classList.add('is-in'); } });
      empty.hidden = shown > 0;
    }));
  }
  // article contents, as a progress timeline: the current section is marked, passed sections are ticked, the rail fills
  // in amber as you read and a counter shows the minutes left. Large screens: always open beside the text. Smaller
  // screens: a sticky bar showing the current section, folded until tapped.
  const toc = $('[data-toc]');
  if (toc) {
    const wide = matchMedia('(min-width: 1200px)');
    const list = $('.toc__list', toc);
    const items = $$('.toc__item', toc);
    const links = items.map((li) => $('a', li));
    const heads = links.map((l) => document.getElementById(decodeURIComponent(l.hash.slice(1))));
    const body = $('.post__body');
    const current = $('[data-toc-current]', toc);
    const left = $('[data-toc-left]', toc);
    const bar = $('[data-toc-progress]', toc);
    const minutes = +toc.dataset.minutes || 1;
    const fit = () => { toc.open = wide.matches; };
    fit();
    wide.addEventListener('change', fit);
    $('summary', toc).addEventListener('click', (e) => { if (wide.matches) e.preventDefault(); });

    let last = -2;
    const update = () => {
      const line = innerHeight * 0.3; // a section counts as "being read" once its heading passes this line
      let active = -1;
      heads.forEach((h, i) => { if (h && h.getBoundingClientRect().top <= line) active = i; });
      if (active !== last) {
        last = active;
        items.forEach((li, i) => { li.classList.toggle('is-done', i < active); li.classList.toggle('is-active', i === active); });
        links.forEach((l, i) => (i === active ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
        current.textContent = (links[Math.max(active, 0)] || links[0]).querySelector('.toc__text').textContent;
      }
      // rail fill: down to the current dot, then part of the way to the next one
      if (list.offsetParent) {
        const dotY = (i) => { const a = links[i].getBoundingClientRect(); return a.top - list.getBoundingClientRect().top + 9; };
        let fill = 0;
        if (active >= 0) {
          const from = heads[active].getBoundingClientRect().top;
          const to = active + 1 < heads.length ? heads[active + 1].getBoundingClientRect().top : body.getBoundingClientRect().bottom;
          const f = clamp((line - from) / Math.max(1, to - from));
          const end = active + 1 < links.length ? dotY(active + 1) : dotY(active);
          fill = dotY(active) + (end - dotY(active)) * f - dotY(0);
        }
        list.style.setProperty('--fill', `${Math.max(0, fill).toFixed(1)}px`);
      }
      // reading progress and minutes left
      const r = body.getBoundingClientRect();
      const read = clamp((innerHeight * 0.5 - r.top) / r.height);
      bar.parentElement.style.setProperty('--read', read.toFixed(3));
      const remaining = Math.ceil(minutes * (1 - read));
      left.classList.toggle('is-done', read >= 0.98);
      left.textContent = read >= 0.98 ? 'Finished ✓' : read <= 0.02 ? `${minutes} min read` : `${Math.max(1, remaining)} min left`;
    };
    let queued = false;
    const onScroll = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; update(); }); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    toc.addEventListener('toggle', onScroll);
    update();

    // on smaller screens, fold the bar once a section is picked, then scroll, so the heading lands below the menu
    links.forEach((l, i) => l.addEventListener('click', (e) => {
      if (wide.matches || !heads[i]) return;
      e.preventDefault();
      toc.open = false;
      history.replaceState(null, '', l.hash);
      requestAnimationFrame(() => heads[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }));
    }));
  }

  // share the page's clean address (its canonical link), not whatever is in the address bar
  const canonical = $('link[rel="canonical"]');
  const pageUrl = canonical ? canonical.href : location.href.split('#')[0];
  const shareText = document.title.split(' | ')[0];
  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`,
  };
  $$('[data-share]').forEach((el) => {
    const kind = el.dataset.share;
    if (shareLinks[kind]) { el.href = shareLinks[kind]; return; }
    if (kind === 'copy') {
      const label = $('[data-share-label]', el);
      el.addEventListener('click', () => {
        const done = () => { label.textContent = 'Link copied'; setTimeout(() => { label.textContent = 'Copy link'; }, 2200); };
        if (navigator.clipboard) navigator.clipboard.writeText(pageUrl).then(done, () => prompt('Copy this link:', pageUrl));
        else prompt('Copy this link:', pageUrl);
      });
    }
  });

  const yr = $('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();
})();
