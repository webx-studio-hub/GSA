/* GS Associates — "Start your project" brief
   The visitor's choices write a ready-to-send WhatsApp / e-mail message and drive a small isometric
   drawing of the project: Architecture draws the lines, Construction fills in the walls, Interiors
   switches the lights on. The building itself changes with the kind of project. */
(() => {
  const root = document.querySelector('[data-cta]');
  if (!root) return;
  const form = root.querySelector('[data-brief]');
  const svg = root.querySelector('[data-iso]');
  const plan = root.querySelector('.plan');
  const wa = root.querySelector('[data-brief-wa]');
  const mail = root.querySelector('[data-brief-mail]');
  const out = (k) => root.querySelector(`[data-brief-out="${k}"]`);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PHONE = '919814626056';
  const EMAIL = 'gsassociates.biz@gmail.com';
  const TYPES = { home: 'New home', renovation: 'Renovation', commercial: 'Office or shop', other: 'Something else' };

  /* ---------------------------------------------------------
     Isometric drawing
     --------------------------------------------------------- */
  const NS = 'http://www.w3.org/2000/svg';
  const COS = Math.cos(Math.PI / 6);
  const iso = (x, y, z) => [(x - y) * COS, (x + y) * 0.5 - z];
  const pts = (list) => list.map((p) => iso(...p).map((v) => v.toFixed(2)).join(',')).join(' ');
  const outline = (list) => `M${pts(list).replace(/ /g, 'L')}Z`;   // closed path, so it can be "drawn" with a dash
  const node = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  };

  // a box is drawn by its three visible faces: top, the x-end (right) and the y-end (left, the street side)
  const faces = ({ x: [x0, x1], y: [y0, y1], z: [z0, z1] }) => ({
    top: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    right: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    left: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
  });
  // an opening on a face: `a` runs along the face (x on the street side, y on the right side)
  const opening = (b, { face, a: [a0, a1], z: [z0, z1] }) => (face === 'y'
    ? [[a0, b.y[1], z0], [a1, b.y[1], z0], [a1, b.y[1], z1], [a0, b.y[1], z1]]
    : [[b.x[1], a0, z0], [b.x[1], a1, z0], [b.x[1], a1, z1], [b.x[1], a0, z1]]);

  const HOME = [
    { x: [0, 7], y: [0, 5], z: [0, 3.2], tone: 'stone', open: [
      { face: 'y', a: [0.5, 4.3], z: [0, 2.5], kind: 'timber' },
      { face: 'y', a: [5.1, 6.3], z: [0, 2.5], kind: 'door' },
      { face: 'x', a: [1, 4], z: [0.9, 2.6], kind: 'glass' }] },
    { x: [0, 8.6], y: [0, 5], z: [3.2, 6.4], open: [
      { face: 'y', a: [0.4, 8.2], z: [3.7, 6], kind: 'glass' },
      { face: 'x', a: [0.8, 4.2], z: [3.8, 5.9], kind: 'glass' }] },
    { x: [0, 4.4], y: [0, 5], z: [6.4, 8.8], open: [
      { face: 'y', a: [0.6, 3.8], z: [6.8, 8.3], kind: 'glass' },
      { face: 'x', a: [1, 4], z: [6.9, 8.3], kind: 'glass' }] },
    // sculpted fins on the street face, a nod to the Curve House
    { x: [1.1, 1.55], y: [5, 5.5], z: [3.2, 10.2] },
    { x: [3.1, 3.55], y: [5, 5.5], z: [3.2, 10.8] },
    { x: [5.1, 5.55], y: [5, 5.5], z: [3.2, 9.8] },
    { x: [7.5, 7.95], y: [5, 5.5], z: [3.2, 9] },
  ];
  const OFFICE = [
    { x: [0, 8], y: [0, 6], z: [0, 3.6], tone: 'stone', open: [
      { face: 'y', a: [0.5, 7.5], z: [0.3, 3], kind: 'glass' },
      { face: 'x', a: [0.6, 5.4], z: [0.3, 3], kind: 'glass' }] },
    { x: [0, 8], y: [0, 6], z: [3.6, 13.2], open: [0, 1, 2].flatMap((f) => {
      const z0 = 3.6 + f * 3.2;
      return [
        ...[0, 1, 2, 3].map((i) => ({ face: 'y', a: [0.45 + i * 1.9, 1.85 + i * 1.9], z: [z0 + 0.6, z0 + 2.6], kind: 'glass' })),
        ...[0, 1, 2].map((i) => ({ face: 'x', a: [0.5 + i * 1.9, 1.9 + i * 1.9], z: [z0 + 0.6, z0 + 2.6], kind: 'glass' })),
      ];
    }) },
    { x: [1, 4.6], y: [1, 4.6], z: [13.2, 14.8] },
    { x: [0, 8], y: [6, 7.3], z: [3.3, 3.6] },
  ];
  // scaffolding around the street and side faces of the home
  const scaffold = () => {
    const s = [];
    const ys = 5.9, xs = 9.1, top = 9.4;
    for (let x = -0.2; x <= 8.81; x += 1.5) s.push([[x, ys, 0], [x, ys, top]]);
    for (let y = -0.2; y <= 5.91; y += 1.53) s.push([[xs, y, 0], [xs, y, top]]);
    [2, 4.4, 6.8, 9.2].forEach((z) => { s.push([[-0.2, ys, z], [xs, ys, z]]); s.push([[xs, -0.2, z], [xs, ys, z]]); });
    for (let x = -0.2; x < 8.6; x += 3) s.push([[x, ys, 0.2], [x + 3, ys, 4.2]]);
    s.push([[xs, -0.2, 4.6], [xs, 5.9, 9]]);
    return s;
  };
  const TREES = { home: [[9.9, 6.6, 2.4], [-1, 6.9, 2.1]], renovation: [[-1, 6.9, 2.1]], commercial: [[10, 7.6, 2.6], [-1.2, 8.2, 2.2]], other: [[9.9, 6.6, 2.4], [-1, 6.9, 2.1]] };

  const TONE = {
    clay: { top: '#f6f2ec', left: '#e2dbcf', right: '#c8bfb2' },
    stone: { top: '#ece7df', left: '#b9b1a5', right: '#9b9387' },
  };
  const FILL = { glass: '#30343b', door: '#5f4535', timber: '#9a5d34' };

  let riseRect = null;
  let riseK = 0;
  let bounds = null;

  function draw(type) {
    svg.textContent = '';
    const boxes = type === 'commercial' ? OFFICE : HOME;
    const all = [];
    boxes.forEach((b) => Object.values(faces(b)).forEach((f) => all.push(...f)));
    if (type === 'renovation') scaffold().forEach((l) => all.push(...l));
    const plot = type === 'commercial' ? [[-2, -1.5, 0], [11, -1.5, 0], [11, 9.5, 0], [-2, 9.5, 0]] : [[-2, -1.5, 0], [11, -1.5, 0], [11, 9, 0], [-2, 9, 0]];
    all.push(...plot);
    const p2 = all.map((p) => iso(...p));
    const xs = p2.map((p) => p[0]); const ys = p2.map((p) => p[1]);
    const pad = 1.2;
    bounds = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    svg.setAttribute('viewBox', `${bounds.x.toFixed(2)} ${bounds.y.toFixed(2)} ${bounds.w.toFixed(2)} ${bounds.h.toFixed(2)}`);

    const defs = node('defs', {}, svg);
    const clip = node('clipPath', { id: 'iso-rise', clipPathUnits: 'userSpaceOnUse' }, defs);
    riseRect = node('rect', { x: bounds.x, width: bounds.w, y: bounds.y + bounds.h, height: 0 }, clip);
    const pool = node('radialGradient', { id: 'iso-pool' }, defs);
    node('stop', { offset: '0', 'stop-color': '#f7a512', 'stop-opacity': '.32' }, pool);
    node('stop', { offset: '1', 'stop-color': '#f7a512', 'stop-opacity': '0' }, pool);

    // the plot, always there, and a pool of light in front of the house when the lights are on
    node('polygon', { class: 'iso__plot', points: pts(plot) }, svg);
    const [px, py] = iso(4, 8, 0);
    node('ellipse', { class: 'iso__glow iso__pool', cx: px, cy: py, rx: 9, ry: 4.2, fill: 'url(#iso-pool)' }, svg);

    let d = 0;
    boxes.forEach((b) => {
      const g = node('g', { class: 'iso__box' }, svg);
      const solid = node('g', { class: 'iso__solid', 'clip-path': 'url(#iso-rise)' }, g);
      const glow = node('g', { class: 'iso__glow' }, g);
      const lines = node('g', { class: 'iso__lines' }, g);
      const f = faces(b);
      const tone = TONE[b.tone || 'clay'];
      ['top', 'left', 'right'].forEach((k) => node('polygon', { points: pts(f[k]), fill: tone[k] }, solid));
      ['top', 'left', 'right'].forEach((k) => node('path', { class: 'iso__line', d: outline(f[k]), pathLength: 1, style: `--d:${(d += 0.05).toFixed(2)}s` }, lines));
      (b.open || []).forEach((o) => {
        const o3 = opening(b, o);
        const q = pts(o3);
        node('polygon', { points: q, fill: FILL[o.kind] }, solid);
        if (o.kind === 'glass') node('polygon', { points: q, class: 'iso__lit' }, glow);
        node('path', { class: 'iso__line iso__line--thin', d: outline(o3), pathLength: 1, style: `--d:${(d += 0.03).toFixed(2)}s` }, lines);
      });
    });

    (TREES[type] || []).forEach(([x, y, h]) => {
      const g = node('g', { class: 'iso__box' }, svg);
      const [tx, ty] = iso(x, y, 0);
      const [cx, cy] = iso(x, y, h);
      node('line', { class: 'iso__trunk', x1: tx, y1: ty, x2: cx, y2: cy + 0.6 }, g);
      node('circle', { class: 'iso__tree', cx, cy, r: 1.15 }, g);
    });

    if (type === 'renovation') {
      const g = node('g', { class: 'iso__scaffold' }, svg);
      scaffold().forEach(([a, b]) => {
        const [x1, y1] = iso(...a); const [x2, y2] = iso(...b);
        node('line', { x1, y1, x2, y2 }, g);
      });
    }
    setRise(0);
  }

  function setRise(k) {
    riseK = k;
    if (!riseRect) return;
    const h = bounds.h * k;
    riseRect.setAttribute('y', (bounds.y + bounds.h - h).toFixed(2));
    riseRect.setAttribute('height', h.toFixed(2));
  }
  let riseAnim = 0;
  function riseTo(to) {
    cancelAnimationFrame(riseAnim);
    if (reduceMotion) { setRise(to); return; }
    const from = riseK; const t0 = performance.now(); const dur = 1100;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setRise(from + (to - from) * e);
      if (t < 1) riseAnim = requestAnimationFrame(tick);
    };
    riseAnim = requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     Brief → summary, message and drawing
     --------------------------------------------------------- */
  let shown = false;      // the drawing waits until the section is seen, then builds itself once
  let lastType = null;
  const timers = [];
  const read = () => {
    const fd = new FormData(form);
    return {
      type: fd.get('type') || 'home',
      services: fd.getAll('service'),
      when: fd.get('when'),
      name: (fd.get('name') || '').toString().trim(),
    };
  };

  function update({ intro = false } = {}) {
    const b = read();
    out('type').textContent = TYPES[b.type];
    out('service').textContent = b.services.length ? b.services.join(', ') : 'Not sure yet';
    out('when').textContent = b.when || 'To be decided';

    const text = [
      'Hello GS Associates! I would like to start a project.',
      '',
      `Project: ${TYPES[b.type]}`,
      `Services: ${b.services.length ? b.services.join(', ') : 'Not sure yet, please advise'}`,
      b.when && `Start: ${b.when}`,
      b.name && `Name: ${b.name}`,
    ].filter((l) => l !== false && l !== null && l !== undefined).join('\n');
    wa.href = `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
    mail.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`New project: ${TYPES[b.type]}`)}&body=${encodeURIComponent(text)}`;

    if (!shown) return;
    const has = (s) => b.services.includes(s);
    plan.classList.toggle('is-empty', !b.services.length);
    timers.splice(0).forEach(clearTimeout);
    const redraw = b.type !== lastType;
    if (redraw) {
      lastType = b.type;
      draw(b.type === 'other' ? 'home' : b.type);
      svg.classList.remove('is-arch', 'is-build', 'is-int');
      void svg.getBoundingClientRect();   // restart the line drawing
    }
    const step = (fn, ms) => (reduceMotion ? fn() : timers.push(setTimeout(fn, ms)));
    const slow = intro || redraw;
    step(() => svg.classList.toggle('is-arch', has('Architecture')), slow ? 60 : 0);
    step(() => riseTo(has('Construction') ? 1 : 0), slow && has('Architecture') ? 650 : 0);
    step(() => svg.classList.toggle('is-int', has('Interiors')), slow ? (has('Construction') ? 1500 : 800) : 0);
    plan.classList.toggle('is-lit', has('Interiors'));
  }

  form.addEventListener('change', () => update());
  form.addEventListener('input', (e) => { if (e.target.name === 'name') update(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); wa.click(); });

  new IntersectionObserver((entries, obs) => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    shown = true;
    update({ intro: true });
  }, { threshold: 0.35 }).observe(svg);
  update();
})();
