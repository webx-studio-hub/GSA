/* GS Associates — "Idea to creation"
   An arched villa is drawn as a ground floor plan, raised as a structural frame, threaded with its
   MEP services (electrical, plumbing, air-conditioning), filled in as an architectural model and
   finally handed over to the render, all driven by scroll.

   Model units are metres. The render (assets/img/projects/villa-model.webp, 1280 × 720 px) was taken
   by a level camera with a shifted lens: eye 5.85 m up, 20 m in front of the boundary wall, with the
   house face 12.4 m behind the wall. FX/FY turn render pixels into metres on the house face, WX/WY on
   the boundary wall, so the last camera position lines the model up with the picture before it wipes
   in. Depths and the plan are our own.

   A plain script (not a module) so the page also works when index.html is opened straight from disk.
   Needs js/vendor/three.idea.min.js loaded first; main.js loads both and calls GSAIdea.initIdea(). */
(() => {
const { THREE } = window;

const IMG_W = 1280, IMG_H = 720;
const F_PX = 1266;                 // focal length in render pixels
const HC = 5.85;                   // camera height
const YH = 250;                    // horizon line in the render (the lens is shifted up)
const CAM_Z = 20;                  // camera distance in front of the boundary wall (z = 0)
const S = 12.4;                    // house face at z = -S
const sAt = (z) => (CAM_Z - z) / F_PX;
const FX = (px) => (px - IMG_W / 2) * sAt(-S);
const FY = (py) => HC - (py - YH) * sAt(-S);
const WX = (px) => (px - IMG_W / 2) * sAt(0);
const WY = (py) => HC - (py - YH) * sAt(0);
const IMG_FOV = 2 * Math.atan(IMG_H / 2 / F_PX);       // radians, full image height
const IMG_SHIFT = 1 - (2 * YH) / IMG_H;                 // horizon height in NDC

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const map = (v, a, b) => clamp((v - a) / (b - a));
const smooth = (a, b, v) => { const t = map(v, a, b); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------------------------------------------------------
   Line categories: colour, base width (css px)
   --------------------------------------------------------- */
const C = { PLAN: 0, PLAN_LIGHT: 1, EDGE: 2, DETAIL: 3, CONTEXT: 4, RULING: 5, SCAN: 6, DIM: 7, ELEC: 8, PLUMB: 9, HVAC: 10 };
const NCAT = 11;
const CAT_COLOR = ['#111214', '#9b9ea4', '#111214', '#2b2d31', '#a7a9ae', '#7c7f85', '#f7a512', '#2b2d31', '#e8930c', '#1f78d1', '#14a37f'];
const CAT_WIDTH = [1.6, 1, 1.35, 0.85, 1, 0.8, 2, 1, 1.9, 2.1, 2.4];
const MODE = { PEN: 0, BUILD: 1, FREE: 2, MEP: 3 };

/* Thick, anti-aliased lines drawn as screen-space quads. Plan lines are "inked" by uDraw; building
   lines are cut off at uBuild so the frame rises floor by floor; MEP runs are drawn in by uMep. */
const lineVert = /* glsl */ `
  uniform vec2 uRes;
  uniform float uPx;
  uniform float uDraw;
  uniform float uBuild;
  uniform float uMep;
  uniform float uA[11];
  uniform vec3 uC[11];
  uniform float uW[11];
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
    if (iInfo.y < .5 || iInfo.y > 2.5) {
      float k = clamp(((iInfo.y < .5 ? uDraw : uMep) - iT.x) / iT.y, 0., 1.);
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
  makeSolid('w', '#ecdcbc');   // cream render
  makeSolid('c', '#f4e8d2');   // stone trims, cornices, columns
  makeSolid('r', '#7b4632');   // clay tile roofs
  makeSolid('p', '#5e3b26');   // timber: pergola, eaves
  makeSolid('t', '#6b4430');   // timber gates and the front door
  makeSolid('d', '#2a2a2b');   // dark window frames
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
      uMep: { value: 0 },
      uA: { value: new Array(NCAT).fill(1) },
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

  /* a wall with window, door and arch openings, extruded back from its street face at z.
     Glazed openings get a glass pane and frame lines, doors a timber leaf. Openings crossing 1 m
     above the floor are left out of the ground floor plan, like a real cut. */
  const openingPts = (o, n = 14) => {
    if (!o.arch) return [[o.x0, o.y0], [o.x1, o.y0], [o.x1, o.y1], [o.x0, o.y1]];
    const r = (o.x1 - o.x0) / 2, cx = (o.x0 + o.x1) / 2, ys = o.y1 - r;
    const pts = [[o.x0, o.y0], [o.x1, o.y0]];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; pts.push([cx + r * Math.cos(a), ys + r * Math.sin(a)]); }
    return pts;
  };
  const shapeFrom = (pts, Ctor = THREE.Shape) => {
    const s = new Ctor();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  const facade = ({ x0, x1, y0, y1, z, t = 0.3, mat = 'w', holes = [], inPlan = true }) => {
    const shape = shapeFrom([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
    holes.forEach((o) => shape.holes.push(shapeFrom(openingPts(o), THREE.Path)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, z - t);
    pushTris(solids[mat] ||= { pos: [], nor: [] }, geo);
    const P3 = (zz) => (q) => [q[0], q[1], zz];
    lines.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(P3(z)), C.EDGE, MODE.BUILD, 1, true);
    lines.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(P3(z - t)), C.EDGE, MODE.BUILD, 1, true);
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach((q) => lines.add([q[0], q[1], z], [q[0], q[1], z - t], C.EDGE));
    holes.forEach((o) => {
      const pts = openingPts(o);
      lines.poly(pts.map(P3(z + 0.002)), C.DETAIL, MODE.BUILD, 1, true);
      const zi = z - t * 0.55;
      if (o.glazed) {
        pushTris(glassBuf, new THREE.ShapeGeometry(shapeFrom(pts)).translate(0, 0, zi));
        lines.poly(pts.map(P3(zi)), C.DETAIL, MODE.BUILD, 1.1, true);
        const cx = (o.x0 + o.x1) / 2;
        const top = o.arch ? o.y1 : o.y1;
        lines.add([cx, o.y0, zi + 0.01], [cx, top, zi + 0.01], C.DETAIL);
        if (o.arch) { const ys = o.y1 - (o.x1 - o.x0) / 2; lines.add([o.x0, ys, zi + 0.01], [o.x1, ys, zi + 0.01], C.DETAIL); }
        else if (o.y1 - o.y0 > 1.6) { const ym = o.y0 + (o.y1 - o.y0) * 0.72; lines.add([o.x0, ym, zi + 0.01], [o.x1, ym, zi + 0.01], C.DETAIL); }
      }
      if (o.door) {
        const dg = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: 0.07, bevelEnabled: false, curveSegments: 16 }).translate(0, 0, zi - 0.035);
        pushTris(solids.t ||= { pos: [], nor: [] }, dg);
        const cx = (o.x0 + o.x1) / 2;
        lines.add([cx, o.y0, zi + 0.04], [cx, o.y1, zi + 0.04], C.DETAIL);
      }
    });
    if (inPlan && y0 <= 1 && y1 >= 1) {
      const cuts = holes.filter((o) => o.y0 <= 1 && o.y1 >= 1).map((o) => [o.x0, o.x1]).sort((a, b) => a[0] - b[0]);
      let xa = x0;
      cuts.forEach(([c0, c1]) => { if (c0 > xa + 0.01) plan.push([xa, c0, z - t, z]); xa = Math.max(xa, c1); });
      if (x1 > xa + 0.01) plan.push([xa, x1, z - t, z]);
    }
  };
  /* hipped roof over a rectangle, eaves at ye, ridge at yr */
  const hipRoof = (xa, xb, za, zb, ye, yr, mat = 'r', cat = C.EDGE) => {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const a = [x0, ye, z0], b = [x1, ye, z0], c = [x1, ye, z1], e = [x0, ye, z1];
    let r1, r2;
    if (w >= d) { r1 = [x0 + d / 2, yr, cz]; r2 = [x1 - d / 2, yr, cz]; } else { r1 = [cx, yr, z0 + w / 2]; r2 = [cx, yr, z1 - w / 2]; }
    const tris = w >= d
      ? [[a, b, r2], [a, r2, r1], [b, c, r2], [c, e, r1], [c, r1, r2], [e, a, r1]]
      : [[a, b, r1], [b, c, r2], [b, r2, r1], [c, e, r2], [e, a, r1], [e, r1, r2]];
    const pos = [];
    tris.forEach(([p, q, s]) => {
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [s[0] - p[0], s[1] - p[1], s[2] - p[2]];
      const ny = u[2] * v[0] - u[0] * v[2];
      pos.push(...(ny >= 0 ? [...p, ...q, ...s] : [...p, ...s, ...q]));
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    pushTris(solids[mat] ||= { pos: [], nor: [] }, geo);
    lines.poly([a, b, c, e], cat, MODE.BUILD, 1, true);
    lines.add(r1, r2, cat);
    [[a, w >= d ? r1 : r1], [b, w >= d ? r2 : r1], [c, r2], [e, w >= d ? r1 : r2]].forEach(([p, q]) => lines.add(p, q, cat));
    // a timber fascia under the eaves
    if (mat === 'r') {
      box(x0, x1, ye - 0.28, ye, z0, z0 + 0.12, 'p', { cat: C.DETAIL });
      box(x0, x1, ye - 0.28, ye, z1 - 0.12, z1, 'p', { cat: C.DETAIL, edges: false });
      box(x0, x0 + 0.12, ye - 0.28, ye, z1, z0, 'p', { cat: C.DETAIL, edges: false });
      box(x1 - 0.12, x1, ye - 0.28, ye, z1, z0, 'p', { cat: C.DETAIL, edges: false });
    }
  };
  /* round column with a square base and capital */
  const column = (x, z, y0, y1, r = 0.22) => {
    pushTris(solids.c ||= { pos: [], nor: [] }, new THREE.CylinderGeometry(r, r, y1 - y0, 20).translate(x, (y0 + y1) / 2, z));
    box(x - r - 0.06, x + r + 0.06, y0, y0 + 0.22, z - r - 0.06, z + r + 0.06, 'c', { cat: C.DETAIL });
    box(x - r - 0.06, x + r + 0.06, y1 - 0.2, y1, z - r - 0.06, z + r + 0.06, 'c', { cat: C.DETAIL });
    [-1, 1].forEach((s) => lines.add([x + s * r, y0, z], [x + s * r, y1, z], C.EDGE));
  };

  /* ---------------------------------------------------------
     The villa
     --------------------------------------------------------- */
  const ZF = -S, ZBL = -S - 10, ZBR = -S - 12, WT = 0.3;
  const XL = FX(40), XC0 = FX(490), XC1 = FX(710), XR0 = FX(780), XR = FX(1005);
  const GF_L = FY(315), BAND = FY(282), UP_L = FY(212), ZU = ZF - 2.2;
  const TOP_C = FY(168), TOP_R = FY(180);

  // left wing: three tall arches on the ground floor, a recessed upper floor behind a pergola
  facade({
    x0: XL, x1: XC0, y0: 0, y1: GF_L, z: ZF,
    holes: [[85, 180], [222, 315], [355, 450]].map(([a, b]) => ({ x0: FX(a), x1: FX(b), y0: 0, y1: FY(340), arch: true, glazed: true })),
  });
  box(XL - 0.06, XC0, GF_L, BAND, ZF - WT, ZF + 0.16, 'c');
  box(XL, XL + WT, 0, BAND, ZBL, ZF - WT, 'w', { inPlan: true });
  box(XL, XC0 - WT, 0, BAND, ZBL, ZBL + WT, 'w', { inPlan: true });
  box(XL + WT, XC0 - WT, GF_L, BAND - 0.02, ZBL + WT, ZF - WT, 'c', { edges: false });
  facade({
    x0: XL + 0.2, x1: XC0 - WT, y0: BAND, y1: UP_L, z: ZU, t: 0.25, inPlan: false,
    holes: [[140, 195], [258, 320], [380, 440]].map(([a, b]) => ({ x0: FX(a), x1: FX(b), y0: BAND, y1: FY(232), glazed: true })),
  });
  box(XL + 0.2, XL + 0.45, BAND, UP_L, ZBL, ZU - 0.25, 'w');
  box(XL + 0.2, XC0 - WT, BAND, UP_L, ZBL, ZBL + 0.25, 'w');
  box(XL + 0.1, XC0 - WT, UP_L, UP_L + 0.2, ZBL - 0.1, ZU + 0.12, 'c');
  [[140, 195], [258, 320], [380, 440]].forEach(([a, b]) => railing(FX(a), FX(b), ZU + 0.12, BAND, FY(262)));
  const PERG = FY(192);
  [80, 205, 333, 455].forEach((px) => column(FX(px), ZF - 0.35, BAND, PERG));
  box(FX(45), FX(470), PERG, PERG + 0.22, ZF - 0.5, ZF - 0.2, 'p');
  box(FX(45), FX(470), PERG, PERG + 0.22, ZU + 0.05, ZU + 0.35, 'p');
  for (let x = FX(50); x < FX(466); x += 0.6) box(x, x + 0.1, PERG + 0.22, PERG + 0.42, ZU, ZF - 0.05, 'p', { cat: C.DETAIL });

  // central block, the link and the right wing
  facade({
    x0: XC0, x1: XC1, y0: 0, y1: TOP_C, z: ZF,
    holes: [
      { x0: FX(547), x1: FX(640), y0: FY(470), y1: FY(368), arch: true, glazed: true },
      { x0: FX(568), x1: FX(636), y0: FY(290), y1: FY(195), arch: true, glazed: true },
    ],
  });
  facade({
    x0: XC1, x1: XR, y0: 0, y1: TOP_R, z: ZF,
    holes: [
      { x0: FX(725), x1: FX(800), y0: 0, y1: FY(333), arch: true, door: true },
      { x0: FX(720), x1: FX(778), y0: FY(243), y1: FY(220), glazed: true },
      { x0: FX(866), x1: FX(958), y0: FY(470), y1: FY(370), arch: true, glazed: true },
      { x0: FX(872), x1: FX(937), y0: FY(297), y1: FY(205), arch: true, glazed: true },
    ],
  });
  box(XC0, XR, FY(328), FY(320), ZF - 0.02, ZF + 0.12, 'c');                // belt course
  // the entrance portico, standing proud of the wall
  facade({ x0: FX(668), x1: FX(855), y0: 0, y1: FY(268), z: ZF + 0.6, t: 0.6, inPlan: true,
    holes: [{ x0: FX(718), x1: FX(807), y0: 0, y1: FY(326), arch: true }] });
  box(FX(660), FX(863), FY(268), FY(256), ZF, ZF + 0.72, 'c');
  {
    const mx = FX(765), my = FY(312);
    pushTris(solids.c ||= { pos: [], nor: [] }, new THREE.CylinderGeometry(0.32, 0.32, 0.1, 24).rotateX(Math.PI / 2).translate(mx, my, ZF + 0.65));
    const ring = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push([mx + 0.32 * Math.cos(a), my + 0.32 * Math.sin(a), ZF + 0.71]); }
    lines.poly(ring, C.DETAIL);
  }
  box(XR - WT, XR, 0, TOP_R, ZBR, ZF - WT, 'w', { inPlan: true });
  box(XC0 - WT, XR - WT, 0, TOP_R, ZBR, ZBR + WT, 'w', { inPlan: true });
  box(XC0 - WT, XC0, 0, TOP_C, ZBR + WT, ZBL, 'w', { inPlan: true });
  box(XC0 - WT, XC0, BAND, TOP_C, ZBL, ZF - WT, 'w');
  box(XC0 - WT, XC0, 0, BAND, ZF - 5.2, ZF - WT, 'w', { inPlan: true });
  box(XC0 - WT, XC0, 0, BAND, ZBL, ZF - 6.2, 'w', { inPlan: true });
  box(XC0, XR - WT, FY(320) - 0.2, FY(320), ZBR + WT, ZF - WT, 'c', { edges: false });  // first floor slab
  box(XC0 - WT, XC1, TOP_C - 0.2, TOP_C, ZBR, ZF, 'c');
  box(XC1, XR, TOP_R - 0.2, TOP_R, ZBR, ZF, 'c');
  // ground floor rooms: stair hall and kitchen
  box(XC0, XC1 - 1.3, 0, FY(320) - 0.2, ZF - 7.2, ZF - 7, 'w', { inPlan: true });
  box(XC1, XC1 + 0.2, 0, FY(320) - 0.2, ZBR + WT, ZF - 7, 'w', { inPlan: true });
  box(XR0, 5.0, 0, FY(320) - 0.2, ZF - 7.2, ZF - 7, 'w', { inPlan: true });
  box(6.0, XR - WT, 0, FY(320) - 0.2, ZF - 7.2, ZF - 7, 'w', { inPlan: true });

  // roofs
  hipRoof(FX(462), FX(735), ZF + 0.6, ZBR - 0.6, TOP_C + 0.1, FY(118));
  hipRoof(FX(805), FX(1040), ZF + 0.6, ZBR - 0.6, TOP_R + 0.05, FY(132));
  hipRoof(FX(728), FX(812), ZF + 0.3, ZBR - 0.3, TOP_R, FY(160));

  // structural frame: columns on a grid, inside the walls
  const GRID_X = [XL + 0.3, -11.3, -7.6, XC0 - 0.15, XC1, 5.6, XR - 0.15];
  GRID_X.forEach((x) => {
    const left = x < XC0 - 0.2;
    const zs = left ? [ZF - 0.15, ZF - 5, ZBL + 0.15] : [ZF - 0.15, ZF - 5, ZF - 9, ZBR + 0.15];
    zs.forEach((z, i) => {
      const h = left ? (i === 0 ? GF_L : UP_L) : TOP_R;
      box(x - 0.2, x + 0.2, 0, h, z - 0.2, z + 0.2, 'c', { inPlan: true });
    });
  });

  /* ---------------------------------------------------------
     Boundary wall, gates and the house next door
     --------------------------------------------------------- */
  const WALL_H = WY(485), PIER_H = WY(473);
  const piers = [[-17.2, -16.5], [-12.6, -11.9], [WX(155), WX(200)], [WX(490), WX(528)], [WX(725), WX(768)], [WX(868), WX(908)], [WX(958), WX(1000)], [WX(1200), WX(1245)], [13.4, 14.1]];
  const gates = [[WX(908), WX(958)], [WX(1000), WX(1200)]];
  piers.forEach(([a, b], i) => {
    box(a, b, 0, PIER_H, -0.45, 0.2, 'c', { inPlan: true });
    box(a - 0.06, b + 0.06, PIER_H, PIER_H + 0.12, -0.51, 0.26, 'c', { cat: C.DETAIL });
    const next = piers[i + 1];
    if (!next) return;
    const gate = gates.find(([g0]) => Math.abs(g0 - b) < 0.05);
    if (gate) {
      box(gate[0], gate[1], 0.06, WY(490), -0.16, -0.1, 't', { cat: C.DETAIL });
      for (let x = gate[0] + 0.16; x < gate[1] - 0.05; x += 0.16) lines.add([x, 0.08, -0.095], [x, WY(490) - 0.04, -0.095], C.DETAIL, MODE.BUILD, 0.8);
    } else {
      box(b, next[0], 0, WALL_H, -0.3, 0, 'w', { inPlan: true });
      box(b, next[0], WALL_H, WALL_H + 0.08, -0.34, 0.04, 'c', { cat: C.DETAIL, edges: false });
    }
  });

  const nb = (x0, x1, y0, y1, z0, z1) => box(x0, x1, y0, y1, z0, z1, 'n', { cat: C.CONTEXT });
  nb(10.8, 16.8, 0, 3.0, ZF - 7, ZF + 2.5);
  hipRoof(10.6, 17.0, ZF + 2.7, ZF - 7.2, 3.0, 4.2, 'n', C.CONTEXT);
  lines.poly([[11.6, 0, ZF + 2.51], [12.4, 0, ZF + 2.51], [12.4, 2.2, ZF + 2.51], [11.6, 2.2, ZF + 2.51]], C.CONTEXT, MODE.BUILD, 1, true);
  lines.poly([[13.4, 1.0, ZF + 2.51], [14.4, 1.0, ZF + 2.51], [14.4, 2.3, ZF + 2.51], [13.4, 2.3, ZF + 2.51]], C.CONTEXT, MODE.BUILD, 1, true);

  /* ---------------------------------------------------------
     MEP: electrical, plumbing and air-conditioning runs, drawn in during step 03
     --------------------------------------------------------- */
  const M = MODE.MEP;
  const run = (cat, pts, w = 1) => lines.poly(pts, cat, M, w);
  const elec = [], plumb = [], hvac = [];
  {
    const zt = ZF - 1.2, y0 = 3.75, y1 = 7.2, yl = 6.55;
    elec.push(...lines.poly([[2.3, 1.1, ZF - 0.62], [2.9, 1.1, ZF - 0.62], [2.9, 1.9, ZF - 0.62], [2.3, 1.9, ZF - 0.62]], C.ELEC, M, 1, true));
    elec.push(...run(C.ELEC, [[2.6, 1.9, ZF - 0.62], [2.6, y0, ZF - 0.62], [2.6, y0, zt]]));
    elec.push(...run(C.ELEC, [[XL + 0.7, y0, zt], [XR - 0.7, y0, zt]]));
    [-13.5, -10, -6.4, -2.4, 0.6, 4.6, 7.9].forEach((x) => elec.push(...run(C.ELEC, [[x, y0, zt], [x, y0, (x < XC0 ? ZBL : ZBR) + 0.7]])));
    [[-13.5, ZBL + 0.45], [4.6, ZBR + 0.45], [7.9, ZF - 6.75], [-6.4, ZBL + 0.45]].forEach(([x, z]) => elec.push(...run(C.ELEC, [[x, y0, z], [x, 1.25, z]], 0.8)));
    elec.push(...run(C.ELEC, [[2.6, y0, ZF - 0.62], [2.6, y1, ZF - 0.62], [2.6, y1, zt]]));
    elec.push(...run(C.ELEC, [[XC0 + 0.4, y1, zt], [XR - 0.7, y1, zt]]));
    [-1.6, 2.6, 6.6].forEach((x) => elec.push(...run(C.ELEC, [[x, y1, zt], [x, y1, ZBR + 0.7]])));
    elec.push(...run(C.ELEC, [[XC0 + 0.4, y1, zt], [XC0 - 0.5, yl, ZU - 0.8], [XL + 0.8, yl, ZU - 0.8]]));
    [-12.2, -8.4].forEach((x) => elec.push(...run(C.ELEC, [[x, yl, ZU - 0.8], [x, yl, ZBL + 0.7]])));
  }
  {
    const yd = -0.55, zc = ZF + 1.4;
    const stacks = [[8.7, ZBR + 0.6], [1.3, ZBR + 0.6], [XL + 0.6, ZBL + 0.6]];
    stacks.forEach(([x, z]) => {
      plumb.push(...run(C.PLUMB, [[x, yd, z], [x, (x > XC0 ? TOP_R : UP_L) + 0.9, z]]));
      plumb.push(...run(C.PLUMB, [[x, yd, z], [x, yd, zc]]));
    });
    plumb.push(...run(C.PLUMB, [[XL + 0.6, yd, zc], [8.7, yd, zc]]));
    plumb.push(...run(C.PLUMB, [[1.3, yd, zc], [1.3, yd, 1.6], [3.2, yd, 1.6]]));
    const tz0 = ZBR + 0.6, tz1 = ZBR + 2.0;
    const tankIds = [];
    const tk = [[6.3, TOP_R, tz0], [8.1, TOP_R, tz0], [8.1, TOP_R, tz1], [6.3, TOP_R, tz1]];
    tankIds.push(...lines.poly(tk, C.PLUMB, M, 1, true));
    tankIds.push(...lines.poly(tk.map(([x, , z]) => [x, TOP_R + 1.0, z]), C.PLUMB, M, 1, true));
    tk.forEach(([x, y, z]) => tankIds.push(lines.add([x, y, z], [x, y + 1.0, z], C.PLUMB, M)));
    plumb.push(...tankIds);
    plumb.push(...run(C.PLUMB, [[7.2, TOP_R, ZBR + 1.3], [7.2, 4.35, ZBR + 1.3], [XC0, 4.35, ZBR + 1.3], [XC0, 4.35, ZBL + 1.3], [XL + 0.6, 4.35, ZBL + 1.3]]));
  }
  {
    const yd = 3.5, zd = ZF - 5.25, yu = 6.75;
    const unit = (x) => {
      const pts = [[x - 0.5, UP_L + 0.2, ZBL + 1.2], [x + 0.5, UP_L + 0.2, ZBL + 1.2], [x + 0.5, UP_L + 0.2, ZBL + 2.0], [x - 0.5, UP_L + 0.2, ZBL + 2.0]];
      hvac.push(...lines.poly(pts, C.HVAC, M, 0.8, true));
      hvac.push(...lines.poly(pts.map(([px, , pz]) => [px, UP_L + 0.8, pz]), C.HVAC, M, 0.8, true));
      pts.forEach(([px, , pz]) => hvac.push(lines.add([px, UP_L + 0.2, pz], [px, UP_L + 0.8, pz], C.HVAC, M, 0.8)));
    };
    unit(-12.7); unit(-8.7);
    hvac.push(...run(C.HVAC, [[-12.7, UP_L + 0.2, ZBL + 1.6], [-12.7, yd, ZBL + 1.6], [-12.7, yd, zd]]));
    hvac.push(...run(C.HVAC, [[XL + 0.8, yd, zd], [8.6, yd, zd]]));
    [-12, -8.4, -4.9, -0.6, 3.0, 6.9].forEach((x) => {
      hvac.push(...run(C.HVAC, [[x, yd, zd], [x, yd, ZF - 3.4]], 0.8));
      hvac.push(...lines.poly([[x - 0.3, yd, ZF - 3.4], [x + 0.3, yd, ZF - 3.4], [x + 0.3, yd, ZF - 2.8], [x - 0.3, yd, ZF - 2.8]], C.HVAC, M, 0.8, true));
    });
    hvac.push(...run(C.HVAC, [[-8.7, UP_L + 0.2, ZBL + 1.6], [-8.7, yu, ZBL + 1.6], [XC0 + 0.3, yu, ZBL + 1.6], [XC0 + 0.3, yu, zd], [8.6, yu, zd]]));
  }
  lines.timeline(elec, 0, 0.55, 5);
  lines.timeline(plumb, 0.25, 0.8, 4);
  lines.timeline(hvac, 0.5, 1, 4);

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
  const rect = (x0, x1, z0, z1, cat = C.PLAN_LIGHT) => penFit.push(...lines.poly([pp(x0, z0), pp(x1, z0), pp(x1, z1), pp(x0, z1)], cat, MODE.PEN, 1, true));
  // the front door (a pair of leaves) and the door into the living room
  const dl = FX(725), dr = FX(800), dw = (dr - dl) / 2;
  penFit.push(lines.add(pp(dl, ZF - WT), pp(dl, ZF - WT - dw), C.PLAN, MODE.PEN));
  penFit.push(...arc(dl, ZF - WT, dw, 0, -Math.PI / 2, C.PLAN_LIGHT));
  penFit.push(lines.add(pp(dr, ZF - WT), pp(dr, ZF - WT - dw), C.PLAN, MODE.PEN));
  penFit.push(...arc(dr, ZF - WT, dw, Math.PI, Math.PI * 1.5, C.PLAN_LIGHT));
  penFit.push(lines.add(pp(XC0 - WT, ZF - 5.2), pp(XC0 - WT - 1, ZF - 5.2), C.PLAN, MODE.PEN));
  penFit.push(...arc(XC0 - WT, ZF - 5.2, 1, Math.PI, Math.PI * 1.5, C.PLAN_LIGHT));
  penFit.push(lines.add(pp(5.0, ZF - 7.2), pp(5.0, ZF - 8.2), C.PLAN, MODE.PEN));
  penFit.push(...arc(5.0, ZF - 7.2, 1, -Math.PI / 2, 0, C.PLAN_LIGHT));
  // stair: two flights and the walking line
  for (let x = XC0 + 0.5; x <= XC1 - 1.6; x += 0.28) {
    penFit.push(lines.add(pp(x, ZF - 7.4), pp(x, ZF - 9.35), C.PLAN_LIGHT, MODE.PEN));
    penFit.push(lines.add(pp(x, ZF - 9.55), pp(x, ZBR + 0.5), C.PLAN_LIGHT, MODE.PEN));
  }
  rect(XC0 + 0.5, XC1 - 1.6, ZF - 9.55, ZF - 9.35, C.PLAN);
  penFit.push(lines.add(pp(XC0 + 0.8, ZF - 8.4), pp(XC1 - 1.9, ZF - 8.4), C.PLAN, MODE.PEN, 0.8));
  penFit.push(lines.add(pp(XC1 - 1.9, ZF - 8.4), pp(XC1 - 2.2, ZF - 8.22), C.PLAN, MODE.PEN, 0.8));
  penFit.push(lines.add(pp(XC1 - 1.9, ZF - 8.4), pp(XC1 - 2.2, ZF - 8.58), C.PLAN, MODE.PEN, 0.8));
  // kitchen counter and sink
  penFit.push(...lines.poly([pp(XC1 + 0.2, ZBR + 0.95), pp(XR - 0.95, ZBR + 0.95), pp(XR - 0.95, ZF - 7.4)], C.PLAN_LIGHT, MODE.PEN, 1));
  rect(6.2, 7.0, ZBR + 0.4, ZBR + 0.85);
  // living: sofas, rug and a round table
  rect(-12.6, -8.6, ZBL + 0.75, ZBL + 1.55);
  rect(-13.9, -13.1, ZF - 7.6, ZF - 3.8);
  rect(-12.2, -9.0, ZF - 7.4, ZF - 3.9);
  penFit.push(...arc(-10.6, ZF - 5.65, 0.6, 0, Math.PI * 2, C.PLAN_LIGHT, 24));
  // dining table
  rect(5.9, 8.3, ZF - 4.4, ZF - 2.4);
  // a car on the drive and trees in the garden
  const car = (x0, x1, z0, z1) => {
    const c = 0.35;
    penFit.push(...lines.poly([pp(x0 + c, z0), pp(x1 - c, z0), pp(x1, z0 + c), pp(x1, z1 - c), pp(x1 - c, z1), pp(x0 + c, z1), pp(x0, z1 - c), pp(x0, z0 + c)], C.PLAN_LIGHT, MODE.PEN, 1, true));
    penFit.push(lines.add(pp(x0 + 0.15, z1 + 1.35), pp(x1 - 0.15, z1 + 1.35), C.PLAN_LIGHT, MODE.PEN));
    penFit.push(lines.add(pp(x0 + 0.2, z0 - 1.0), pp(x1 - 0.2, z0 - 1.0), C.PLAN_LIGHT, MODE.PEN));
  };
  car(6.3, 8.2, -1.2, -5.9);
  [[-9.5, -6], [-4.2, -4.2], [0.6, -7.4], [-14.2, -3.4]].forEach(([x, z]) => penFit.push(...arc(x, z, 0.95, 0, Math.PI * 2, C.PLAN_LIGHT, 20)));
  lines.timeline(penFit, 0.38, 0.8, 5);

  // the house next door with hatching, the drive and the road edge
  const penCtx = [];
  const hatch = (x0, x1, z0, z1, gap = 0.7) => {
    penCtx.push(...lines.poly([pp(x0, z0), pp(x1, z0), pp(x1, z1), pp(x0, z1)], C.PLAN_LIGHT, MODE.PEN, 1, true));
    for (let c = x0 - z1 + gap; c < x1 - z0; c += gap) {
      const xa = Math.max(x0, z0 + c); const xb = Math.min(x1, z1 + c);
      if (xb > xa) penCtx.push(lines.add(pp(xa, xa - c), pp(xb, xb - c), C.PLAN_LIGHT, MODE.PEN, 0.7));
    }
  };
  hatch(10.8, 16.8, ZF - 7, ZF + 2.5);
  penCtx.push(lines.add(pp(-18, 2.3), pp(18, 2.3), C.PLAN_LIGHT, MODE.PEN));
  penCtx.push(lines.add(pp(WX(1000), -0.5), pp(WX(1000), ZF + 0.8), C.PLAN_LIGHT, MODE.PEN));
  penCtx.push(lines.add(pp(WX(1200), -0.5), pp(WX(1200), ZF + 0.8), C.PLAN_LIGHT, MODE.PEN));
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
  dim(XL, XR, ZF + 2.0, ZF + 0.3);
  dim(XL, XC0, ZF + 3.4, ZF + 2.3);
  {
    const nx = -15.2, nz = -5.2, r = 0.55;
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
  scanLines.poly([[-17.6, 0, ZBR - 0.8], [17.6, 0, ZBR - 0.8], [17.6, 0, 1.2], [-17.6, 0, 1.2]], C.SCAN, MODE.FREE, 1, true);
  const scanMat = lineMat.clone();
  scanMat.uniforms = THREE.UniformsUtils.clone(lineMat.uniforms);
  const scan = new THREE.Group();
  const scanFill = new THREE.Mesh(
    new THREE.PlaneGeometry(35.2, 1.2 - (ZBR - 0.8)).rotateX(-Math.PI / 2).translate(0, 0, (1.2 + ZBR - 0.8) / 2),
    new THREE.MeshBasicMaterial({ color: '#f7a512', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  scan.add(scanFill, scanLines.mesh(scanMat));
  scan.renderOrder = 4;
  scene.add(scan);

  // light, shadows and a ground that only shows shadows
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfc7bb', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.6);
  sun.position.set(16, 36, 22);
  sun.target.position.set(-2, 4, -14);
  sun.castShadow = true;
  const small = Math.min(innerWidth, innerHeight) < 700;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 });
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
  tag('Living', [-10.6, 0, ZF - 8.6], 'plan');
  tag('Entrance', [3.1, 0, ZF - 2.4], 'plan');
  tag('Dining', [7.1, 0, ZF - 5.4], 'plan');
  tag('Kitchen', [6.4, 0, ZF - 9.8], 'plan');
  tag('Stair', [-1.1, 0, ZF - 6.3], 'plan');
  tag('Garden', [-6.8, 0, -7.6], 'plan');
  tag('Drive', [7.25, 0, -7.2], 'plan');
  tag(`${(XR - XL).toFixed(1)} m`, [(XL + XR) / 2, 0, ZF + 2.0], 'plan', 'sheet__tag sheet__tag--dim');
  tag(`${(XC0 - XL).toFixed(1)} m`, [(XL + XC0) / 2, 0, ZF + 3.4], 'plan', 'sheet__tag sheet__tag--dim');
  tag('N', [-15.2, 0, -6.25], 'plan', 'sheet__tag sheet__tag--n');
  /* callout with a leader line; it swaps sides when the text would run off the sheet */
  const note = (text, pos, dx, dy, group = 'note') => {
    const el = document.createElement('span');
    el.className = 'sheet__note';
    el.innerHTML = `<i class="sheet__note-dot"></i><i class="sheet__note-line"></i><span class="sheet__note-text">${text}</span>`;
    labelLayer.appendChild(el);
    labels.push({ el, pos: new THREE.Vector3(...pos), group, note: { dx, dy, line: el.children[1], text: el.children[2], side: 0, tw: 0 } });
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
  note('Hipped clay-tile roofs', [7.2, FY(150), ZF - 1.5], 56, -34);
  note('Pergola terrace', [FX(205), PERG + 0.2, ZF - 0.35], -58, -30);
  note('Arched doorway', [FX(762), FY(380), ZF + 0.62], 54, 30);
  note('Electrical', [2.6, 1.9, ZF - 0.62], 56, 30, 'mep');
  note('Plumbing', [8.7, 6.2, ZBR + 0.6], 56, -30, 'mep');
  note('Air-conditioning', [-12.7, UP_L + 0.8, ZBL + 1.6], -58, -32, 'mep');

  /* ---------------------------------------------------------
     Camera path
     --------------------------------------------------------- */
  let aspect = 1.5;
  const key = (p, az, el, fov, t, fit, cover = false) => ({ p, az, el, fov, t, fit, cover });
  const keys = () => {
    const wide = aspect >= 1;
    const planAz = wide ? 0 : -90;
    const planFit = wide ? [36, 27] : [31, 38];
    const g = wide ? 1 : 1.18;   // portrait sheets need a little more room around the model
    return [
      key(0, planAz, 89.3, 30, [-1.8, 0, -11.4], planFit.map((v) => v * 1.05)),
      key(0.2, planAz - 6, 89.3, 30, [-1.8, 0, -11.4], planFit),
      key(0.37, -38, 26, 30, [-2.5, 4.4, -16.5], [33 * g, 26]),
      key(0.52, -24, 30, 30, [-2.5, 4.2, -17.5], [30 * g, 25]),
      key(0.7, 28, 11, 26, [-2.5, 4.5, -13], [36 * g * 0.92, 22]),
      key(0.84, 6, 8, 26, [-2.5, 4.5, -12], [34, 21]),
      key(1, 6, 8, 26, [-2.5, 4.5, -12], [34, 21]),
    ];
  };
  let K = keys();
  /* the visitor's own viewing angle (degrees), added to the scroll path: az/el from dragging,
     hx/hy a gentle tilt that follows the mouse. t… are targets, v… the spin left after a flick. */
  const look = { az: 0, el: 0, taz: 0, tel: 0, vaz: 0, vel: 0, hx: 0, hy: 0, thx: 0, thy: 0, baseEl: 30, used: false };
  const EL_MIN = 1.5, EL_MAX = 89.5;
  // fades the visitor's angle out before the photo, so the last view still lines up with it
  const lookWeight = (p) => 1 - smooth(0.76, 0.84, p);
  /* the render's own camera: level, shifted lens, cropped like the photo (object-fit: cover) */
  const photoCam = () => {
    const q = Math.min(1, (IMG_W / IMG_H) / aspect);   // share of the image height that is visible
    return { fov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(IMG_FOV / 2) * q)), shift: IMG_SHIFT / q };
  };
  const photoWeight = (p) => ease(map(p, 0.74, 0.84));
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
    // blend into the render's camera so the model lines up with the picture before it wipes in
    const pw = photoWeight(p);
    const pc = photoCam();
    camera.position.lerp(new THREE.Vector3(0, HC, CAM_Z), pw);
    tgt.lerp(new THREE.Vector3(0, HC, 0), pw);
    camera.fov = lerp(fov, pc.fov, pw);
    const d = camera.position.distanceTo(tgt);
    camera.near = Math.max(0.5, d - 60);
    camera.far = d + 90;
    camera.lookAt(tgt);
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[9] = -pc.shift * pw;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
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
    { name: 'Ground floor plan', until: 0.22 },
    { name: 'Structural frame', until: 0.41 },
    { name: 'MEP services', until: 0.58 },
    { name: '3D model', until: 0.8 },
    { name: 'Completed home', until: 2 },
  ];
  const STAGE_P = [0.18, 0.36, 0.52, 0.72, 0.98];
  let stage = -1;
  const v = new THREE.Vector3();
  const uA = lineMat.uniforms.uA.value;

  function apply(p) {
    placeCamera(p);

    // seen from the side or back, the house next door would hide the villa: fade it to outlines
    const nb = 1 - smooth(45, 80, Math.abs(look.azNow)) * (1 - smooth(55, 75, look.elNow));
    solidMats.n.opacity = nb;
    solidMats.n.depthWrite = nb > 0.98;
    nbFront.visible = nb > 0.01;
    nbBack.visible = nb > 0.98;

    // 01 plan
    lineMat.uniforms.uDraw.value = map(p, 0.02, 0.18);
    const planFade = 1 - smooth(0.26, 0.34, p);
    uA[C.PLAN] = planFade; uA[C.PLAN_LIGHT] = planFade; uA[C.DIM] = planFade;
    pocheMat.opacity = smooth(0.13, 0.18, p) * (1 - smooth(0.23, 0.29, p)) * 0.92;
    poche.visible = pocheMat.opacity > 0.002;

    // 02 frame rises
    const build = lerp(-0.05, 9.6, ease(map(p, 0.24, 0.39)));
    lineMat.uniforms.uBuild.value = build;
    scan.position.y = Math.max(0, build);
    const scanA = smooth(0.24, 0.26, p) * (1 - smooth(0.38, 0.41, p));
    scanMat.uniforms.uA.value[C.SCAN] = scanA;
    scanFill.material.opacity = scanA * 0.06;
    scan.visible = scanA > 0.002;

    // 03 MEP services are drawn into the frame, which steps back while they show
    lineMat.uniforms.uMep.value = map(p, 0.42, 0.55);
    const mepA = smooth(0.41, 0.43, p) * (1 - smooth(0.6, 0.66, p));
    uA[C.ELEC] = mepA; uA[C.PLUMB] = mepA; uA[C.HVAC] = mepA;
    const mepFocus = smooth(0.41, 0.45, p) * (1 - smooth(0.56, 0.6, p));

    // 04 model fills in, then takes on materials
    clip.constant = lerp(-0.5, 9.8, ease(map(p, 0.58, 0.68)));
    groundMat.opacity = smooth(0.6, 0.68, p) * 0.2;
    const mat = smooth(0.67, 0.76, p);
    Object.values(solidMats).forEach((m) => m.color.lerpColors(CLAY, m.userData.real, mat));
    glassMat.color.lerpColors(GLASS_CLAY, GLASS_REAL, mat);
    glassMat.opacity = smooth(0.58, 0.66, p) * lerp(0.55, 0.75, mat);
    uA[C.EDGE] = (1 - 0.6 * mat) * (1 - 0.6 * mepFocus);
    uA[C.DETAIL] = (1 - 0.25 * mat) * (1 - 0.6 * mepFocus);
    uA[C.CONTEXT] = (0.9 - 0.45 * smooth(0.6, 0.7, p)) * (1 - 0.5 * mepFocus);
    uA[C.RULING] = 0;

    // 05 the render wipes in
    const wipe = ease(map(p, 0.85, 0.95));
    sheet.style.setProperty('--wipe', wipe.toFixed(4));
    sheet.classList.toggle('is-wiping', wipe > 0.001 && wipe < 0.999);
    sheet.classList.toggle('is-real', wipe >= 0.999);

    // labels
    const planA = smooth(0.1, 0.16, p) * (1 - smooth(0.22, 0.27, p));
    // on small sheets the model is too small for three callouts, so they stay hidden
    const noteA = W < 520 ? 0 : smooth(0.68, 0.72, p) * (1 - smooth(0.79, 0.83, p));
    const mepLabelA = smooth(0.48, 0.51, p) * (1 - smooth(0.56, 0.59, p));
    labels.forEach((l) => {
      const a = l.group === 'plan' ? planA : l.group === 'mep' ? mepLabelA : noteA;
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
    sheet.classList.toggle('show-hint', p > 0.26 && p < 0.8 && !look.used);
    sheet.classList.toggle('show-reset', p < 0.8 && (Math.abs(look.taz) > 2 || Math.abs(look.tel) > 2));
  }

  /* ---------------------------------------------------------
     Loop: ease towards the scroll position, render only when needed
     --------------------------------------------------------- */
  let target = reduceMotion ? STAGE_P[4] : 0;
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
