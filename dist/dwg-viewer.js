import { defineComponent as nt, ref as H, shallowRef as ot, computed as rt, onMounted as it, onBeforeUnmount as st, watch as at, openBlock as lt, createElementBlock as ct, createElementVNode as ft } from "vue";
function Z(t, e) {
  return t.glyphs.get(e);
}
function ut(t) {
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
function ht(t, e, o) {
  if (Math.abs(o) < 1e-9) return null;
  const n = e.x - t.x, r = e.y - t.y, s = Math.hypot(n, r);
  if (s < 1e-9) return null;
  const i = o >= 0 ? 1 : -1, a = 2 * Math.atan(Math.abs(o)), l = s / 2 / Math.sin(a), c = (t.x + e.x) / 2, u = (t.y + e.y) / 2, f = i > 0 ? -r : r, m = i > 0 ? n : -n, y = Math.hypot(f, m), M = l * Math.cos(a), x = { x: c + f / y * M, y: u + m / y * M };
  let w = Math.atan2(t.y - x.y, t.x - x.x), b = Math.atan2(e.y - x.y, e.x - x.x);
  return i > 0 ? b < w && (b += 2 * Math.PI) : b > w && (b -= 2 * Math.PI), { center: x, radius: l, startAngle: w, endAngle: b };
}
function dt(t, e, o, n) {
  const r = ht(e, o, n);
  if (!r) {
    t.push(o);
    return;
  }
  const { center: s, radius: i, startAngle: a, endAngle: l } = r, c = l - a, u = Math.min(64, Math.max(2, Math.ceil(Math.abs(c) / (Math.PI / 24))));
  for (let f = 1; f <= u; f++) {
    const m = a + c * f / u;
    t.push({ x: s.x + i * Math.cos(m), y: s.y + i * Math.sin(m) });
  }
}
function gt(t) {
  const e = [];
  for (const n of t.split(";")) {
    const r = ut(n);
    r && e.push(r);
  }
  const o = [];
  if (e.length === 0) return o;
  o.push({ x: e[0].x, y: e[0].y });
  for (let n = 1; n < e.length; n++)
    dt(o, { x: e[n - 1].x, y: e[n - 1].y }, { x: e[n].x, y: e[n].y }, e[n].hasBulge ? e[n].bulge : 0);
  return o;
}
function yt(t) {
  if (t.length < 2 || t[0] !== "C" || t.includes(",")) return null;
  const e = t.slice(1);
  return /^[0-9A-Fa-f]+$/.test(e) ? Number.parseInt(e, 16) : null;
}
function mt(t, e) {
  let o = 1;
  for (; o < t.length && t[o] === " "; ) o++;
  const n = t.slice(o), r = n.indexOf(":");
  if (r === -1) return;
  const s = n.slice(0, r), i = Number(n.slice(r + 1));
  Number.isFinite(i) && (s === "LetterSpacing" ? e.letterSpacing = i : s === "WordSpacing" ? e.wordSpacing = i : s === "LineSpacingFactor" && (e.lineSpacingFactor = i));
}
function tt(t, e, o, n) {
  const r = o.get(t);
  if (r) return r;
  const s = { strokes: [], advance: 0 }, i = e.get(t), a = n.includes(t);
  if (i && !a) {
    n.push(t);
    for (const l of i)
      if (l.isComposeRef) {
        const c = tt(l.composeRef, e, o, n);
        s.strokes.push(...c.strokes);
      } else
        s.strokes.push(l.stroke);
    n.pop();
    for (const l of s.strokes)
      for (const c of l) s.advance = Math.max(s.advance, c.x);
  }
  return o.set(t, s), s;
}
function xt(t) {
  const e = { glyphs: /* @__PURE__ */ new Map(), letterSpacing: 3, wordSpacing: 6.75, lineSpacingFactor: 1 }, o = /* @__PURE__ */ new Map();
  let n = !1, r = 0;
  for (let i of t.split(`
`)) {
    if (i.endsWith("\r") && (i = i.slice(0, -1)), i.length === 0) continue;
    if (i[0] === "#") {
      mt(i, e);
      continue;
    }
    if (i[0] === "[") {
      const c = i.indexOf("]");
      if (c === -1) {
        n = !1;
        continue;
      }
      const u = i.slice(1, c), f = Number.parseInt(u, 16);
      Number.isFinite(f) ? (r = f, o.has(r) || o.set(r, []), n = !0) : n = !1;
      continue;
    }
    if (!n) continue;
    const a = yt(i);
    if (a !== null) {
      o.get(r).push({ isComposeRef: !0, composeRef: a, stroke: [] });
      continue;
    }
    const l = gt(i);
    l.length > 0 && o.get(r).push({ isComposeRef: !1, composeRef: 0, stroke: l });
  }
  if (o.size === 0) return null;
  const s = [];
  for (const i of o.keys()) tt(i, o, e.glyphs, s);
  return e;
}
const J = "unicode";
function pt() {
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
async function Mt(t, e) {
  try {
    const o = await fetch(new URL(`${e}.lff`, t));
    if (!o.ok) return { found: !1 };
    const n = xt(await o.text());
    return n ? { found: !0, font: n } : { found: !1 };
  } catch {
    return { found: !1 };
  }
}
class wt {
  constructor(e) {
    this.resolvedBaseUrl = null, this.pending = /* @__PURE__ */ new Map(), this.resolved = /* @__PURE__ */ new Map(), this.baseUrls = e ? [e] : pt();
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
      const r = await Mt(n, e);
      if (r.found)
        return this.resolvedBaseUrl = n, r.font;
    }
    return null;
  }
}
let j = null;
function Pt() {
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
function bt(t) {
  return {
    points: F(t.points, U),
    bulges: F(t.bulges, _)
  };
}
function vt(t) {
  return {
    angleRad: t.angleRad,
    basePoint: U(t.basePoint),
    offset: U(t.offset),
    dashPattern: F(t.dashPattern, _)
  };
}
function kt(t) {
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
    hatchLoops: F(t.hatchLoops, bt),
    hatchFillKind: t.hatchFillKind.value,
    hatchColor2: { r: t.hatchColor2.r, g: t.hatchColor2.g, b: t.hatchColor2.b },
    hatchGradientAngleRad: t.hatchGradientAngleRad,
    hatchPatternLines: F(t.hatchPatternLines, vt)
  };
}
function At(t) {
  return { minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY };
}
function Bt(t) {
  return t.toLowerCase().endsWith(".dwg") ? "dwg" : "dxf";
}
let Rt = 0;
async function St(t, e) {
  const o = await Pt(), n = t instanceof Uint8Array ? t : new Uint8Array(t), r = `/input-${Rt++}.${Bt(e)}`;
  o.FS.writeFile(r, n);
  let s;
  try {
    s = o.loadDwgFile(r);
    const i = s.errorMessage();
    if (i)
      return { shapes: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, errorMessage: i };
    const a = F(s.shapes(), kt), l = At(s.boundingBox());
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
function I(t) {
  return `rgb(${t.r},${t.g},${t.b})`;
}
const Tt = 20;
function Xt(t, e, o, n = Tt) {
  const r = Math.max(1, e - 2 * n), s = Math.max(1, o - 2 * n);
  let i = t.maxX - t.minX, a = t.maxY - t.minY;
  i < 1e-9 && (i = a > 1e-9 ? a : 1), a < 1e-9 && (a = i);
  const l = Math.min(r / i, s / a), c = n + (r - i * l) / 2, u = n + (s + a * l) / 2;
  return new DOMMatrix().translate(c, u).scale(l, -l).translate(-t.minX, -t.minY);
}
function Lt(t, e, o, n) {
  const r = t.inverse().transformPoint(new DOMPoint(e, o));
  return t.translate(r.x, r.y).scale(n, n).translate(-r.x, -r.y);
}
function Yt(t, e, o) {
  return new DOMMatrix([t.a, t.b, t.c, t.d, t.e + e, t.f + o]);
}
function Ft(t, e, o) {
  if (Math.abs(o) < 1e-9) return null;
  const n = e.x - t.x, r = e.y - t.y, s = Math.hypot(n, r);
  if (s < 1e-9) return null;
  const i = o >= 0 ? 1 : -1, a = 2 * Math.atan(Math.abs(o)), l = s / 2 / Math.sin(a), c = (t.x + e.x) / 2, u = (t.y + e.y) / 2, f = (i > 0 ? -r : r) / s, m = (i > 0 ? n : -n) / s, y = l * Math.cos(a), M = { x: c + f * y, y: u + m * y };
  let x = Math.atan2(t.y - M.y, t.x - M.x), w = Math.atan2(e.y - M.y, e.x - M.x);
  return i > 0 ? w < x && (w += 2 * Math.PI) : w > x && (w -= 2 * Math.PI), { center: M, radius: l, startAngle: x, endAngle: w };
}
function G(t, e, o, n) {
  const r = Ft(e, o, n);
  if (!r) {
    t.push(o);
    return;
  }
  const { center: s, radius: i, startAngle: a, endAngle: l } = r, c = l - a, u = Math.min(64, Math.max(2, Math.ceil(Math.abs(c) / (Math.PI / 24))));
  for (let f = 1; f <= u; f++) {
    const m = a + c * f / u;
    t.push({ x: s.x + i * Math.cos(m), y: s.y + i * Math.sin(m) });
  }
}
function Dt(t, e, o) {
  const n = t.length, r = e.length === n, s = [t[0]];
  for (let i = 1; i < n; i++)
    G(s, t[i - 1], t[i], r ? e[i - 1] : 0);
  return o && G(s, t[n - 1], t[0], r ? e[n - 1] : 0), s;
}
function z(t, e, o, n) {
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
    const u = e[c], f = e[(c + 1) % e.length], m = Math.hypot(f.x - u.x, f.y - u.y);
    if (m < 1e-12) continue;
    let y = 0;
    for (; y < m; ) {
      const M = Math.min(i, m - y), x = y / m, w = (y + M) / m;
      a && (r.moveTo(u.x + (f.x - u.x) * x, u.y + (f.y - u.y) * x), r.lineTo(u.x + (f.x - u.x) * w, u.y + (f.y - u.y) * w)), y += M, i -= M, i <= 1e-9 && (s = (s + 1) % n.length, i = n[s], a = !a);
    }
  }
  t.stroke(r);
}
function It(t, e, o, n, r) {
  const s = o.x - e.x, i = o.y - e.y, a = Math.hypot(s, i);
  if (a < 1e-9) return;
  const l = -i / a, c = s / a, u = { x: e.x + l * n / 2, y: e.y + c * n / 2 }, f = { x: o.x + l * r / 2, y: o.y + c * r / 2 }, m = { x: o.x - l * r / 2, y: o.y - c * r / 2 }, y = { x: e.x - l * n / 2, y: e.y - c * n / 2 };
  t.moveTo(u.x, u.y), t.lineTo(f.x, f.y), t.lineTo(m.x, m.y), t.lineTo(y.x, y.y), t.closePath();
}
function Nt(t, e) {
  const o = e.points.length, n = e.bulges.length === o, r = e.closed ? o : o - 1, s = e.dashPattern, i = new Path2D(), a = new Path2D();
  let l = !1, c = !1, u = 0, f = s.length === 0 ? 0 : s[0], m = !0;
  for (let y = 0; y < r; y++) {
    const M = e.points[y], x = e.points[(y + 1) % o], w = n ? e.bulges[y] : 0, b = e.startWidths[y], C = e.endWidths[y], B = [M];
    G(B, M, x, w);
    const T = B.length - 1;
    for (let k = 0; k < T; k++) {
      const P = B[k], v = B[k + 1], R = Math.hypot(v.x - P.x, v.y - P.y);
      if (R < 1e-12) continue;
      const Y = k / T, h = (k + 1) / T, d = b + (C - b) * Y, p = b + (C - b) * h;
      let g = 0;
      for (; g < R; ) {
        const S = s.length === 0 ? R : Math.min(f, R - g), A = g / R, D = (g + S) / R;
        if (m) {
          const X = { x: P.x + (v.x - P.x) * A, y: P.y + (v.y - P.y) * A }, L = { x: P.x + (v.x - P.x) * D, y: P.y + (v.y - P.y) * D }, q = d + (p - d) * A, V = d + (p - d) * D;
          q === 0 && V === 0 ? (i.moveTo(X.x, X.y), i.lineTo(L.x, L.y), l = !0) : (It(a, X, L, q, V), c = !0);
        }
        if (g += S, s.length === 0) break;
        f -= S, f <= 1e-9 && (u = (u + 1) % s.length, f = s[u], m = !m);
      }
    }
  }
  l && t.stroke(i), c && (t.fillStyle = I(e.color), t.fill(a, "nonzero"));
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
  const n = Math.cos(e.angleRad), r = Math.sin(e.angleRad), s = -r, i = n, a = e.basePoint, l = e.offset, c = (P, v, R, Y) => P * R + v * Y, u = c(l.x, l.y, s, i), f = c(l.x, l.y, n, r);
  if (Math.abs(u) < 1e-9) return;
  const m = [
    { x: o.minX, y: o.minY },
    { x: o.maxX, y: o.minY },
    { x: o.minX, y: o.maxY },
    { x: o.maxX, y: o.maxY }
  ];
  let y = 1 / 0, M = -1 / 0, x = 1 / 0, w = -1 / 0;
  for (const P of m) {
    const v = P.x - a.x, R = P.y - a.y;
    y = Math.min(y, c(v, R, s, i)), M = Math.max(M, c(v, R, s, i)), x = Math.min(x, c(v, R, n, r)), w = Math.max(w, c(v, R, n, r));
  }
  let b = Math.floor(y / u) - 1, C = Math.ceil(M / u) + 1;
  if (b > C && ([b, C] = [C, b]), C - b > 1e5) return;
  let B = 0;
  for (const P of e.dashPattern) B += Math.abs(P);
  const T = Math.max(B * 0.02, 1e-6), k = new Path2D();
  for (let P = b; P <= C; P++) {
    const v = a.x + s * (P * u), R = a.y + i * (P * u), Y = { x: v + n * x, y: R + r * x }, h = w - x;
    if (h <= 1e-9) continue;
    if (e.dashPattern.length === 0) {
      k.moveTo(Y.x, Y.y), k.lineTo(v + n * w, R + r * w);
      continue;
    }
    const d = P * f;
    let p = (x - d) % B;
    p < 0 && (p += B);
    let g = 0, S = 0;
    for (; g + 1 < e.dashPattern.length; g++) {
      const L = e.dashPattern[g] === 0 ? T : Math.abs(e.dashPattern[g]);
      if (p < S + L) break;
      S += L;
    }
    let A = S + (e.dashPattern[g] === 0 ? T : Math.abs(e.dashPattern[g])) - p, D = e.dashPattern[g] >= 0, X = 0;
    for (; X < h; ) {
      const L = Math.min(A, h - X);
      D && (k.moveTo(Y.x + n * X, Y.y + r * X), k.lineTo(Y.x + n * (X + L), Y.y + r * (X + L))), X += L, A -= L, A <= 1e-9 && (g = (g + 1) % e.dashPattern.length, A = e.dashPattern[g] === 0 ? T : Math.abs(e.dashPattern[g]), D = e.dashPattern[g] >= 0);
    }
  }
  t.stroke(k);
}
const Et = 5 / 3;
function et(t, e, o) {
  const n = Z(t, o) ?? (e ? Z(e, o) : void 0), r = (n ? n.advance : t.wordSpacing) + t.letterSpacing;
  return { glyph: n, advance: r };
}
function K(t, e, o) {
  let n = 0;
  for (const r of o) n += et(t, e, r.codePointAt(0) ?? 0).advance;
  return n;
}
function Gt(t, e, o, n, r, s, i) {
  const a = r / 9, l = r * o.lineSpacingFactor * Et, c = l * e.length;
  let u;
  switch (i) {
    case W.Top:
      u = r;
      break;
    case W.Middle:
      u = r - c / 2;
      break;
    case W.Bottom:
      u = r - c;
      break;
    default:
      u = 0;
  }
  const f = new Path2D();
  let m = u;
  for (const y of e) {
    let M = 0;
    s === E.Center ? M = -K(o, n, y) * a / 2 : s === E.Right && (M = -K(o, n, y) * a);
    let x = 0;
    for (const w of y) {
      const b = w.codePointAt(0) ?? 0, { glyph: C, advance: B } = et(o, n, b);
      if (C)
        for (const T of C.strokes)
          for (let k = 1; k < T.length; k++) {
            const P = T[k - 1], v = T[k];
            f.moveTo(M + (x + P.x) * a, m - P.y * a), f.lineTo(M + (x + v.x) * a, m - v.y * a);
          }
      x += B;
    }
    m += l;
  }
  t.stroke(f);
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
    t.strokeStyle = I(e.color), t.lineWidth = 1 / n, Gt(t, l, c, (r == null ? void 0 : r.fallbackFont) ?? null, a, e.textHAlign, e.textVAlign), t.restore();
    return;
  }
  t.font = `${a}px sans-serif`, t.fillStyle = I(e.color), t.textBaseline = "alphabetic", t.textAlign = e.textHAlign === E.Center ? "center" : e.textHAlign === E.Right ? "right" : "left";
  const u = t.measureText("Mgjy"), f = u.fontBoundingBoxAscent ?? a * 0.8, m = u.fontBoundingBoxDescent ?? a * 0.2, y = f + m, M = y * l.length;
  let x;
  switch (e.textVAlign) {
    case W.Top:
      x = f;
      break;
    case W.Middle:
      x = f - M / 2;
      break;
    case W.Bottom:
      x = f - M;
      break;
    default:
      x = 0;
  }
  let w = x;
  for (const b of l)
    t.fillText(b, 0, w), w += y;
  t.restore();
}
const $ = 48;
function Ot(t, e) {
  if (e.points.length !== 2) return;
  const [o, n] = e.points;
  e.dashPattern.length === 0 ? (t.beginPath(), t.moveTo(o.x, o.y), t.lineTo(n.x, n.y), t.stroke()) : z(t, [o, n], !1, e.dashPattern);
}
function $t(t, e) {
  if (e.dashPattern.length === 0) {
    t.beginPath(), t.ellipse(e.center.x, e.center.y, e.radius, e.radius, 0, 0, 2 * Math.PI), t.stroke();
    return;
  }
  const o = [];
  for (let n = 0; n < $; n++) {
    const r = 2 * Math.PI * n / $;
    o.push({ x: e.center.x + e.radius * Math.cos(r), y: e.center.y + e.radius * Math.sin(r) });
  }
  z(t, o, !0, e.dashPattern);
}
function zt(t, e) {
  let o = e.startAngleRad, n = e.endAngleRad;
  n < o && (n += 2 * Math.PI);
  const r = [];
  for (let s = 0; s <= $; s++) {
    const i = o + (n - o) * s / $;
    r.push({ x: e.center.x + e.radius * Math.cos(i), y: e.center.y + e.radius * Math.sin(i) });
  }
  z(t, r, !1, e.dashPattern);
}
function jt(t, e) {
  if (e.points.length < 2) return;
  const o = e.points.length;
  if (!(e.startWidths.length === o && e.endWidths.length === o)) {
    const r = Dt(e.points, e.bulges, e.closed);
    z(t, r, !1, e.dashPattern);
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
        t.fillStyle = I(e.color), t.fill(o, "evenodd");
        break;
      case O.Gradient: {
        const r = n.maxX - n.minX, s = n.maxY - n.minY, i = 0.5 * Math.hypot(r, s);
        if (i < 1e-9) {
          t.fillStyle = I(e.color), t.fill(o, "evenodd");
          break;
        }
        const a = n.minX + r / 2, l = n.minY + s / 2, c = Math.cos(e.hatchGradientAngleRad), u = Math.sin(e.hatchGradientAngleRad), f = t.createLinearGradient(
          a - c * i,
          l - u * i,
          a + c * i,
          l + u * i
        );
        f.addColorStop(0, I(e.color)), f.addColorStop(1, I(e.hatchColor2)), t.fillStyle = f, t.fill(o, "evenodd");
        break;
      }
      case O.Pattern: {
        t.save(), t.clip(o, "evenodd"), t.strokeStyle = I(e.color);
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
    switch (t.strokeStyle = I(c.color), c.kind) {
      case N.Line:
        Ot(t, c);
        break;
      case N.Circle:
        $t(t, c);
        break;
      case N.Arc:
        zt(t, c);
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
const Zt = /* @__PURE__ */ nt({
  __name: "DwgViewer",
  props: {
    source: {},
    fileName: {},
    fontsBaseUrl: {}
  },
  emits: ["loaded", "error"],
  setup(t, { expose: e, emit: o }) {
    const n = t, r = new wt(n.fontsBaseUrl), s = o, i = H(null), a = H(null), l = ot(null), c = H(!1), u = H(null);
    let f = null, m = !1, y = null, M = !1, x = 0, w = 0;
    const b = rt(() => c.value ? "Loading drawing…" : u.value ? u.value : !l.value || l.value.shapes.length === 0 ? "No drawing loaded" : null);
    function C() {
      const h = a.value;
      if (!h || !l.value) return;
      const d = l.value.boundingBox;
      if (!Ct(d)) return;
      const p = h.clientWidth, g = h.clientHeight;
      f = Xt(d, p, g), m = !0;
    }
    function B() {
      const h = a.value;
      if (!h) return;
      const d = h.getContext("2d");
      if (!d) return;
      d.setTransform(1, 0, 0, 1, 0, 0), d.fillStyle = "black", d.fillRect(0, 0, h.width, h.height);
      const p = b.value;
      if (p) {
        const S = window.devicePixelRatio || 1;
        d.setTransform(S, 0, 0, S, 0, 0), d.fillStyle = "gray", d.font = "14px sans-serif", d.textAlign = "center", d.textBaseline = "middle", d.fillText(p, h.clientWidth / 2, h.clientHeight / 2);
      }
      if (!l.value || !f || !m) return;
      d.imageSmoothingEnabled = !0;
      const g = window.devicePixelRatio || 1;
      Vt(d, l.value.shapes, { documentToScreen: f, pixelRatio: g, fonts: r });
    }
    function T(h, d) {
      const p = a.value, g = i.value;
      if (!p || !g) return;
      const S = Math.max(1, Math.floor(h ?? g.clientWidth)), A = Math.max(1, Math.floor(d ?? g.clientHeight)), D = window.devicePixelRatio || 1, X = Math.round(S * D), L = Math.round(A * D);
      p.width === X && p.height === L || (p.width = X, p.height = L, C(), B());
    }
    async function k() {
      const h = n.source;
      if (f = null, m = !1, l.value = null, u.value = null, !h) {
        B();
        return;
      }
      c.value = !0, B();
      try {
        let d, p;
        if (typeof h == "string") {
          const A = await fetch(h);
          if (!A.ok) throw new Error(`Failed to fetch ${h}: ${A.status}`);
          d = await A.arrayBuffer(), p = n.fileName ?? h;
        } else if (h instanceof File)
          d = await h.arrayBuffer(), p = n.fileName ?? h.name;
        else {
          if (d = h instanceof Uint8Array ? h.slice().buffer : h, !n.fileName)
            throw new Error("fileName prop is required when source is raw bytes (need it to tell .dxf from .dwg)");
          p = n.fileName;
        }
        const g = await St(d, p);
        if (g.errorMessage) {
          u.value = g.errorMessage, s("error", g.errorMessage);
          return;
        }
        const S = g.shapes.filter((A) => A.kind === N.Text).map((A) => A.fontFile);
        await r.preload(S), l.value = g, C(), s("loaded", g);
      } catch (d) {
        const p = d instanceof Error ? d.message : String(d);
        u.value = p, s("error", p);
      } finally {
        c.value = !1, B();
      }
    }
    function P(h) {
      if (!f || !m) return;
      h.preventDefault();
      const d = h.deltaY < 0 ? 1.15 : 1 / 1.15, p = a.value;
      if (!p) return;
      const g = p.getBoundingClientRect(), S = h.clientX - g.left, A = h.clientY - g.top;
      f = Lt(f, S, A, d), B();
    }
    function v(h) {
      h.button === 0 && (h.preventDefault(), M = !0, x = h.clientX, w = h.clientY, h.currentTarget.setPointerCapture(h.pointerId));
    }
    function R(h) {
      if (!M || !f) return;
      const d = h.clientX - x, p = h.clientY - w;
      x = h.clientX, w = h.clientY, f = Yt(f, d, p), B();
    }
    function Y(h) {
      h.button === 0 && (h.preventDefault(), M = !1);
    }
    return e({ zoomFit: () => {
      C(), B();
    } }), it(() => {
      y = new ResizeObserver((h) => {
        var d;
        for (const p of h) {
          const g = (d = p.contentBoxSize) == null ? void 0 : d[0];
          g ? T(g.inlineSize, g.blockSize) : T(p.contentRect.width, p.contentRect.height);
        }
      }), i.value && y.observe(i.value), T(), k();
    }), st(() => {
      y == null || y.disconnect();
    }), at(() => n.source, () => {
      k();
    }), (h, d) => (lt(), ct("div", {
      ref_key: "containerEl",
      ref: i,
      class: "dwg-viewer-root",
      style: { position: "relative", overflow: "hidden", width: "100%", height: "100%", minWidth: "200px", minHeight: "200px" }
    }, [
      ft("canvas", {
        ref_key: "canvasEl",
        ref: a,
        class: "dwg-viewer-canvas",
        style: { position: "absolute", inset: "0", width: "100%", height: "100%" },
        onWheel: P,
        onPointerdown: v,
        onPointermove: R,
        onPointerup: Y,
        onPointercancel: Y
      }, null, 544)
    ], 512));
  }
}), Jt = (t, e) => {
  const o = t.__vccOpts || t;
  for (const [n, r] of e)
    o[n] = r;
  return o;
}, Kt = /* @__PURE__ */ Jt(Zt, [["__scopeId", "data-v-fc590a06"]]);
export {
  Kt as DwgViewer,
  O as HatchFillKind,
  N as ShapeKind,
  E as TextHAlign,
  W as TextVAlign,
  Xt as computeZoomFitTransform,
  Ct as isValidBoundingBox,
  Yt as panByScreenDelta,
  St as parseDrawing,
  Vt as renderShapes,
  Lt as zoomAroundPoint
};
