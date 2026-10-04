/* GS Associates — "Idea to creation"
   The Contemporary Curve House is drawn as a ground floor plan, raised as a wireframe, filled in as a
   white architectural model and finally handed over to the real photograph, all driven by scroll.

   Model units are metres. Everything on the street face was measured from the photo
   (assets/img/projects/curve-1.webp, 966 × 645 px) at 40 px per metre, so the last camera position
   lines the model up with the picture before it wipes in. Depths and the plan are our own.

   A plain script (not a module) so the page also works when index.html is opened straight from disk.
   Needs js/vendor/three.idea.min.js loaded first; main.js loads both and calls GSAIdea.initIdea(). */
(() => {
const { THREE } = window;

const PX = 40;
const X = (px) => (px - 483) / PX;            // photo x → metres (0 = middle of the photo)
const Y = (py) => (640 - py) / PX;            // photo y → metres above the pavement
const PHOTO_W = 966 / PX;
const PHOTO_H = 645 / PX;
const PHOTO_CY = Y(645 / 2);

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b) => clamp((v - a) / (b - a));
const smooth = (a, b, v) => { const t = map(v, a, b); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------------------------------------------------------
   Line categories: colour, base width (css px)
   --------------------------------------------------------- */
const C = { PLAN: 0, PLAN_LIGHT: 1, EDGE: 2, DETAIL: 3, CONTEXT: 4, RULING: 5, SCAN: 6, DIM: 7 };
const CAT_COLOR = ['#111214', '#9b9ea4', '#111214', '#2b2d31', '#a7a9ae', '#7c7f85', '#f7a512', '#2b2d31'];
const CAT_WIDTH = [1.6, 1, 1.35, 0.85, 1, 0.8, 2, 1];
const MODE = { PEN: 0, BUILD: 1, FREE: 2 };

/* Thick, anti-aliased lines drawn as screen-space quads. Plan lines are "inked" by uDraw; building
   lines are cut off at uBuild so the frame rises floor by floor. */
const lineVert = /* glsl */ `
  uniform vec2 uRes;
  uniform float uPx;
  uniform float uDraw;
  uniform float uBuild;
  uniform float uA[8];
  uniform vec3 uC[8];
  uniform float uW[8];
  attribute vec3 iA;
  attribute vec3 iB;
  attribute vec4 iInfo;   // category, mode, width scale, -
  attribute vec2 iT;      // pen start, pen duration
  varying vec4 vCol;
  void main() {
    int cat = int(iInfo.x + .5);
    vec3 a = iA;
    vec3 b = iB;
    float alpha = uA[cat];
    if (iInfo.y < .5) {
      float k = clamp((uDraw - iT.x) / iT.y, 0., 1.);
      b = mix(a, b, k);
      if (k <= 0.) alpha = 0.;
    } else if (iInfo.y < 1.5) {
      if (min(a.y, b.y) > uBuild + .001) alpha = 0.;
      a.y = min(a.y, uBuild);
      b.y = min(b.y, uBuild);
    }
    vec4 ca = projectionMatrix * modelViewMatrix * vec4(a, 1.);
    vec4 cb = projectionMatrix * modelViewMatrix * vec4(b, 1.);
    vec2 sa = ca.xy / ca.w * uRes * .5;
    vec2 sb = cb.xy / cb.w * uRes * .5;
    vec2 d = sb - sa;
    float len = length(d);
    d = len > 1e-4 ? d / len : vec2(1., 0.);
    vec2 n = vec2(-d.y, d.x);
    float w = uW[cat] * iInfo.z * uPx;
    vec4 c = position.x < .5 ? ca : cb;
    vec2 off = n * position.y * w * .5 + d * (position.x - .5) * w;
    c.xy += off / uRes * 2. * c.w;
    gl_Position = c;
    vCol = vec4(uC[cat], alpha);
  }
`;
const lineFrag = /* glsl */ `
  varying vec4 vCol;
  void main() {
    if (vCol.a < .004) discard;
    gl_FragColor = vCol;
  }
`;

class LineSet {
  constructor() { this.a = []; this.b = []; this.info = []; this.t = []; }
  add(p, q, cat, mode = MODE.BUILD, w = 1) {
    this.a.push(p[0], p[1], p[2]);
    this.b.push(q[0], q[1], q[2]);
    this.info.push(cat, mode, w, 0);
    this.t.push(0, 1);
    return this.info.length / 4 - 1;
  }
  poly(pts, cat, mode, w, closed = false) {
    const ids = [];
    for (let i = 0; i < pts.length - 1; i++) ids.push(this.add(pts[i], pts[i + 1], cat, mode, w));
    if (closed) ids.push(this.add(pts[pts.length - 1], pts[0], cat, mode, w));
    return ids;
  }
  /* give a group of pen lines start/duration inside [t0, t1] in proportion to their length */
  timeline(ids, t0, t1, overlap = 3) {
    const lens = ids.map((i) => Math.hypot(this.b[i * 3] - this.a[i * 3], this.b[i * 3 + 1] - this.a[i * 3 + 1], this.b[i * 3 + 2] - this.a[i * 3 + 2]) + 0.15);
    const total = lens.reduce((s, l) => s + l, 0);
    let acc = 0;
    ids.forEach((id, k) => {
      const span = (t1 - t0) / overlap;
      this.t[id * 2] = t0 + (acc / total) * (t1 - t0 - span);
      this.t[id * 2 + 1] = Math.max(0.004, (lens[k] / total) * (t1 - t0) * 0.9 + span * 0.15);
      acc += lens[k];
    });
  }
  mesh(material) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(this.a), 3));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(this.b), 3));
    g.setAttribute('iInfo', new THREE.InstancedBufferAttribute(new Float32Array(this.info), 4));
    g.setAttribute('iT', new THREE.InstancedBufferAttribute(new Float32Array(this.t), 2));
    g.instanceCount = this.info.length / 4;
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = false;
    return m;
  }
}

