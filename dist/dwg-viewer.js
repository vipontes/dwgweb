import { defineComponent as rt, ref as H, shallowRef as it, computed as st, onMounted as at, onBeforeUnmount as lt, watch as ct, openBlock as ft, createElementBlock as ut, createElementVNode as ht } from "vue";
function Z(t, e) {
  return t.glyphs.get(e);
}
function dt(t) {
  const e = t.indexOf(",");
  if (e === -1) return null;
  const o = t.indexOf(",", e + 1), n = Number(t.slice(0, e));
  if (!Number.isFinite(n)) return null;
  if (o === -1) {
    const i = Number(t.slice(e + 1));
    return Number.isFinite(i) ? { x: n, y: i, hasBulge: !1, bulge: 0 } : null;
  }
  const r = Number(t.slice(e + 1, o));
  if (!Number.isFinite(r)) return null;
  const s = t.slice(o + 1);
  if (s.length > 0 && (s[0] === "A" || s[0] === "a")) {
    const i = Number(s.slice(1));
    if (Number.isFinite(i)) return { x: n, y: r, hasBulge: !0, bulge: i };
  }
  return { x: n, y: r, hasBulge: !1, bulge: 0 };
}
function gt(t, e, o) {
  if (Math.abs(o) < 1e-9) return null;
  const n = e.x - t.x, r = e.y - t.y, s = Math.hypot(n, r);
  if (s < 1e-9) return null;
  const i = o >= 0 ? 1 : -1, a = 2 * Math.atan(Math.abs(o)), l = s / 2 / Math.sin(a), c = (t.x + e.x) / 2, h = (t.y + e.y) / 2, u = i > 0 ? -r : r, p = i > 0 ? n : -n, x = Math.hypot(u, p), M = l * Math.cos(a), m = { x: c + u / x * M, y: h + p / x * M };
  let P = Math.atan2(t.y - m.y, t.x - m.x), b = Math.atan2(e.y - m.y, e.x - m.x);
  return i > 0 ? b < P && (b += 2 * Math.PI) : b > P && (b -= 2 * Math.PI), { center: m, radius: l, startAngle: P, endAngle: b };
}
function yt(t, e, o, n) {
  const r = gt(e, o, n);
  if (!r) {
    t.push(o);
    return;
  }
  const { center: s, radius: i, startAngle: a, endAngle: l } = r, c = l - a, h = Math.min(64, Math.max(2, Math.ceil(Math.abs(c) / (Math.PI / 24))));
  for (let u = 1; u <= h; u++) {
    const p = a + c * u / h;
    t.push({ x: s.x + i * Math.cos(p), y: s.y + i * Math.sin(p) });
  }
}
function mt(t) {
  const e = [];
  for (const n of t.split(";")) {
    const r = dt(n);
    r && e.push(r);
  }
  const o = [];
  if (e.length === 0) return o;
  o.push({ x: e[0].x, y: e[0].y });
  for (let n = 1; n < e.length; n++)
    yt(o, { x: e[n - 1].x, y: e[n - 1].y }, { x: e[n].x, y: e[n].y }, e[n].hasBulge ? e[n].bulge : 0);
  return o;
}
function xt(t) {
  if (t.length < 2 || t[0] !== "C" || t.includes(",")) return null;
  const e = t.slice(1);
  return /^[0-9A-Fa-f]+$/.test(e) ? Number.parseInt(e, 16) : null;
}
function pt(t, e) {
  let o = 1;
  for (; o < t.length && t[o] === " "; ) o++;
  const n = t.slice(o), r = n.indexOf(":");
  if (r === -1) return;
  const s = n.slice(0, r), i = Number(n.slice(r + 1));
  Number.isFinite(i) && (s === "LetterSpacing" ? e.letterSpacing = i : s === "WordSpacing" ? e.wordSpacing = i : s === "LineSpacingFactor" && (e.lineSpacingFactor = i));
}
function nt(t, e, o, n) {
  const r = o.get(t);
  if (r) return r;
  const s = { strokes: [], advance: 0 }, i = e.get(t), a = n.includes(t);
  if (i && !a) {
    n.push(t);
    for (const l of i)
      if (l.isComposeRef) {
        const c = nt(l.composeRef, e, o, n);
        s.strokes.push(...c.strokes);
      } else
        s.strokes.push(l.stroke);
    n.pop();
    for (const l of s.strokes)
      for (const c of l) s.advance = Math.max(s.advance, c.x);
  }
  return o.set(t, s), s;
}
function Mt(t) {
  const e = { glyphs: /* @__PURE__ */ new Map(), letterSpacing: 3, wordSpacing: 6.75, lineSpacingFactor: 1 }, o = /* @__PURE__ */ new Map();
  let n = !1, r = 0;
  for (let i of t.split(`
`)) {
    if (i.endsWith("\r") && (i = i.slice(0, -1)), i.length === 0) continue;
    if (i[0] === "#") {
      pt(i, e);
      continue;
    }
    if (i[0] === "[") {
      const c = i.indexOf("]");
      if (c === -1) {
        n = !1;
        continue;
      }
      const h = i.slice(1, c), u = Number.parseInt(h, 16);
      Number.isFinite(u) ? (r = u, o.has(r) || o.set(r, []), n = !0) : n = !1;
      continue;
    }
    if (!n) continue;
    const a = xt(i);
    if (a !== null) {
      o.get(r).push({ isComposeRef: !0, composeRef: a, stroke: [] });
      continue;
    }
    const l = mt(i);
    l.length > 0 && o.get(r).push({ isComposeRef: !1, composeRef: 0, stroke: l });
  }
  if (o.size === 0) return null;
  const s = [];
  for (const i of o.keys()) nt(i, o, e.glyphs, s);
  return e;
}
const J = "unicode";
function wt() {
  return [
    new URL(
      /* @vite-ignore */
      "./resources/fonts/",
      import.meta.url
    ).toString(),
    new URL(
      /* @vite-ignore */
      "../resources/fonts/",
      import.meta.url
    ).toString()
  ];
}
function Q(t) {
  const e = t.split(/[/\\]/).pop() ?? t, o = e.lastIndexOf(".");
  return (o === -1 ? e : e.slice(0, o)).toLowerCase();
}
async function Pt(t, e) {
  try {
    const o = await fetch(new URL(`${e}.lff`, t));
    if (!o.ok) return { found: !1 };
    const n = Mt(await o.text());
    return n ? { found: !0, font: n } : { found: !1 };
  } catch {
    return { found: !1 };
  }
}
class bt {
  constructor(e) {
    this.resolvedBaseUrl = null, this.pending = /* @__PURE__ */ new Map(), this.resolved = /* @__PURE__ */ new Map(), this.baseUrls = e ? [e] : wt();
  }
  /**
   * Awaits every font named by `fontFiles` (plus the unicode.lff fallback)
   * so fontFor()/fallbackFont are ready to call synchronously afterward --
   * renderer.ts's draw loop can't itself be async (Canvas2D drawing is
   * inherently synchronous), so DwgViewer.vue awaits this once per parsed
   * drawing before rendering it.
   */
  async preload(e) {
    const o = /* @__PURE__ */ new Set([J]);
    for (const n of e)
      n && o.add(Q(n));
    await Promise.all([...o].map((n) => this.load(n)));
  }
  /**
   * Resolves a Shape::fontFile to its loaded LffFont -- null if `fontFile`
   * is empty (no STYLE override known) or names a font this project has no
   * shipped .lff for. Callers (renderer.ts) treat null identically: fall
   * back to the browser's own font rendering, matching this viewer's
   * behavior before LFF support existed. Only meaningful for fonts already
   * awaited via preload(); an unresolved lookup returns null rather than
   * kicking off a fetch, keeping this synchronous for the render loop.
   */
  fontFor(e) {
    return e ? this.resolved.get(Q(e)) ?? null : null;
  }
  /** The always-preloaded unicode.lff, or null if it failed to fetch/parse. */
  get fallbackFont() {
    return this.resolved.get(J) ?? null;
  }
  load(e) {
    let o = this.pending.get(e);
    return o || (o = this.fetchAndParse(e).then((n) => (this.resolved.set(e, n), n)), this.pending.set(e, o)), o;
  }
  async fetchAndParse(e) {
    const o = this.resolvedBaseUrl ? [this.resolvedBaseUrl] : this.baseUrls;
    for (const n of o) {
      const r = await Pt(n, e);
      if (r.found)
        return this.resolvedBaseUrl = n, r.font;
    }
    return null;
  }
}
let j = null;
function vt() {
  return j || (j = import("./wasm/dwgparser.js").then((t) => t.default())), j;
}
function F(t, e) {
  const o = t.size(), n = new Array(o);
  for (let r = 0; r < o; r++) n[r] = e(t.get(r));
  return t.delete(), n;
}
function U(t) {
  return { x: t.x, y: t.y };
}
function _(t) {
  return t;
}
function kt(t) {
  return {
    points: F(t.points, U),
    bulges: F(t.bulges, _)
  };
}
function At(t) {
  return {
    angleRad: t.angleRad,
    basePoint: U(t.basePoint),
    offset: U(t.offset),
    dashPattern: F(t.dashPattern, _)
  };
}
function Bt(t) {
  return {
    kind: t.kind.value,
    points: F(t.points, U),
    bulges: F(t.bulges, _),
    startWidths: F(t.startWidths, _),
    endWidths: F(t.endWidths, _),
    dashPattern: F(t.dashPattern, _),
    center: U(t.center),
    radius: t.radius,
    startAngleRad: t.startAngleRad,
    endAngleRad: t.endAngleRad,
    closed: t.closed,
    color: { r: t.color.r, g: t.color.g, b: t.color.b },
    text: t.text,
    textHeightDoc: t.textHeightDoc,
    textAngleRad: t.textAngleRad,
    textHAlign: t.textHAlign.value,
    textVAlign: t.textVAlign.value,
    fontFile: t.fontFile,
    hatchLoops: F(t.hatchLoops, kt),
    hatchFillKind: t.hatchFillKind.value,
    hatchColor2: { r: t.hatchColor2.r, g: t.hatchColor2.g, b: t.hatchColor2.b },
    hatchGradientAngleRad: t.hatchGradientAngleRad,
    hatchPatternLines: F(t.hatchPatternLines, At)
  };
}
function Rt(t) {
  return { minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY };
}
function St(t) {
  return t.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
}
let Tt = 0;
async function Xt(t, e) {
  const o = await vt(), n = t instanceof Uint8Array ? t : new Uint8Array(t), r = `/input-${Tt++}.${St(e)}`;
  o.FS.writeFile(r, n);
  let s;
  try {
    s = o.loadDwgFile(r);
    const i = s.errorMessage();
    if (i)
      return { shapes: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, errorMessage: i };
    const a = F(s.shapes(), Bt), l = Rt(s.boundingBox());
    return { shapes: a, boundingBox: l, errorMessage: "" };
  } finally {
    s == null || s.delete();
    try {
      o.FS.unlink(r);
    } catch {
    }
  }
}
var N = /* @__PURE__ */ ((t) => (t[t.Line = 0] = "Line", t[t.Circle = 1] = "Circle", t[t.Arc = 2] = "Arc", t[t.Polyline = 3] = "Polyline", t[t.Text = 4] = "Text", t[t.Hatch = 5] = "Hatch", t))(N || {}), E = /* @__PURE__ */ ((t) => (t[t.Left = 0] = "Left", t[t.Center = 1] = "Center", t[t.Right = 2] = "Right", t))(E || {}), W = /* @__PURE__ */ ((t) => (t[t.Baseline = 0] = "Baseline", t[t.Bottom = 1] = "Bottom", t[t.Middle = 2] = "Middle", t[t.Top = 3] = "Top", t))(W || {}), O = /* @__PURE__ */ ((t) => (t[t.Solid = 0] = "Solid", t[t.Gradient = 1] = "Gradient", t[t.Pattern = 2] = "Pattern", t))(O || {});
function Ct(t) {
  return t.minX <= t.maxX && t.minY <= t.maxY;
}
function D(t) {
  return `rgb(${t.r},${t.g},${t.b})`;
}
const Yt = 20;
function Lt(t, e, o, n = Yt) {
  const r = Math.max(1, e - 2 * n), s = Math.max(1, o - 2 * n);
  let i = t.maxX - t.minX, a = t.maxY - t.minY;
  i < 1e-9 && (i = a > 1e-9 ? a : 1), a < 1e-9 && (a = i);
  const l = Math.min(r / i, s / a), c = n + (r - i * l) / 2, h = n + (s + a * l) / 2;
  return new DOMMatrix().translate(c, h).scale(l, -l).translate(-t.minX, -t.minY);
}
function K(t, e, o, n) {
  const r = t.inverse().transformPoint(new DOMPoint(e, o));
  return t.translate(r.x, r.y).scale(n, n).translate(-r.x, -r.y);
}
function tt(t, e, o) {
  return new DOMMatrix([t.a, t.b, t.c, t.d, t.e + e, t.f + o]);
}
function Ft(t, e, o) {
  if (Math.abs(o) < 1e-9) return null;
  const n = e.x - t.x, r = e.y - t.y, s = Math.hypot(n, r);
  if (s < 1e-9) return null;
  const i = o >= 0 ? 1 : -1, a = 2 * Math.atan(Math.abs(o)), l = s / 2 / Math.sin(a), c = (t.x + e.x) / 2, h = (t.y + e.y) / 2, u = (i > 0 ? -r : r) / s, p = (i > 0 ? n : -n) / s, x = l * Math.cos(a), M = { x: c + u * x, y: h + p * x };
  let m = Math.atan2(t.y - M.y, t.x - M.x), P = Math.atan2(e.y - M.y, e.x - M.x);
  return i > 0 ? P < m && (P += 2 * Math.PI) : P > m && (P -= 2 * Math.PI), { center: M, radius: l, startAngle: m, endAngle: P };
}
function G(t, e, o, n) {
  const r = Ft(e, o, n);
  if (!r) {
    t.push(o);
    return;
  }
  const { center: s, radius: i, startAngle: a, endAngle: l } = r, c = l - a, h = Math.min(64, Math.max(2, Math.ceil(Math.abs(c) / (Math.PI / 24))));
  for (let u = 1; u <= h; u++) {
    const p = a + c * u / h;
    t.push({ x: s.x + i * Math.cos(p), y: s.y + i * Math.sin(p) });
  }
}
function It(t, e, o) {
  const n = t.length, r = e.length === n, s = [t[0]];
  for (let i = 1; i < n; i++)
    G(s, t[i - 1], t[i], r ? e[i - 1] : 0);
  return o && G(s, t[n - 1], t[0], r ? e[n - 1] : 0), s;
}
function $(t, e, o, n) {
  if (e.length < 2) return;
  if (n.length === 0) {
    t.beginPath(), t.moveTo(e[0].x, e[0].y);
    for (let c = 1; c < e.length; c++) t.lineTo(e[c].x, e[c].y);
    o && t.closePath(), t.stroke();
    return;
  }
  const r = new Path2D();
  let s = 0, i = n[0], a = !0;
  const l = o ? e.length : e.length - 1;
  for (let c = 0; c < l; c++) {
    const h = e[c], u = e[(c + 1) % e.length], p = Math.hypot(u.x - h.x, u.y - h.y);
    if (p < 1e-12) continue;
    let x = 0;
    for (; x < p; ) {
      const M = Math.min(i, p - x), m = x / p, P = (x + M) / p;
      a && (r.moveTo(h.x + (u.x - h.x) * m, h.y + (u.y - h.y) * m), r.lineTo(h.x + (u.x - h.x) * P, h.y + (u.y - h.y) * P)), x += M, i -= M, i <= 1e-9 && (s = (s + 1) % n.length, i = n[s], a = !a);
    }
  }
  t.stroke(r);
}
function Dt(t, e, o, n, r) {
  const s = o.x - e.x, i = o.y - e.y, a = Math.hypot(s, i);
  if (a < 1e-9) return;
  const l = -i / a, c = s / a, h = { x: e.x + l * n / 2, y: e.y + c * n / 2 }, u = { x: o.x + l * r / 2, y: o.y + c * r / 2 }, p = { x: o.x - l * r / 2, y: o.y - c * r / 2 }, x = { x: e.x - l * n / 2, y: e.y - c * n / 2 };
  t.moveTo(h.x, h.y), t.lineTo(u.x, u.y), t.lineTo(p.x, p.y), t.lineTo(x.x, x.y), t.closePath();
}
function Nt(t, e) {
  const o = e.points.length, n = e.bulges.length === o, r = e.closed ? o : o - 1, s = e.dashPattern, i = new Path2D(), a = new Path2D();
  let l = !1, c = !1, h = 0, u = s.length === 0 ? 0 : s[0], p = !0;
  for (let x = 0; x < r; x++) {
    const M = e.points[x], m = e.points[(x + 1) % o], P = n ? e.bulges[x] : 0, b = e.startWidths[x], k = e.endWidths[x], T = [M];
    G(T, M, m, P);
    const X = T.length - 1;
    for (let B = 0; B < X; B++) {
      const w = T[B], v = T[B + 1], R = Math.hypot(v.x - w.x, v.y - w.y);
      if (R < 1e-12) continue;
      const L = B / X, f = (B + 1) / X, g = b + (k - b) * L, d = b + (k - b) * f;
      let y = 0;
      for (; y < R; ) {
        const S = s.length === 0 ? R : Math.min(u, R - y), A = y / R, I = (y + S) / R;
        if (p) {
          const C = { x: w.x + (v.x - w.x) * A, y: w.y + (v.y - w.y) * A }, Y = { x: w.x + (v.x - w.x) * I, y: w.y + (v.y - w.y) * I }, q = g + (d - g) * A, V = g + (d - g) * I;
          q === 0 && V === 0 ? (i.moveTo(C.x, C.y), i.lineTo(Y.x, Y.y), l = !0) : (Dt(a, C, Y, q, V), c = !0);
        }
        if (y += S, s.length === 0) break;
        u -= S, u <= 1e-9 && (h = (h + 1) % s.length, u = s[h], p = !p);
      }
    }
  }
  l && t.stroke(i), c && (t.fillStyle = D(e.color), t.fill(a, "nonzero"));
}
function Wt(t) {
  const e = t.points.length;
  if (e < 2) return [];
  const o = t.bulges.length === e, n = [t.points[0]];
  for (let r = 1; r < e; r++)
    G(n, t.points[r - 1], t.points[r], o ? t.bulges[r - 1] : 0);
  return G(n, t.points[e - 1], t.points[0], o ? t.bulges[e - 1] : 0), n;
}
function _t(t) {
  const e = new Path2D();
  let o = 1 / 0, n = 1 / 0, r = -1 / 0, s = -1 / 0;
  for (const i of t) {
    const a = Wt(i);
    if (!(a.length < 2)) {
      e.moveTo(a[0].x, a[0].y);
      for (let l = 1; l < a.length; l++)
        e.lineTo(a[l].x, a[l].y), o = Math.min(o, a[l].x), n = Math.min(n, a[l].y), r = Math.max(r, a[l].x), s = Math.max(s, a[l].y);
      o = Math.min(o, a[0].x), n = Math.min(n, a[0].y), r = Math.max(r, a[0].x), s = Math.max(s, a[0].y), e.closePath();
    }
  }
  return { path: e, bounds: { minX: o, minY: n, maxX: r, maxY: s } };
}
function Ut(t, e, o) {
  const n = Math.cos(e.angleRad), r = Math.sin(e.angleRad), s = -r, i = n, a = e.basePoint, l = e.offset, c = (w, v, R, L) => w * R + v * L, h = c(l.x, l.y, s, i), u = c(l.x, l.y, n, r);
  if (Math.abs(h) < 1e-9) return;
  const p = [
    { x: o.minX, y: o.minY },
    { x: o.maxX, y: o.minY },
    { x: o.minX, y: o.maxY },
    { x: o.maxX, y: o.maxY }
  ];
  let x = 1 / 0, M = -1 / 0, m = 1 / 0, P = -1 / 0;
  for (const w of p) {
    const v = w.x - a.x, R = w.y - a.y;
    x = Math.min(x, c(v, R, s, i)), M = Math.max(M, c(v, R, s, i)), m = Math.min(m, c(v, R, n, r)), P = Math.max(P, c(v, R, n, r));
  }
  let b = Math.floor(x / h) - 1, k = Math.ceil(M / h) + 1;
  if (b > k && ([b, k] = [k, b]), k - b > 1e5) return;
  let T = 0;
  for (const w of e.dashPattern) T += Math.abs(w);
  const X = Math.max(T * 0.02, 1e-6), B = new Path2D();
  for (let w = b; w <= k; w++) {
    const v = a.x + s * (w * h), R = a.y + i * (w * h), L = { x: v + n * m, y: R + r * m }, f = P - m;
    if (f <= 1e-9) continue;
    if (e.dashPattern.length === 0) {
      B.moveTo(L.x, L.y), B.lineTo(v + n * P, R + r * P);
      continue;
    }
    const g = w * u;
    let d = (m - g) % T;
    d < 0 && (d += T);
    let y = 0, S = 0;
    for (; y + 1 < e.dashPattern.length; y++) {
      const Y = e.dashPattern[y] === 0 ? X : Math.abs(e.dashPattern[y]);
      if (d < S + Y) break;
      S += Y;
    }
    let A = S + (e.dashPattern[y] === 0 ? X : Math.abs(e.dashPattern[y])) - d, I = e.dashPattern[y] >= 0, C = 0;
    for (; C < f; ) {
      const Y = Math.min(A, f - C);
      I && (B.moveTo(L.x + n * C, L.y + r * C), B.lineTo(L.x + n * (C + Y), L.y + r * (C + Y))), C += Y, A -= Y, A <= 1e-9 && (y = (y + 1) % e.dashPattern.length, A = e.dashPattern[y] === 0 ? X : Math.abs(e.dashPattern[y]), I = e.dashPattern[y] >= 0);
    }
  }
  t.stroke(B);
}
const Et = 5 / 3;
function ot(t, e, o) {
  const n = Z(t, o) ?? (e ? Z(e, o) : void 0), r = (n ? n.advance : t.wordSpacing) + t.letterSpacing;
  return { glyph: n, advance: r };
}
function et(t, e, o) {
  let n = 0;
  for (const r of o) n += ot(t, e, r.codePointAt(0) ?? 0).advance;
  return n;
}
function Gt(t, e, o, n, r, s, i) {
  const a = r / 9, l = r * o.lineSpacingFactor * Et, c = l * e.length;
  let h;
  switch (i) {
    case W.Top:
      h = r;
      break;
    case W.Middle:
      h = r - c / 2;
      break;
    case W.Bottom:
      h = r - c;
      break;
    default:
      h = 0;
  }
  const u = new Path2D();
  let p = h;
  for (const x of e) {
    let M = 0;
    s === E.Center ? M = -et(o, n, x) * a / 2 : s === E.Right && (M = -et(o, n, x) * a);
    let m = 0;
    for (const P of x) {
      const b = P.codePointAt(0) ?? 0, { glyph: k, advance: T } = ot(o, n, b);
      if (k)
        for (const X of k.strokes)
          for (let B = 1; B < X.length; B++) {
            const w = X[B - 1], v = X[B];
            u.moveTo(M + (m + w.x) * a, p - w.y * a), u.lineTo(M + (m + v.x) * a, p - v.y * a);
          }
      m += T;
    }
    p += l;
  }
  t.stroke(u);
}
function Ht(t, e, o, n, r) {
  if (!e.text) return;
  const s = Math.abs(o.a);
  if (s <= 0) return;
  const i = o.transformPoint(new DOMPoint(e.center.x, e.center.y));
  let a = Math.round(e.textHeightDoc * s);
  a < 1 && (a = 1), t.save(), t.setTransform(n, 0, 0, n, 0, 0), t.translate(i.x, i.y), t.rotate(-e.textAngleRad);
  const l = e.text.split(`
`), c = (r == null ? void 0 : r.fontFor(e.fontFile)) ?? null;
  if (c) {
    t.strokeStyle = D(e.color), t.lineWidth = 1 / n, Gt(t, l, c, (r == null ? void 0 : r.fallbackFont) ?? null, a, e.textHAlign, e.textVAlign), t.restore();
    return;
  }
  t.font = `${a}px sans-serif`, t.fillStyle = D(e.color), t.textBaseline = "alphabetic", t.textAlign = e.textHAlign === E.Center ? "center" : e.textHAlign === E.Right ? "right" : "left";
  const h = t.measureText("Mgjy"), u = h.fontBoundingBoxAscent ?? a * 0.8, p = h.fontBoundingBoxDescent ?? a * 0.2, x = u + p, M = x * l.length;
  let m;
  switch (e.textVAlign) {
    case W.Top:
      m = u;
      break;
    case W.Middle:
      m = u - M / 2;
      break;
    case W.Bottom:
      m = u - M;
      break;
    default:
      m = 0;
  }
  let P = m;
  for (const b of l)
    t.fillText(b, 0, P), P += x;
  t.restore();
}
const z = 48;
function Ot(t, e) {
  if (e.points.length !== 2) return;
  const [o, n] = e.points;
  e.dashPattern.length === 0 ? (t.beginPath(), t.moveTo(o.x, o.y), t.lineTo(n.x, n.y), t.stroke()) : $(t, [o, n], !1, e.dashPattern);
}
function zt(t, e) {
  if (e.dashPattern.length === 0) {
    t.beginPath(), t.ellipse(e.center.x, e.center.y, e.radius, e.radius, 0, 0, 2 * Math.PI), t.stroke();
    return;
  }
  const o = [];
  for (let n = 0; n < z; n++) {
    const r = 2 * Math.PI * n / z;
    o.push({ x: e.center.x + e.radius * Math.cos(r), y: e.center.y + e.radius * Math.sin(r) });
  }
  $(t, o, !0, e.dashPattern);
}
function $t(t, e) {
  let o = e.startAngleRad, n = e.endAngleRad;
  n < o && (n += 2 * Math.PI);
  const r = [];
  for (let s = 0; s <= z; s++) {
    const i = o + (n - o) * s / z;
    r.push({ x: e.center.x + e.radius * Math.cos(i), y: e.center.y + e.radius * Math.sin(i) });
  }
  $(t, r, !1, e.dashPattern);
}
function jt(t, e) {
  if (e.points.length < 2) return;
  const o = e.points.length;
  if (!(e.startWidths.length === o && e.endWidths.length === o)) {
    const r = It(e.points, e.bulges, e.closed);
    $(t, r, !1, e.dashPattern);
    return;
  }
  Nt(t, e);
}
function qt(t, e) {
  if (e.hatchLoops.length === 0) return;
  const { path: o, bounds: n } = _t(e.hatchLoops);
  if (Number.isFinite(n.minX))
    switch (e.hatchFillKind) {
      case O.Solid:
        t.fillStyle = D(e.color), t.fill(o, "evenodd");
        break;
      case O.Gradient: {
        const r = n.maxX - n.minX, s = n.maxY - n.minY, i = 0.5 * Math.hypot(r, s);
        if (i < 1e-9) {
          t.fillStyle = D(e.color), t.fill(o, "evenodd");
          break;
        }
        const a = n.minX + r / 2, l = n.minY + s / 2, c = Math.cos(e.hatchGradientAngleRad), h = Math.sin(e.hatchGradientAngleRad), u = t.createLinearGradient(
          a - c * i,
          l - h * i,
          a + c * i,
          l + h * i
        );
        u.addColorStop(0, D(e.color)), u.addColorStop(1, D(e.hatchColor2)), t.fillStyle = u, t.fill(o, "evenodd");
        break;
      }
      case O.Pattern: {
        t.save(), t.clip(o, "evenodd"), t.strokeStyle = D(e.color);
        for (const r of e.hatchPatternLines) Ut(t, r, n);
        t.restore();
        break;
      }
    }
}
function Vt(t, e, o) {
  const { documentToScreen: n, pixelRatio: r, fonts: s } = o, i = new DOMMatrix([r, 0, 0, r, 0, 0]).multiply(n);
  t.setTransform(i);
  const a = Math.abs(n.a), l = a > 0 ? 1 / a : 1;
  t.lineWidth = l;
  for (const c of e) {
    switch (t.strokeStyle = D(c.color), c.kind) {
      case N.Line:
        Ot(t, c);
        break;
      case N.Circle:
        zt(t, c);
        break;
      case N.Arc:
        $t(t, c);
        break;
      case N.Polyline:
        jt(t, c);
        break;
      case N.Text:
        Ht(t, c, n, r, s);
        break;
      case N.Hatch:
        qt(t, c);
        break;
    }
    t.setTransform(i), t.lineWidth = l;
  }
}
const Zt = /* @__PURE__ */ rt({
  __name: "DwgViewer",
  props: {
    source: {},
    fileName: {},
    fontsBaseUrl: {}
  },
  emits: ["loaded", "error"],
  setup(t, { expose: e, emit: o }) {
    const n = t, r = new bt(n.fontsBaseUrl), s = o, i = H(null), a = H(null), l = it(null), c = H(!1), h = H(null);
    let u = null, p = !1, x = null;
    const M = /* @__PURE__ */ new Map();
    let m = null;
    const P = st(() => c.value ? "Loading drawing…" : h.value ? h.value : !l.value || l.value.shapes.length === 0 ? "No drawing loaded" : null);
    function b() {
      const f = a.value;
      if (!f || !l.value) return;
      const g = l.value.boundingBox;
      if (!Ct(g)) return;
      const d = f.clientWidth, y = f.clientHeight;
      u = Lt(g, d, y), p = !0;
    }
    function k() {
      const f = a.value;
      if (!f) return;
      const g = f.getContext("2d");
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0), g.fillStyle = "black", g.fillRect(0, 0, f.width, f.height);
      const d = P.value;
      if (d) {
        const S = window.devicePixelRatio || 1;
        g.setTransform(S, 0, 0, S, 0, 0), g.fillStyle = "gray", g.font = "14px sans-serif", g.textAlign = "center", g.textBaseline = "middle", g.fillText(d, f.clientWidth / 2, f.clientHeight / 2);
      }
      if (!l.value || !u || !p) return;
      g.imageSmoothingEnabled = !0;
      const y = window.devicePixelRatio || 1;
      Vt(g, l.value.shapes, { documentToScreen: u, pixelRatio: y, fonts: r });
    }
    function T(f, g) {
      const d = a.value, y = i.value;
      if (!d || !y) return;
      const S = Math.max(1, Math.floor(f ?? y.clientWidth)), A = Math.max(1, Math.floor(g ?? y.clientHeight)), I = window.devicePixelRatio || 1, C = Math.round(S * I), Y = Math.round(A * I);
      d.width === C && d.height === Y || (d.width = C, d.height = Y, b(), k());
    }
    async function X() {
      const f = n.source;
      if (u = null, p = !1, l.value = null, h.value = null, !f) {
        k();
        return;
      }
      c.value = !0, k();
      try {
        let g, d;
        if (typeof f == "string") {
          const A = await fetch(f);
          if (!A.ok) throw new Error(`Failed to fetch ${f}: ${A.status}`);
          g = await A.arrayBuffer(), d = n.fileName ?? f;
        } else if (f instanceof File)
          g = await f.arrayBuffer(), d = n.fileName ?? f.name;
        else {
          if (g = f instanceof Uint8Array ? f.slice().buffer : f, !n.fileName)
            throw new Error("fileName prop is required when source is raw bytes (need it to tell .dxf from .dwg)");
          d = n.fileName;
        }
        const y = await Xt(g, d);
        if (y.errorMessage) {
          h.value = y.errorMessage, s("error", y.errorMessage);
          return;
        }
        const S = y.shapes.filter((A) => A.kind === N.Text).map((A) => A.fontFile);
        await r.preload(S), l.value = y, b(), s("loaded", y);
      } catch (g) {
        const d = g instanceof Error ? g.message : String(g);
        h.value = d, s("error", d);
      } finally {
        c.value = !1, k();
      }
    }
    function B(f) {
      if (!u || !p) return;
      f.preventDefault();
      const g = f.deltaY < 0 ? 1.15 : 1 / 1.15, d = a.value;
      if (!d) return;
      const y = d.getBoundingClientRect(), S = f.clientX - y.left, A = f.clientY - y.top;
      u = K(u, S, A, g), k();
    }
    function w() {
      const f = a.value;
      if (!f || M.size !== 2) return null;
      const g = f.getBoundingClientRect(), [d, y] = [...M.values()];
      return {
        midX: (d.x + y.x) / 2 - g.left,
        midY: (d.y + y.y) / 2 - g.top,
        distance: Math.hypot(d.x - y.x, d.y - y.y)
      };
    }
    function v(f) {
      f.pointerType === "mouse" && f.button !== 0 || M.size >= 2 || (f.preventDefault(), M.set(f.pointerId, { x: f.clientX, y: f.clientY }), f.currentTarget.setPointerCapture(f.pointerId), m = w());
    }
    function R(f) {
      const g = M.get(f.pointerId);
      if (!(!g || !u)) {
        if (M.set(f.pointerId, { x: f.clientX, y: f.clientY }), M.size === 2) {
          const d = w();
          if (!d) return;
          m && m.distance > 0 && d.distance > 0 && (u = tt(u, d.midX - m.midX, d.midY - m.midY), u = K(u, d.midX, d.midY, d.distance / m.distance), k()), m = d;
          return;
        }
        u = tt(u, f.clientX - g.x, f.clientY - g.y), k();
      }
    }
    function L(f) {
      f.pointerType === "mouse" && f.type === "pointerup" && f.button !== 0 || (f.preventDefault(), M.delete(f.pointerId), m = null);
    }
    return e({ zoomFit: () => {
      b(), k();
    } }), at(() => {
      x = new ResizeObserver((f) => {
        var g;
        for (const d of f) {
          const y = (g = d.contentBoxSize) == null ? void 0 : g[0];
          y ? T(y.inlineSize, y.blockSize) : T(d.contentRect.width, d.contentRect.height);
        }
      }), i.value && x.observe(i.value), T(), X();
    }), lt(() => {
      x == null || x.disconnect();
    }), ct(() => n.source, () => {
      X();
    }), (f, g) => (ft(), ut("div", {
      ref_key: "containerEl",
      ref: i,
      class: "dwg-viewer-root",
      style: { position: "relative", overflow: "hidden", width: "100%", height: "100%", minWidth: "200px", minHeight: "200px" }
    }, [
      ht("canvas", {
        ref_key: "canvasEl",
        ref: a,
        class: "dwg-viewer-canvas",
        style: { position: "absolute", inset: "0", width: "100%", height: "100%" },
        onWheel: B,
        onPointerdown: v,
        onPointermove: R,
        onPointerup: L,
        onPointercancel: L
      }, null, 544)
    ], 512));
  }
}), Jt = (t, e) => {
  const o = t.__vccOpts || t;
  for (const [n, r] of e)
    o[n] = r;
  return o;
}, Kt = /* @__PURE__ */ Jt(Zt, [["__scopeId", "data-v-1148342e"]]);
export {
  Kt as DwgViewer,
  O as HatchFillKind,
  N as ShapeKind,
  E as TextHAlign,
  W as TextVAlign,
  Lt as computeZoomFitTransform,
  Ct as isValidBoundingBox,
  tt as panByScreenDelta,
  Xt as parseDrawing,
  Vt as renderShapes,
  K as zoomAroundPoint
};