function initIdea(section, { reduceMotion = false } = {}) {
  const $ = (s) => section.querySelector(s);
  const track = $('[data-idea]');
  const view = $('[data-idea-view]');
  const canvas = $('[data-idea-canvas]');
  const labelLayer = $('[data-idea-labels]');
  const sheet = $('[data-sheet]');
  const stepsEl = $('[data-idea-steps]');
  const steps = [...section.querySelectorAll('[data-idea-step]')];
  const drawingEl = $('[data-idea-drawing]');
  const captionEl = $('[data-idea-caption]');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    section.classList.add('idea--static');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.5, 400);

  /* ---------------------------------------------------------
     Materials
     --------------------------------------------------------- */
  const CLAY = new THREE.Color('#f3f1ec');
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -1);   // keeps y <= constant
  const solidMats = {};
  const makeSolid = (key, real) => {
    const m = new THREE.MeshStandardMaterial({
      color: CLAY.clone(), roughness: 0.92, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
      clippingPlanes: [clip], clipShadows: true,
    });
    m.userData.real = new THREE.Color(real);
    solidMats[key] = m;
  };
  makeSolid('c', '#b8b3ab');   // board-formed concrete: fins, slabs, bands
  makeSolid('s', '#6d6c69');   // dark granite portal
  makeSolid('t', '#8f532b');   // timber garage door
  makeSolid('w', '#c4c0b9');   // walls
  makeSolid('d', '#37383a');   // dark soffits, handles
  makeSolid('m', '#232425');   // metal rails
  makeSolid('n', '#ebe8e3');   // neighbours stay pale…
  solidMats.n.transparent = true;   // …and fade out when the visitor turns the model to look from the side
  // the inside of anything cut by the rising clip plane reads as a section poché
  const cutMat = new THREE.MeshBasicMaterial({
    color: '#a39d94', side: THREE.BackSide, clippingPlanes: [clip],
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, clippingPlanes: [clip],
  });
  const GLASS_CLAY = new THREE.Color('#dfe6ea');
  const GLASS_REAL = new THREE.Color('#4f6272');

  const lineMat = new THREE.ShaderMaterial({
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uPx: { value: 1 },
      uDraw: { value: 0 },
      uBuild: { value: -1 },
      uA: { value: new Array(8).fill(1) },
      uC: { value: CAT_COLOR.map((c) => new THREE.Color(c)) },
      uW: { value: CAT_WIDTH.slice() },
    },
  });

  /* ---------------------------------------------------------
     Geometry helpers
     --------------------------------------------------------- */
  const lines = new LineSet();
  const solids = {};      // material key → { pos, nor }
  const glassBuf = { pos: [], nor: [] };
  const plan = [];        // [x0, x1, z0, z1] footprints that are cut by the plan and filled as poché
  const pushTris = (buf, geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { buf.pos.push(p[i]); buf.nor.push(n[i]); }
  };
  const boxEdges = (x0, x1, y0, y1, z0, z1, cat, mode = MODE.BUILD, w = 1) => {
    const P = (x, y, z) => [x, y, z];
    const c = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
      .forEach(([i, j]) => lines.add(c[i], c[j], cat, mode, w));
  };
  /* a solid block with its edges; `plan: true` also cuts it in the ground floor plan */
  const box = (x0, x1, y0, y1, z0, z1, mat, { cat = C.EDGE, inPlan = false, edges = true } = {}) => {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    pushTris(solids[mat] ||= { pos: [], nor: [] }, geo);
    if (edges) boxEdges(x0, x1, y0, y1, z0, z1, cat);
    if (inPlan) plan.push([x0, x1, z0, z1]);
  };
  const glass = (x0, x1, y0, y1, z, mullions = []) => {
    pushTris(glassBuf, new THREE.PlaneGeometry(x1 - x0, y1 - y0).translate((x0 + x1) / 2, (y0 + y1) / 2, z));
    lines.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], C.DETAIL, MODE.BUILD, 1, true);
    mullions.forEach((mx) => lines.add([mx, y0, z + 0.01], [mx, y1, z + 0.01], C.DETAIL));
  };
  const railing = (x0, x1, z, y0, y1, gap = 0.12, cat = C.DETAIL, mat = 'm') => {
    box(x0, x1, y1 - 0.05, y1, z - 0.03, z + 0.03, mat, { cat });
    const n = Math.max(1, Math.round((x1 - x0) / gap));
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      lines.add([x, y0, z], [x, y1 - 0.05, z], cat);
    }
  };

  /* Sculpted fin: a half-cylinder shell, convex towards the street, with a rounded top and a curved
     foot. Seen straight on, the top is a semicircle, just like the photo. */
  const fin = ({ cx, cz, r, top, bot, t = 0.18, topArc = 1, botArc = 1, mat = 'c', rulings = true }) => {
    const N = 40;
    const yT = (th) => top - r * topArc * (1 - Math.sin(th));
    const yB = (th) => bot + r * botArc * (1 - Math.sin(th));
    const P = (R, th, y) => [cx + R * Math.cos(th), y, cz + R * Math.sin(th)];
    const pos = []; const nor = [];
    const quad = (a, b, c, d, n1, n2, n3, n4) => {   // a b c d run clockwise as seen from outside
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      nor.push(...n1, ...n3, ...n2, ...n1, ...n4, ...n3);
    };
    const ri = r - t;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI; const a1 = ((i + 1) / N) * Math.PI;
      const no0 = [Math.cos(a0), 0, Math.sin(a0)]; const no1 = [Math.cos(a1), 0, Math.sin(a1)];
      const ni0 = no0.map((v) => -v); const ni1 = no1.map((v) => -v);
      quad(P(r, a0, yB(a0)), P(r, a1, yB(a1)), P(r, a1, yT(a1)), P(r, a0, yT(a0)), no0, no1, no1, no0);
      quad(P(ri, a1, yB(a1)), P(ri, a0, yB(a0)), P(ri, a0, yT(a0)), P(ri, a1, yT(a1)), ni1, ni0, ni0, ni1);
      quad(P(r, a0, yT(a0)), P(r, a1, yT(a1)), P(ri, a1, yT(a1)), P(ri, a0, yT(a0)), [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
      quad(P(ri, a0, yB(a0)), P(ri, a1, yB(a1)), P(r, a1, yB(a1)), P(r, a0, yB(a0)), [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0]);
      lines.add(P(r, a0, yT(a0)), P(r, a1, yT(a1)), C.EDGE);
      lines.add(P(ri, a0, yT(a0)), P(ri, a1, yT(a1)), C.EDGE);
      lines.add(P(r, a0, yB(a0)), P(r, a1, yB(a1)), C.EDGE);
      lines.add(P(ri, a0, yB(a0)), P(ri, a1, yB(a1)), C.EDGE);
    }
    [0, Math.PI].forEach((th) => {
      const nz = [0, 0, -1];
      const q = [P(ri, th, yB(th)), P(r, th, yB(th)), P(r, th, yT(th)), P(ri, th, yT(th))];
      if (th) q.reverse();
      quad(...q, nz, nz, nz, nz);
      lines.add(P(r, th, yB(th)), P(r, th, yT(th)), C.EDGE);
      lines.add(P(ri, th, yB(th)), P(ri, th, yT(th)), C.EDGE);
      lines.add(P(r, th, yT(th)), P(ri, th, yT(th)), C.EDGE);
      lines.add(P(r, th, yB(th)), P(ri, th, yB(th)), C.EDGE);
    });
    if (rulings) {
      for (let k = 1; k < 6; k++) {
        const th = (k / 6) * Math.PI;
        lines.add(P(r + 0.005, th, yB(th)), P(r + 0.005, th, yT(th)), C.RULING);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    pushTris(solids[mat] ||= { pos: [], nor: [] }, geo);
  };

  /* ---------------------------------------------------------
     The Curve House (central block)
     --------------------------------------------------------- */
  const XL = X(308), XR = X(640), ZB = -16, WT = 0.23;
  const L1 = Y(431), L2 = Y(295), L3 = Y(190), TF_TOP = Y(81);

  // ground floor: granite portal around a timber garage door
  box(XL, X(350), 0, Y(455), -0.6, 0.35, 's', { inPlan: true });
  box(X(607), XR, 0, Y(455), -0.6, 0.35, 's', { inPlan: true });
  box(X(350), X(607), Y(472), Y(455), -0.6, 0.35, 's');
  box(X(350), X(607), Y(502), Y(472), -0.7, -0.6, 'd');
  box(X(350), X(607), 0, Y(502), -0.5, -0.42, 't');
  for (let x = X(350) + 0.13; x < X(607) - 0.05; x += 0.13) lines.add([x, 0.02, -0.415], [x, Y(502) - 0.02, -0.415], C.DETAIL);
  box(-0.05, 0.07, 0.7, 2.7, -0.42, -0.36, 'd', { cat: C.DETAIL });

  // outer walls (side walls double as terrace parapets at the back)
  box(XL, XL + WT, 0, L3, ZB, -0.6, 'w', { inPlan: true });
  box(XR - WT, XR, 0, L3, ZB, -0.6, 'w', { inPlan: true });
  box(XL, XR, 0, L3 + 1, ZB, ZB + WT, 'w', { inPlan: true });
  box(XL, XL + WT, L3, L3 + 1, ZB, -4, 'w');
  box(XR - WT, XR, L3, L3 + 1, ZB, -4, 'w');

  // ground floor rooms
  const GF = Y(455);
  box(XL + WT, 1.7, 0, GF, -6.73, -6.5, 'w', { inPlan: true });
  box(2.7, XR - WT, 0, GF, -6.73, -6.5, 'w', { inPlan: true });
  box(0.6, 0.83, 0, GF, ZB + WT, -14.2, 'w', { inPlan: true });
  box(0.6, 0.83, 0, GF, -13.2, -8.4, 'w', { inPlan: true });
  box(0.6, 0.83, 0, GF, -7.4, -6.73, 'w', { inPlan: true });
  box(0.83, XR - WT, 0, GF, -11.23, -11, 'w', { inPlan: true });
  // stair core carries on up
  box(0.6, 0.83, GF, L3, -11.23, -6.5, 'w');
  box(0.83, XR - WT, GF, L3, -11.23, -11, 'w');
  box(0.83, XR - WT, GF, L3, -6.73, -6.5, 'w');

  // columns on a 3 × 4 grid, inside the walls
  [[XL, XL + WT], [0.6, 0.83], [XR - WT, XR]].forEach(([x0, x1], i) => {
    [-0.85, -6.615, -11.115, -15.885].forEach((z) => {
      if (i === 1 && z > -1) return;   // the garage spans clear
      box(x0 - 0.04, x1 + 0.04, 0, L3, z - 0.2, z + 0.2, 'c', { inPlan: true });
    });
  });

  // first floor: slab, deep balcony, glazing
  box(X(328), X(636), Y(455), L1, -0.6, 0.4, 'c');
  box(XL, XR, L1 - 0.4, L1, ZB, -0.6, 'c');
  box(XL, X(328), Y(455), Y(330), -1.3, 0.3, 's');
  glass(X(328), X(636), L1, Y(360), -1.3, [X(395), X(430), X(462.5), X(530), X(562.5)]);
  box(X(328), X(636), Y(360), Y(330), -1.45, -1.3, 'd');
  railing(X(328), X(636), 0.3, L1, Y(392));

  // second floor
  box(X(377), X(636), Y(330), L2, -1.3, 0.4, 'c');
  box(XL, XR, L2 - 0.4, L2, ZB, -1.3, 'c');
  glass(X(377.5), X(587.5), L2, Y(222), -1.3, [X(402.5), X(432.5), X(467.5), X(530), X(560)]);
  box(X(377.5), X(587.5), Y(222), Y(208), -1.45, -1.3, 'd');
  railing(X(377.5), X(587.5), 0.3, L2, Y(265));

  // terrace + top floor
  box(X(379), X(587), Y(208), L3, -1.3, 0.2, 'c');
  box(XL, XR, L3 - 0.4, L3, ZB, -1.3, 'c');
  box(X(410), X(554), L3, TF_TOP - 0.375, -9, -0.8, 'w');
  box(X(398), X(565), TF_TOP - 0.375, TF_TOP, -9.3, -0.5, 'c');
  glass(-1.7, -0.9, L3, TF_TOP - 0.7, -0.78, [-1.3]);
  railing(X(409), X(461), -0.2, L3, Y(152));
  // curved balcony on the top floor
  fin({ cx: X(526.25), cz: -0.5, r: 0.69, top: Y(155), bot: L3, t: 0.12, topArc: 0, botArc: 0, rulings: false });
  {
    const cx = X(526.25), cz = -0.5, R = 0.66, y0 = Y(155), y1 = Y(127.5);
    const arc = [];
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * Math.PI;
      arc.push([cx + R * Math.cos(th), y1, cz + R * Math.sin(th)]);
      if (i % 2 === 0) lines.add([cx + R * Math.cos(th), y0, cz + R * Math.sin(th)], arc[arc.length - 1], C.DETAIL);
    }
    lines.poly(arc, C.DETAIL, MODE.BUILD, 1.2);
  }

  // the five sculpted fins
  fin({ cx: X(359), cz: 0, r: 23 / PX, top: Y(78), bot: Y(340) });
  fin({ cx: X(395.5), cz: -0.6, r: 15.5 / PX, top: Y(19), bot: Y(200) });
  fin({ cx: X(479.5), cz: -0.6, r: 18.5 / PX, top: Y(45), bot: Y(217) });
  fin({ cx: X(569.5), cz: -0.6, r: 17.5 / PX, top: Y(14), bot: Y(215) });
  fin({ cx: X(609.5), cz: 0, r: 26.5 / PX, top: Y(74), bot: Y(327) });

  /* ---------------------------------------------------------
     Neighbours, drawn lighter as context
     --------------------------------------------------------- */
  const nb = (x0, x1, y0, y1, z0, z1) => box(x0, x1, y0, y1, z0, z1, 'n', { cat: C.CONTEXT });
  nb(-12.4, -8.2, 0, 8.5, -15, -1.2);
  nb(-8.2, XL, 0, 9.875, -15, -0.4);
  nb(-8.75, XL, 9.875, 10.125, -6, 0.6);
  railing(-12.4, -8.2, -1.2, 8.5, 9.1, 0.3, C.CONTEXT, 'n');
  lines.poly([[-11.9, 0, -1.19], [-8.6, 0, -1.19], [-8.6, 2.5, -1.19], [-11.9, 2.5, -1.19]], C.CONTEXT, MODE.BUILD, 1, true);
  lines.poly([[-11.6, 4.6, -1.19], [-8.8, 4.6, -1.19], [-8.8, 7.4, -1.19], [-11.6, 7.4, -1.19]], C.CONTEXT, MODE.BUILD, 1, true);
  lines.poly([[-7.6, 5.2, -0.39], [-5.0, 5.2, -0.39], [-5.0, 8.6, -0.39], [-7.6, 8.6, -0.39]], C.CONTEXT, MODE.BUILD, 1, true);
  nb(XR, 12.4, 0, Y(278), -15, -0.8);
  nb(XR, 12.4, Y(345), Y(300), -0.8, -0.55);
  lines.poly([[X(678), 0, -0.79], [X(848), 0, -0.79], [X(848), 2.5, -0.79], [X(678), 2.5, -0.79]], C.CONTEXT, MODE.BUILD, 1, true);
  lines.add([XR, Y(410), -0.5], [12.4, Y(410), -0.5], C.CONTEXT);
  lines.poly([[5.2, 4.4, -0.79], [11.6, 4.4, -0.79], [11.6, 6.6, -0.79], [5.2, 6.6, -0.79]], C.CONTEXT, MODE.BUILD, 1, true);

  /* ---------------------------------------------------------
     Ground floor plan (inked with a pen, then filled)
     --------------------------------------------------------- */
  const PY = 0.02;
  const pp = (x, z) => [x, PY, z];
  const penWalls = [];
  plan.forEach(([x0, x1, z0, z1]) => penWalls.push(...lines.poly([pp(x0, z0), pp(x1, z0), pp(x1, z1), pp(x0, z1)], C.PLAN, MODE.PEN, 1, true)));
  lines.timeline(penWalls, 0, 0.55, 4);

  const penFit = [];
  const arc = (cx, cz, r, a0, a1, cat, n = 12) => {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(pp(cx + r * Math.cos(a), cz + r * Math.sin(a))); }
    return lines.poly(pts, cat, MODE.PEN, 1);
  };
  // doors: leaf + swing
  penFit.push(lines.add(pp(1.7, -6.73), pp(1.7, -7.73), C.PLAN, MODE.PEN));
  penFit.push(...arc(1.7, -6.73, 1, 0, -Math.PI / 2, C.PLAN_LIGHT));
  penFit.push(lines.add(pp(0.6, -7.4), pp(-0.4, -7.4), C.PLAN, MODE.PEN));
  penFit.push(...arc(0.6, -7.4, 1, -Math.PI / 2, -Math.PI, C.PLAN_LIGHT));
  penFit.push(lines.add(pp(0.83, -13.2), pp(1.83, -13.2), C.PLAN, MODE.PEN));
  penFit.push(...arc(0.83, -13.2, 1, -Math.PI / 2, 0, C.PLAN_LIGHT));
  // stair: two flights, a central wall and the walking line
  for (let z = -8.2; z >= -11.001; z -= 0.28) {
    penFit.push(lines.add(pp(0.83, z), pp(2.2, z), C.PLAN_LIGHT, MODE.PEN));
    penFit.push(lines.add(pp(2.3, z), pp(XR - WT, z), C.PLAN_LIGHT, MODE.PEN));
  }
  penFit.push(...lines.poly([pp(2.2, -8.2), pp(2.3, -8.2), pp(2.3, -11), pp(2.2, -11)], C.PLAN, MODE.PEN, 1, true));
  penFit.push(lines.add(pp(1.5, -8.4), pp(1.5, -10.7), C.PLAN, MODE.PEN, 0.8));
  penFit.push(lines.add(pp(1.5, -10.7), pp(1.32, -10.4), C.PLAN, MODE.PEN, 0.8));
  penFit.push(lines.add(pp(1.5, -10.7), pp(1.68, -10.4), C.PLAN, MODE.PEN, 0.8));
  // kitchen counter and sink
  penFit.push(...lines.poly([pp(0.83, -15.17), pp(3.095, -15.17), pp(3.095, -12.4), pp(XR - WT, -12.4)], C.PLAN_LIGHT, MODE.PEN, 1));
  penFit.push(...lines.poly([pp(1.6, -15.65), pp(2.3, -15.65), pp(2.3, -15.27), pp(1.6, -15.27)], C.PLAN_LIGHT, MODE.PEN, 1, true));
  // living: sofa and rug
  penFit.push(...lines.poly([pp(-3.95, -14.1), pp(-3.3, -14.1), pp(-3.3, -10.6), pp(-3.95, -10.6)], C.PLAN_LIGHT, MODE.PEN, 1, true));
  penFit.push(...lines.poly([pp(-2.9, -13.9), pp(-0.5, -13.9), pp(-0.5, -10.8), pp(-2.9, -10.8)], C.PLAN_LIGHT, MODE.PEN, 1, true));
  // two cars in the garage
  const car = (x0, x1, z0, z1) => {
    const c = 0.35;
    penFit.push(...lines.poly([pp(x0 + c, z0), pp(x1 - c, z0), pp(x1, z0 + c), pp(x1, z1 - c), pp(x1 - c, z1), pp(x0 + c, z1), pp(x0, z1 - c), pp(x0, z0 + c)], C.PLAN_LIGHT, MODE.PEN, 1, true));
    penFit.push(lines.add(pp(x0 + 0.15, z1 - 1.35), pp(x1 - 0.15, z1 - 1.35), C.PLAN_LIGHT, MODE.PEN));
    penFit.push(lines.add(pp(x0 + 0.2, z0 + 1.0), pp(x1 - 0.2, z0 + 1.0), C.PLAN_LIGHT, MODE.PEN));
  };
  car(-2.65, -0.8, -5.9, -1.2);
  car(0.55, 2.4, -5.9, -1.2);
  lines.timeline(penFit, 0.38, 0.8, 5);

  // neighbours with hatching, and the road edge
  const penCtx = [];
  const hatch = (x0, x1, z0, z1, gap = 0.7) => {
    penCtx.push(...lines.poly([pp(x0, z0), pp(x1, z0), pp(x1, z1), pp(x0, z1)], C.PLAN_LIGHT, MODE.PEN, 1, true));
    for (let c = x0 - z1 + gap; c < x1 - z0; c += gap) {
      // segment of x - z = c inside the rectangle
      const xa = Math.max(x0, z0 + c); const xb = Math.min(x1, z1 + c);
      if (xb > xa) penCtx.push(lines.add(pp(xa, xa - c), pp(xb, xb - c), C.PLAN_LIGHT, MODE.PEN, 0.7));
    }
  };
  hatch(-12.4, -8.2, -15, -1.2);
  hatch(-8.2, XL - 0.05, -15, -0.4);
  hatch(XR + 0.05, 12.4, -15, -0.8);
  penCtx.push(lines.add(pp(-14, 4.1), pp(14, 4.1), C.PLAN_LIGHT, MODE.PEN));
  lines.timeline(penCtx, 0.55, 0.95, 4);

  // dimensions and a north point
  const penDim = [];
  const dim = (x0, x1, z, zFrom) => {
    penDim.push(lines.add(pp(x0 - 0.3, z), pp(x1 + 0.3, z), C.DIM, MODE.PEN));
    [x0, x1].forEach((x) => {
      penDim.push(lines.add(pp(x, zFrom), pp(x, z + 0.3), C.DIM, MODE.PEN, 0.8));
      penDim.push(lines.add(pp(x - 0.18, z + 0.18), pp(x + 0.18, z - 0.18), C.DIM, MODE.PEN, 1.6));
    });
  };
  dim(XL, XR, 2.75, 0.6);
  dim(X(350), X(607), 1.25, 0.55);
  {
    const nx = -5.6, nz = 3.0, r = 0.55;
    penDim.push(...arc(nx, nz, r, 0, Math.PI * 2, C.DIM, 28));
    penDim.push(...lines.poly([pp(nx, nz - r - 0.25), pp(nx + 0.28, nz + 0.3), pp(nx, nz + 0.12), pp(nx - 0.28, nz + 0.3)], C.DIM, MODE.PEN, 1, true));
  }
  lines.timeline(penDim, 0.7, 1, 3);

  // poché: the cut walls and columns filled in
  const pocheGeo = new THREE.BufferGeometry();
  {
    const pos = [];
    plan.forEach(([x0, x1, z0, z1]) => pos.push(x0, PY, z0, x1, PY, z1, x1, PY, z0, x0, PY, z0, x0, PY, z1, x1, PY, z1));
    pocheGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }
  const pocheMat = new THREE.MeshBasicMaterial({ color: '#2b2d31', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const poche = new THREE.Mesh(pocheGeo, pocheMat);
  poche.renderOrder = 1;
  scene.add(poche);

  /* ---------------------------------------------------------
     Assemble
     --------------------------------------------------------- */
  let nbFront, nbBack;
  Object.entries(solids).forEach(([key, buf]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nor, 3));
    const front = new THREE.Mesh(geo, solidMats[key]);
    front.castShadow = true; front.receiveShadow = true;
    const back = new THREE.Mesh(geo, cutMat);
    scene.add(front, back);
    if (key === 'n') { nbFront = front; nbBack = back; }
  });
  {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(glassBuf.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(glassBuf.nor, 3));
    const g = new THREE.Mesh(geo, glassMat);
    g.renderOrder = 2;
    scene.add(g);
  }
  const lineMesh = lines.mesh(lineMat);
  lineMesh.renderOrder = 3;
  scene.add(lineMesh);

  // the amber "construction plane" that sweeps up while the frame rises
  const scanLines = new LineSet();
  scanLines.poly([[-12.9, 0, -15.6], [12.9, 0, -15.6], [12.9, 0, 1.1], [-12.9, 0, 1.1]], C.SCAN, MODE.FREE, 1, true);
  const scanMat = lineMat.clone();
  scanMat.uniforms = THREE.UniformsUtils.clone(lineMat.uniforms);
  const scan = new THREE.Group();
  const scanFill = new THREE.Mesh(
    new THREE.PlaneGeometry(25.8, 16.7).rotateX(-Math.PI / 2).translate(0, 0, -7.25),
    new THREE.MeshBasicMaterial({ color: '#f7a512', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  scan.add(scanFill, scanLines.mesh(scanMat));
  scan.renderOrder = 4;
  scene.add(scan);

  // light, shadows and a ground that only shows shadows
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc7bb', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.6);
  sun.position.set(16, 36, 22);
  sun.target.position.set(0, 4, -6);
  sun.castShadow = true;
  const small = Math.min(innerWidth, innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const groundMat = new THREE.ShadowMaterial({ color: '#2b2118', opacity: 0, transparent: true, depthWrite: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------------------------------------------------------
     Labels (HTML, projected from 3D points)
     --------------------------------------------------------- */
  const labels = [];
  const tag = (text, pos, group, cls = 'sheet__tag') => {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    labelLayer.appendChild(el);
    labels.push({ el, pos: new THREE.Vector3(...pos), group });
  };
  tag('Garage', [-0.2, 0, -3.55], 'plan');
  tag('Living', [-1.9, 0, -8.7], 'plan');
  tag('Stair', [2.2, 0, -7.45], 'plan');
  tag('Kitchen', [2.2, 0, -13.7], 'plan');
  tag('8.30 m', [(XL + XR) / 2, 0, 2.75], 'plan', 'sheet__tag sheet__tag--dim');
  tag('6.43 m', [(X(350) + X(607)) / 2, 0, 1.25], 'plan', 'sheet__tag sheet__tag--dim');
  tag('N', [-5.6, 0, 1.95], 'plan', 'sheet__tag sheet__tag--n');
  /* callout with a leader line; it swaps sides when the text would run off the sheet */
  const note = (text, pos, dx, dy) => {
    const el = document.createElement('span');
    el.className = 'sheet__note';
    el.innerHTML = `<i class="sheet__note-dot"></i><i class="sheet__note-line"></i><span class="sheet__note-text">${text}</span>`;
    labelLayer.appendChild(el);
    labels.push({ el, pos: new THREE.Vector3(...pos), group: 'note', note: { dx, dy, line: el.children[1], text: el.children[2], side: 0, tw: 0 } });
  };
  const placeNote = (n, x) => {
    n.tw ||= n.text.offsetWidth;
    const adx = Math.abs(n.dx);
    const fits = (s) => (s > 0 ? x + adx + n.tw <= W - 6 : x - adx - n.tw >= 6);
    let side = Math.sign(n.dx);
    if (!fits(side)) side = fits(-side) ? -side : (x > W / 2 ? -1 : 1);
    const dx = adx * side;
    if (side !== n.side) {
      n.side = side;
      n.line.style.width = `${Math.hypot(dx, n.dy)}px`;
      n.line.style.transform = `rotate(${Math.atan2(n.dy, dx)}rad)`;
      n.text.style.top = `${n.dy}px`;
      n.text.dataset.side = side < 0 ? 'l' : 'r';
    }
    // on narrow sheets keep the words inside the frame even if neither side has room
    const left = side > 0 ? x + dx : x + dx - n.tw;
    n.text.style.left = `${dx + clamp(left, 6, Math.max(6, W - n.tw - 6)) - left}px`;
  };
  note('Sculpted concrete fins', [X(569.5), Y(60), 0], 56, -34);
  note('Deep, shaded balconies', [X(340), Y(400), 0.3], -58, -30);
  note('Timber garage door', [X(560), Y(560), -0.4], 54, 30);

  /* ---------------------------------------------------------
     Camera path
     --------------------------------------------------------- */
  let aspect = 1.5;
  const key = (p, az, el, fov, t, fit, cover = false) => ({ p, az, el, fov, t, fit, cover });
  const keys = () => {
    const wide = aspect >= 1;
    const planAz = wide ? -90 : 0;
    const planFit = wide ? [22.5, 11] : [11.5, 22];
    return [
      key(0, planAz, 89.3, 30, [-0.6, 0, -6.4], planFit.map((v) => v * 1.06)),
      key(0.27, planAz - 7, 89.3, 30, [-0.6, 0, -6.4], planFit),
      key(0.47, -38, 26, 30, [0, 6.4, -6.5], [19, 19.5]),
      key(0.6, -26, 15, 27, [0, 7.2, -5], [17.5, 18.5]),
      key(0.74, 30, 10, 24, [0, 7.6, -3.5], [17.5, 18]),
      key(0.84, 0, 0, 12, [0, PHOTO_CY, 0], [PHOTO_W, PHOTO_H], true),
      key(1, 0, 0, 12, [0, PHOTO_CY, 0], [PHOTO_W, PHOTO_H], true),
    ];
  };
  let K = keys();
  /* the visitor's own viewing angle (degrees), added to the scroll path: az/el from dragging,
     hx/hy a gentle tilt that follows the mouse. t… are targets, v… the spin left after a flick. */
  const look = { az: 0, el: 0, taz: 0, tel: 0, vaz: 0, vel: 0, hx: 0, hy: 0, thx: 0, thy: 0, baseEl: 30, used: false };
  const EL_MIN = 1.5, EL_MAX = 89.5;
  // fades the visitor's angle out before the photo, so the last view still lines up with it
  const lookWeight = (p) => 1 - smooth(0.78, 0.845, p);
  const heightFor = (k) => (k.cover ? Math.min(k.fit[1], k.fit[0] / aspect) : Math.max(k.fit[1], k.fit[0] / aspect));
  const tgt = new THREE.Vector3();
  function placeCamera(p) {
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1].p) i++;
    const a = K[i], b = K[i + 1];
    const t = ease(map(p, a.p, b.p));
    const w = lookWeight(p);
    look.baseEl = lerp(a.el, b.el, t);
    const azDeg = lerp(a.az, b.az, t) + (look.az + look.hx * 6) * w;
    const elDeg = clamp(look.baseEl + (look.el - look.hy * 3) * w, EL_MIN, EL_MAX);
    look.azNow = (((azDeg % 360) + 540) % 360) - 180;
    look.elNow = elDeg;
    const az = THREE.MathUtils.degToRad(azDeg);
    const el = THREE.MathUtils.degToRad(elDeg);
    const fov = lerp(a.fov, b.fov, t);
    const h = lerp(heightFor(a), heightFor(b), t);
    tgt.set(lerp(a.t[0], b.t[0], t), lerp(a.t[1], b.t[1], t), lerp(a.t[2], b.t[2], t));
    const dist = h / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.fov = fov;
    camera.aspect = aspect;
    camera.position.set(tgt.x + dist * Math.sin(az) * Math.cos(el), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(az) * Math.cos(el));
    camera.near = Math.max(0.5, dist - 60);
    camera.far = dist + 80;
    camera.lookAt(tgt);
    camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------
     Size
     --------------------------------------------------------- */
  let W = 1, H = 1;
  function resize() {
    const r = view.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    aspect = W / H;
    K = keys();
    labels.forEach((l) => { if (l.note) { l.note.tw = 0; l.note.side = 0; } });
    [lineMat, scanMat].forEach((m) => {
      m.uniforms.uRes.value.set(W * dpr, H * dpr);
      m.uniforms.uPx.value = dpr * clamp(W / 1000, 0.8, 1.25);
    });
    dirty = true;
  }

  /* ---------------------------------------------------------
     Choreography: p = 0 … 1 across the pinned scroll
     --------------------------------------------------------- */
  const STAGES = [
    { name: 'Ground floor plan', until: 0.28 },
    { name: 'Structural frame', until: 0.52 },
    { name: '3D model', until: 0.8 },
    { name: 'Completed home', until: 2 },
  ];
  const STAGE_P = [0.25, 0.5, 0.76, 0.98];
  let stage = -1;
  const v = new THREE.Vector3();
  const uA = lineMat.uniforms.uA.value;

  function apply(p) {
    placeCamera(p);

    // seen from the side or back, the neighbours' blocks would hide the house: fade them to outlines
    const nb = 1 - smooth(45, 80, Math.abs(look.azNow)) * (1 - smooth(55, 75, look.elNow));
    solidMats.n.opacity = nb;
    solidMats.n.depthWrite = nb > 0.98;
    nbFront.visible = nb > 0.01;
    nbBack.visible = nb > 0.98;

    // 01 plan
    lineMat.uniforms.uDraw.value = map(p, 0.02, 0.23);
    const planFade = 1 - smooth(0.34, 0.45, p);
    uA[C.PLAN] = planFade; uA[C.PLAN_LIGHT] = planFade; uA[C.DIM] = planFade;
    pocheMat.opacity = smooth(0.16, 0.23, p) * (1 - smooth(0.3, 0.38, p)) * 0.92;
    poche.visible = pocheMat.opacity > 0.002;

    // 02 frame rises
    const build = lerp(-0.05, 16.2, ease(map(p, 0.3, 0.5)));
    lineMat.uniforms.uBuild.value = build;
    scan.position.y = Math.max(0, build);
    const scanA = smooth(0.3, 0.32, p) * (1 - smooth(0.48, 0.51, p));
    scanMat.uniforms.uA.value[C.SCAN] = scanA;
    scanFill.material.opacity = scanA * 0.06;
    scan.visible = scanA > 0.002;

    // 03 model fills in, then takes on materials
    clip.constant = lerp(-0.5, 16.6, ease(map(p, 0.5, 0.63)));
    groundMat.opacity = smooth(0.53, 0.64, p) * 0.2;
    const mat = smooth(0.63, 0.75, p);
    Object.values(solidMats).forEach((m) => m.color.lerpColors(CLAY, m.userData.real, mat));
    glassMat.color.lerpColors(GLASS_CLAY, GLASS_REAL, mat);
    glassMat.opacity = smooth(0.5, 0.6, p) * lerp(0.55, 0.75, mat);
    uA[C.EDGE] = 1 - 0.6 * mat;
    uA[C.DETAIL] = 1 - 0.25 * mat;
    uA[C.CONTEXT] = 0.9 - 0.45 * smooth(0.55, 0.7, p);
    uA[C.RULING] = smooth(0.33, 0.42, p) * (1 - smooth(0.58, 0.66, p));

    // 04 the photograph wipes in
    const wipe = ease(map(p, 0.85, 0.95));
    sheet.style.setProperty('--wipe', wipe.toFixed(4));
    sheet.classList.toggle('is-wiping', wipe > 0.001 && wipe < 0.999);
    sheet.classList.toggle('is-real', wipe >= 0.999);

    // labels
    const planA = smooth(0.12, 0.2, p) * (1 - smooth(0.28, 0.33, p));
    const noteA = smooth(0.66, 0.71, p) * (1 - smooth(0.79, 0.83, p));
    labels.forEach((l) => {
      const a = l.group === 'plan' ? planA : noteA;
      if (a < 0.01) { if (l.on) { l.el.style.opacity = 0; l.on = false; } return; }
      v.copy(l.pos).project(camera);
      const x = ((v.x + 1) / 2) * W;
      if (l.note) placeNote(l.note, x);
      l.el.style.transform = `translate3d(${x}px, ${((1 - v.y) / 2) * H}px, 0)`;
      l.el.style.opacity = a.toFixed(3);
      l.on = true;
    });

    // steps + title block
    const s = STAGES.findIndex((st) => p < st.until);
    if (s !== stage) {
      stage = s;
      steps.forEach((el, i) => el.classList.toggle('is-active', i === s));
      drawingEl.textContent = STAGES[s].name;
      if (captionEl) captionEl.innerHTML = steps[s].querySelector('p').innerHTML;
    }
    stepsEl.style.setProperty('--p', clamp(p / 0.95).toFixed(4));

    // look-around affordances
    sheet.classList.toggle('can-look', p < 0.84);
    sheet.classList.toggle('show-hint', p > 0.3 && p < 0.8 && !look.used);
    sheet.classList.toggle('show-reset', p < 0.8 && (Math.abs(look.taz) > 2 || Math.abs(look.tel) > 2));
  }

  /* ---------------------------------------------------------
     Loop: ease towards the scroll position, render only when needed
     --------------------------------------------------------- */
  let target = reduceMotion ? STAGE_P[3] : 0;
  let current = target;
  let dirty = true;
  let running = false;
  let last = 0;
  const readScroll = () => {
    if (reduceMotion) return;
    const r = track.getBoundingClientRect();
    const span = r.height - innerHeight;
    target = span > 0 ? clamp(-r.top / span) : 0;
  };
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const k = 1 - Math.exp(-dt * 7);
    if (Math.abs(target - current) > 0.0002) { current += (target - current) * k; dirty = true; }
    else if (current !== target) { current = target; dirty = true; }
    // a flick keeps turning for a moment, then everything eases to its target angle
    if (!drag && (Math.abs(look.vaz) > 0.01 || Math.abs(look.vel) > 0.01)) {
      turn(look.vaz * dt * 60, look.vel * dt * 60);
      const f = Math.exp(-dt * 4.5);
      look.vaz *= f; look.vel *= f;
    }
    const kd = 1 - Math.exp(-dt * 12);
    const kh = 1 - Math.exp(-dt * 4);
    [['az', 'taz', kd], ['el', 'tel', kd], ['hx', 'thx', kh], ['hy', 'thy', kh]].forEach(([c, t, kk]) => {
      const d = look[t] - look[c];
      if (d === 0) return;
      look[c] = Math.abs(d) < 0.001 ? look[t] : look[c] + d * kk;
      dirty = true;
    });
    if (dirty) {
      apply(current);
      renderer.render(scene, camera);
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  const start = () => { if (!running) { running = true; last = 0; requestAnimationFrame(frame); } };
  const stop = () => { running = false; };

  new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? start() : stop()));
  }, { rootMargin: '25% 0px' }).observe(track);
  addEventListener('scroll', readScroll, { passive: true });
  new ResizeObserver(() => { resize(); readScroll(); }).observe(view);

  /* ---------------------------------------------------------
     Look around: drag (sideways swipe on touch, arrow keys when focused) to turn the model
     --------------------------------------------------------- */
  const canLook = () => current < 0.84;
  const hoverTilt = !reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!matchMedia('(hover: hover)').matches) $('[data-idea-hint-text]').textContent = 'Swipe sideways to rotate';
  let drag = null;
  function turn(daz, del) {
    look.taz += daz;
    // keep the angle in -180…180 (shifting the eased value with it) so a reset takes the short way home
    if (look.taz > 180 || look.taz < -180) { const wrap = Math.sign(look.taz) * 360; look.taz -= wrap; look.az -= wrap; }
    look.tel = clamp(look.tel + del, EL_MIN - look.baseEl, EL_MAX - look.baseEl);
    dirty = true;
  }
  const used = () => { if (!look.used) { look.used = true; dirty = true; } };
  view.addEventListener('pointerdown', (e) => {
    if (!canLook() || e.button > 0 || e.target.closest('button')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    look.vaz = look.vel = 0;
    view.setPointerCapture(e.pointerId);
    sheet.classList.add('is-grabbing');
  });
  view.addEventListener('pointermove', (e) => {
    if (hoverTilt && e.pointerType === 'mouse' && canLook()) {
      const r = view.getBoundingClientRect();
      look.thx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      look.thy = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      start();
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.t = performance.now();
    look.vaz = -dx * 0.4; look.vel = dy * 0.28;
    turn(look.vaz, look.vel);
    if (dx || dy) used();
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (reduceMotion || performance.now() - drag.t > 80) look.vaz = look.vel = 0;   // released after a pause: no spin
    drag = null;
    sheet.classList.remove('is-grabbing');
  };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('pointerleave', () => { look.thx = look.thy = 0; });
  view.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] }[e.key];
    if (!step || !canLook()) return;
    e.preventDefault();
    turn(...step); used(); start();
  });
  $('[data-idea-reset]').addEventListener('click', () => {
    look.taz = look.tel = look.vaz = look.vel = 0;
    dirty = true;
    view.focus({ preventScroll: true });
  });

  // step buttons jump to their part of the story
  steps.forEach((el, i) => {
    el.querySelector('button').addEventListener('click', () => {
      if (reduceMotion) { target = current = STAGE_P[i]; dirty = true; start(); return; }
      const r = track.getBoundingClientRect();
      const top = scrollY + r.top + STAGE_P[i] * (r.height - innerHeight);
      scrollTo({ top, behavior: 'smooth' });
    });
  });

  resize();
  readScroll();
  current = target;
  apply(current);
  renderer.render(scene, camera);
  section.classList.add('idea--ready');
}

window.GSAIdea = { initIdea };
})();
