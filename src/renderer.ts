// Direct, mechanical port of dwgviewer's src/viewer_widget.cpp -- the QPainter
// drawing logic and its wheel-zoom/pan transform math, reimplemented against
// Canvas2D/DOMMatrix. Comments here call out the C++ counterpart for each
// piece; anything not explained is the same math translated line-for-line.
import type { FontCache } from './fontLoader';
import { findGlyph, type LffFont } from './lffFont';
import {
  type BoundingBox,
  type HatchLoop,
  type HatchPatternLine,
  HatchFillKind,
  type Point2D,
  type RgbColor,
  type Shape,
  ShapeKind,
  TextHAlign,
  TextVAlign,
} from './types';

function rgbToCss(c: RgbColor): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}

// --- documentToScreen transform -------------------------------------------
//
// Both QTransform (row-vector convention) and DOMMatrix (column-vector
// convention, post-multiplying .translate()/.scale() calls) happen to
// produce the same net point-mapping order when the same sequence of
// translate/scale calls is replayed -- see the design notes in this
// project's PR/commit history for the derivation. Practically: every
// function below just replays viewer_widget.cpp's QTransform call sequence
// verbatim against a DOMMatrix and gets the identical transform.

const DEFAULT_MARGIN_PX = 20;

/** Port of ViewerWidget::zoomFit(). */
export function computeZoomFitTransform(
  bbox: BoundingBox,
  canvasWidth: number,
  canvasHeight: number,
  marginPx = DEFAULT_MARGIN_PX,
): DOMMatrix {
  const availW = Math.max(1, canvasWidth - 2 * marginPx);
  const availH = Math.max(1, canvasHeight - 2 * marginPx);

  let bboxW = bbox.maxX - bbox.minX;
  let bboxH = bbox.maxY - bbox.minY;
  // Guard degenerate drawings (a single point, or a perfectly
  // horizontal/vertical line) so we don't divide by zero.
  if (bboxW < 1e-9) bboxW = bboxH > 1e-9 ? bboxH : 1;
  if (bboxH < 1e-9) bboxH = bboxW;

  const scale = Math.min(availW / bboxW, availH / bboxH);
  const offsetX = marginPx + (availW - bboxW * scale) / 2;
  const offsetY = marginPx + (availH + bboxH * scale) / 2;

  return new DOMMatrix()
    .translate(offsetX, offsetY)
    .scale(scale, -scale) // flip Y: drawing is Y-up, screen is Y-down
    .translate(-bbox.minX, -bbox.minY);
}

/** Port of ViewerWidget::wheelEvent()'s zoom-around-cursor math. */
export function zoomAroundPoint(transform: DOMMatrix, cursorX: number, cursorY: number, factor: number): DOMMatrix {
  const cursorDoc = transform.inverse().transformPoint(new DOMPoint(cursorX, cursorY));
  return transform
    .translate(cursorDoc.x, cursorDoc.y)
    .scale(factor, factor)
    .translate(-cursorDoc.x, -cursorDoc.y);
}

/**
 * Port of ViewerWidget::mouseMoveEvent()'s pan math: `documentToScreen_ *
 * QTransform::fromTranslate(delta)`. Applying an existing transform first
 * and then shifting the *result* by a screen-space delta is just adding
 * that delta to the transform's own translation component (e/f) -- see the
 * C++ comment on mouseMoveEvent for why this order (not the reverse) is the
 * one that gives 1:1 screen-space panning independent of zoom level.
 */
export function panByScreenDelta(transform: DOMMatrix, dx: number, dy: number): DOMMatrix {
  return new DOMMatrix([transform.a, transform.b, transform.c, transform.d, transform.e + dx, transform.f + dy]);
}

// --- geometry sampling (bulges, arcs) --------------------------------------

interface ArcParams {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/** Port of the anonymous-namespace bulgeToArc() in viewer_widget.cpp. */
function bulgeToArc(p1: Point2D, p2: Point2D, bulge: number): ArcParams | null {
  if (Math.abs(bulge) < 1e-9) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 1e-9) return null;

  const sign = bulge >= 0 ? 1 : -1;
  const halfAngle = 2 * Math.atan(Math.abs(bulge));
  const radius = chordLen / 2 / Math.sin(halfAngle);

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const perpX = (sign > 0 ? -dy : dy) / chordLen;
  const perpY = (sign > 0 ? dx : -dx) / chordLen;
  const distToCenter = radius * Math.cos(halfAngle);
  const center = { x: midX + perpX * distToCenter, y: midY + perpY * distToCenter };

  let startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  let endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
  if (sign > 0) {
    if (endAngle < startAngle) endAngle += 2 * Math.PI;
  } else if (endAngle > startAngle) {
    endAngle -= 2 * Math.PI;
  }
  return { center, radius, startAngle, endAngle };
}

/** Port of sampleSegmentPoints(): appends p2 (straight) or a sampled arc. */
function sampleSegmentPoints(pts: Point2D[], p1: Point2D, p2: Point2D, bulge: number): void {
  const arc = bulgeToArc(p1, p2, bulge);
  if (!arc) {
    pts.push(p2);
    return;
  }
  const { center, radius, startAngle, endAngle } = arc;
  const sweep = endAngle - startAngle;
  const segments = Math.min(64, Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 24))));
  for (let i = 1; i <= segments; i++) {
    const t = startAngle + (sweep * i) / segments;
    pts.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
  }
}

function samplePolylinePoints(points: Point2D[], bulges: number[], closed: boolean): Point2D[] {
  const n = points.length;
  const hasBulges = bulges.length === n;
  const pts: Point2D[] = [points[0]];
  for (let i = 1; i < n; i++) {
    sampleSegmentPoints(pts, points[i - 1], points[i], hasBulges ? bulges[i - 1] : 0);
  }
  if (closed) {
    sampleSegmentPoints(pts, points[n - 1], points[0], hasBulges ? bulges[n - 1] : 0);
  }
  return pts;
}

// --- stroking (solid + dashed) ---------------------------------------------

/**
 * Port of drawStroke(): dash resolution happens in document space by
 * walking cumulative distance along the polyline, same reasoning as the
 * C++ comment -- QPen/CSS dash arrays are relative to line width, which has
 * no meaning for a cosmetic (always-1-device-pixel) stroke.
 */
function strokePolyline(ctx: CanvasRenderingContext2D, pts: Point2D[], closed: boolean, dashPattern: number[]): void {
  if (pts.length < 2) return;

  if (dashPattern.length === 0) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (closed) ctx.closePath();
    ctx.stroke();
    return;
  }

  const path = new Path2D();
  let patternIdx = 0;
  let remaining = dashPattern[0]; // dashPattern[0] is always a dash (see resolveEntityLineType)
  let on = true;

  const segCount = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-12) continue;
    let segPos = 0;
    while (segPos < segLen) {
      const step = Math.min(remaining, segLen - segPos);
      const t0 = segPos / segLen;
      const t1 = (segPos + step) / segLen;
      if (on) {
        path.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0);
        path.lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
      segPos += step;
      remaining -= step;
      if (remaining <= 1e-9) {
        patternIdx = (patternIdx + 1) % dashPattern.length;
        remaining = dashPattern[patternIdx];
        on = !on;
      }
    }
  }
  ctx.stroke(path);
}

/** Port of appendStraightBand(): a filled trapezoid from p1 to p2. */
function appendStraightBand(path: Path2D, p1: Point2D, p2: Point2D, w1: number, w2: number): void {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return;
  const perpX = -dy / len;
  const perpY = dx / len;
  const left1 = { x: p1.x + (perpX * w1) / 2, y: p1.y + (perpY * w1) / 2 };
  const left2 = { x: p2.x + (perpX * w2) / 2, y: p2.y + (perpY * w2) / 2 };
  const right2 = { x: p2.x - (perpX * w2) / 2, y: p2.y - (perpY * w2) / 2 };
  const right1 = { x: p1.x - (perpX * w1) / 2, y: p1.y - (perpY * w1) / 2 };
  path.moveTo(left1.x, left1.y);
  path.lineTo(left2.x, left2.y);
  path.lineTo(right2.x, right2.y);
  path.lineTo(right1.x, right1.y);
  path.closePath();
}

/** Port of drawWidthAwarePolyline(). */
function drawWidthAwarePolyline(ctx: CanvasRenderingContext2D, s: Shape): void {
  const n = s.points.length;
  const hasBulges = s.bulges.length === n;
  const segCount = s.closed ? n : n - 1;
  const dash = s.dashPattern;

  const strokePath = new Path2D(); // zero-width dash "on" intervals
  const fillPath = new Path2D(); // nonzero-width dash "on" intervals
  let anyStroke = false;
  let anyFill = false;

  let patternIdx = 0;
  let remaining = dash.length === 0 ? 0 : dash[0];
  let on = true;

  for (let i = 0; i < segCount; i++) {
    const p1 = s.points[i];
    const p2 = s.points[(i + 1) % n];
    const bulge = hasBulges ? s.bulges[i] : 0;
    const w1 = s.startWidths[i];
    const w2 = s.endWidths[i];

    const pts: Point2D[] = [p1];
    sampleSegmentPoints(pts, p1, p2, bulge);
    const subCount = pts.length - 1;

    for (let k = 0; k < subCount; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen < 1e-12) continue;
      const ta = k / subCount;
      const tb = (k + 1) / subCount;
      const wa = w1 + (w2 - w1) * ta;
      const wb = w1 + (w2 - w1) * tb;

      let segPos = 0;
      while (segPos < segLen) {
        const step = dash.length === 0 ? segLen : Math.min(remaining, segLen - segPos);
        const u0 = segPos / segLen;
        const u1 = (segPos + step) / segLen;
        if (on) {
          const sa = { x: a.x + (b.x - a.x) * u0, y: a.y + (b.y - a.y) * u0 };
          const sb = { x: a.x + (b.x - a.x) * u1, y: a.y + (b.y - a.y) * u1 };
          const swid = wa + (wb - wa) * u0;
          const ewid = wa + (wb - wa) * u1;
          if (swid === 0 && ewid === 0) {
            strokePath.moveTo(sa.x, sa.y);
            strokePath.lineTo(sb.x, sb.y);
            anyStroke = true;
          } else {
            appendStraightBand(fillPath, sa, sb, swid, ewid);
            anyFill = true;
          }
        }
        segPos += step;
        if (dash.length === 0) break;
        remaining -= step;
        if (remaining <= 1e-9) {
          patternIdx = (patternIdx + 1) % dash.length;
          remaining = dash[patternIdx];
          on = !on;
        }
      }
    }
  }

  if (anyStroke) ctx.stroke(strokePath);
  if (anyFill) {
    ctx.fillStyle = rgbToCss(s.color);
    ctx.fill(fillPath, 'nonzero');
  }
}

// --- hatch ------------------------------------------------------------------

function sampleHatchLoop(loop: HatchLoop): Point2D[] {
  const n = loop.points.length;
  if (n < 2) return [];
  const hasBulges = loop.bulges.length === n;
  const pts: Point2D[] = [loop.points[0]];
  for (let i = 1; i < n; i++) {
    sampleSegmentPoints(pts, loop.points[i - 1], loop.points[i], hasBulges ? loop.bulges[i - 1] : 0);
  }
  sampleSegmentPoints(pts, loop.points[n - 1], loop.points[0], hasBulges ? loop.bulges[n - 1] : 0);
  return pts;
}

interface HatchPathResult {
  path: Path2D;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** Port of buildHatchPath(). Canvas has no Path2D.boundingRect(), so bounds are accumulated from the sampled points alongside the path. */
function buildHatchPath(loops: HatchLoop[]): HatchPathResult {
  const path = new Path2D();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    const pts = sampleHatchLoop(loop);
    if (pts.length < 2) continue;
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      path.lineTo(pts[i].x, pts[i].y);
      minX = Math.min(minX, pts[i].x);
      minY = Math.min(minY, pts[i].y);
      maxX = Math.max(maxX, pts[i].x);
      maxY = Math.max(maxY, pts[i].y);
    }
    minX = Math.min(minX, pts[0].x);
    minY = Math.min(minY, pts[0].y);
    maxX = Math.max(maxX, pts[0].x);
    maxY = Math.max(maxY, pts[0].y);
    path.closePath();
  }
  return { path, bounds: { minX, minY, maxX, maxY } };
}

/** Port of drawHatchPatternLine(). `bounds` is in document space, same as the C++ version's clip-rect reasoning: reach past it in both directions and let the caller's clip do the rest. */
function drawHatchPatternLine(
  ctx: CanvasRenderingContext2D,
  pl: HatchPatternLine,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): void {
  const dirX = Math.cos(pl.angleRad);
  const dirY = Math.sin(pl.angleRad);
  const perpX = -dirY;
  const perpY = dirX;
  const base = pl.basePoint;
  const offset = pl.offset;

  const dot = (ax: number, ay: number, bx: number, by: number) => ax * bx + ay * by;

  const spacing = dot(offset.x, offset.y, perpX, perpY);
  const phaseShift = dot(offset.x, offset.y, dirX, dirY);
  if (Math.abs(spacing) < 1e-9) return;

  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  let minPerp = Infinity;
  let maxPerp = -Infinity;
  let minAlong = Infinity;
  let maxAlong = -Infinity;
  for (const c of corners) {
    const relX = c.x - base.x;
    const relY = c.y - base.y;
    minPerp = Math.min(minPerp, dot(relX, relY, perpX, perpY));
    maxPerp = Math.max(maxPerp, dot(relX, relY, perpX, perpY));
    minAlong = Math.min(minAlong, dot(relX, relY, dirX, dirY));
    maxAlong = Math.max(maxAlong, dot(relX, relY, dirX, dirY));
  }

  let kMin = Math.floor(minPerp / spacing) - 1;
  let kMax = Math.ceil(maxPerp / spacing) + 1;
  if (kMin > kMax) [kMin, kMax] = [kMax, kMin];
  if (kMax - kMin > 100000) return; // corrupt/degenerate spacing -- bail rather than hang

  let patternTotal = 0;
  for (const d of pl.dashPattern) patternTotal += Math.abs(d);
  const dotLen = Math.max(patternTotal * 0.02, 1e-6);

  const path = new Path2D();
  for (let k = kMin; k <= kMax; k++) {
    const rowBaseX = base.x + perpX * (k * spacing);
    const rowBaseY = base.y + perpY * (k * spacing);
    const p0 = { x: rowBaseX + dirX * minAlong, y: rowBaseY + dirY * minAlong };
    const segLen = maxAlong - minAlong;
    if (segLen <= 1e-9) continue;

    if (pl.dashPattern.length === 0) {
      path.moveTo(p0.x, p0.y);
      path.lineTo(rowBaseX + dirX * maxAlong, rowBaseY + dirY * maxAlong);
      continue;
    }

    const rowBaseAlong = k * phaseShift;
    let phase = (minAlong - rowBaseAlong) % patternTotal;
    if (phase < 0) phase += patternTotal;

    let idx = 0;
    let acc = 0;
    for (; idx + 1 < pl.dashPattern.length; idx++) {
      const len = pl.dashPattern[idx] === 0 ? dotLen : Math.abs(pl.dashPattern[idx]);
      if (phase < acc + len) break;
      acc += len;
    }
    let remaining = acc + (pl.dashPattern[idx] === 0 ? dotLen : Math.abs(pl.dashPattern[idx])) - phase;
    let on = pl.dashPattern[idx] >= 0;

    let pos = 0;
    while (pos < segLen) {
      const step = Math.min(remaining, segLen - pos);
      if (on) {
        path.moveTo(p0.x + dirX * pos, p0.y + dirY * pos);
        path.lineTo(p0.x + dirX * (pos + step), p0.y + dirY * (pos + step));
      }
      pos += step;
      remaining -= step;
      if (remaining <= 1e-9) {
        idx = (idx + 1) % pl.dashPattern.length;
        remaining = pl.dashPattern[idx] === 0 ? dotLen : Math.abs(pl.dashPattern[idx]);
        on = pl.dashPattern[idx] >= 0;
      }
    }
  }
  ctx.stroke(path);
}

// --- text --------------------------------------------------------------
//
// Port of viewer_widget.cpp's "LFF stroke-font resolution" + Text paint
// case. Only entities whose STYLE table names a font this project ships a
// .lff for (resources/fonts/*.lff, resolved via fontLoader.ts's FontCache)
// take the stroke-font path below; everything else (no STYLE override, or
// one naming e.g. a TTF font) falls through to the browser's own font
// rendering exactly as before LFF support existed.

// AutoCAD/LibreCAD's MTEXT line-spacing-factor 1.0 corresponds to roughly
// 5/3 of the text height between baselines ("exact" spacing) -- there's no
// per-font metric for this in the .lff format itself (unlike LetterSpacing/
// WordSpacing), so this is a fixed approximation shared by every LFF font,
// matching kLffLineSpacingRatio in viewer_widget.cpp.
const LFF_LINE_SPACING_RATIO = 5 / 3;

/** Port of lffStepGlyph(): looks up `cp` in `font`, then `fallback`, returning this character's advance (font design units, already includes `font`'s own LetterSpacing) regardless of whether a glyph was found. */
function lffStepGlyph(
  font: LffFont,
  fallback: LffFont | null,
  cp: number,
): { glyph: ReturnType<typeof findGlyph>; advance: number } {
  const glyph = findGlyph(font, cp) ?? (fallback ? findGlyph(fallback, cp) : undefined);
  const advance = (glyph ? glyph.advance : font.wordSpacing) + font.letterSpacing;
  return { glyph, advance };
}

/** Port of lffLineWidth(). */
function lffLineWidth(font: LffFont, fallback: LffFont | null, line: string): number {
  let width = 0;
  for (const ch of line) width += lffStepGlyph(font, fallback, ch.codePointAt(0) ?? 0).advance;
  return width;
}

/**
 * Port of drawLffTextLines(): draws `lines` (already split on '\n') using
 * `font` (falling back to `fallback` per-glyph) into the ctx's *current*
 * local transform -- caller has already translated/rotated to the text
 * entity's anchor exactly like the browser-font path below, so this only
 * needs to place glyphs relative to that origin. `capHeightPx` is the
 * on-screen pixel size of the font's 9-design-unit cap height.
 */
function drawLffTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  font: LffFont,
  fallback: LffFont | null,
  capHeightPx: number,
  hAlign: TextHAlign,
  vAlign: TextVAlign,
): void {
  const scale = capHeightPx / 9;
  const linePitchPx = capHeightPx * font.lineSpacingFactor * LFF_LINE_SPACING_RATIO;
  const blockHeight = linePitchPx * lines.length;

  let firstBaselineY: number;
  switch (vAlign) {
    case TextVAlign.Top:
      firstBaselineY = capHeightPx;
      break;
    case TextVAlign.Middle:
      firstBaselineY = capHeightPx - blockHeight / 2;
      break;
    case TextVAlign.Bottom:
      firstBaselineY = capHeightPx - blockHeight;
      break;
    default:
      firstBaselineY = 0;
  }

  const path = new Path2D();
  let y = firstBaselineY;
  for (const line of lines) {
    let startX = 0;
    if (hAlign === TextHAlign.Center) startX = (-lffLineWidth(font, fallback, line) * scale) / 2;
    else if (hAlign === TextHAlign.Right) startX = -lffLineWidth(font, fallback, line) * scale;

    let penX = 0;
    for (const ch of line) {
      const cp = ch.codePointAt(0) ?? 0;
      const { glyph, advance } = lffStepGlyph(font, fallback, cp);
      if (glyph) {
        // Glyph coordinates are Y-up (baseline at y=0, caps extend to
        // y=+9) but this local transform still follows Canvas2D's own
        // Y-down convention (only documentToScreen carries a flip, and
        // Text deliberately never composes with it -- see drawText) -- so
        // each point's Y must be negated here, the same "flip glyphs
        // explicitly, don't inherit one" rule.
        for (const stroke of glyph.strokes) {
          for (let i = 1; i < stroke.length; i++) {
            const a = stroke[i - 1];
            const b = stroke[i];
            path.moveTo(startX + (penX + a.x) * scale, y - a.y * scale);
            path.lineTo(startX + (penX + b.x) * scale, y - b.y * scale);
          }
        }
      }
      penX += advance;
    }
    y += linePitchPx;
  }
  ctx.stroke(path);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  s: Shape,
  documentToScreen: DOMMatrix,
  pixelRatio: number,
  fonts: FontCache | undefined,
): void {
  if (!s.text) return;
  const pixelsPerUnit = Math.abs(documentToScreen.a);
  if (pixelsPerUnit <= 0) return;

  const originScreen = documentToScreen.transformPoint(new DOMPoint(s.center.x, s.center.y));
  let pixelHeight = Math.round(s.textHeightDoc * pixelsPerUnit);
  if (pixelHeight < 1) pixelHeight = 1;

  // documentToScreen has a Y-flip baked in (see zoomFit); drawing glyphs
  // through it directly would mirror them, same class of bug the C++ file
  // avoids by never calling QPainter::drawArc(). So text gets its own
  // from-scratch screen-space transform (translate + rotate + a plain
  // positive scale via the font's pixel size), matching viewer_widget.cpp's
  // Text case exactly.
  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.translate(originScreen.x, originScreen.y);
  ctx.rotate(-s.textAngleRad);

  const lines = s.text.split('\n');
  const lffFont = fonts?.fontFor(s.fontFile) ?? null;
  if (lffFont) {
    ctx.strokeStyle = rgbToCss(s.color);
    ctx.lineWidth = 1 / pixelRatio; // cosmetic: always ~1 device pixel, matching the rest of the renderer
    drawLffTextLines(ctx, lines, lffFont, fonts?.fallbackFont ?? null, pixelHeight, s.textHAlign, s.textVAlign);
    ctx.restore();
    return;
  }

  ctx.font = `${pixelHeight}px sans-serif`;
  ctx.fillStyle = rgbToCss(s.color);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = s.textHAlign === TextHAlign.Center ? 'center' : s.textHAlign === TextHAlign.Right ? 'right' : 'left';

  const metrics = ctx.measureText('Mgjy');
  const ascent = metrics.fontBoundingBoxAscent ?? pixelHeight * 0.8;
  const descent = metrics.fontBoundingBoxDescent ?? pixelHeight * 0.2;
  const linePitch = ascent + descent;
  const blockHeight = linePitch * lines.length;

  let firstBaselineY: number;
  switch (s.textVAlign) {
    case TextVAlign.Top:
      firstBaselineY = ascent;
      break;
    case TextVAlign.Middle:
      firstBaselineY = ascent - blockHeight / 2;
      break;
    case TextVAlign.Bottom:
      firstBaselineY = ascent - blockHeight;
      break;
    default:
      firstBaselineY = 0;
  }

  let y = firstBaselineY;
  for (const line of lines) {
    ctx.fillText(line, 0, y);
    y += linePitch;
  }
  ctx.restore();
}

// --- top-level shape dispatch (port of ViewerWidget::paintEvent's switch) --

const ARC_SEGMENTS = 48;

function drawLine(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.points.length !== 2) return;
  const [p0, p1] = s.points;
  if (s.dashPattern.length === 0) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  } else {
    strokePolyline(ctx, [p0, p1], false, s.dashPattern);
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.dashPattern.length === 0) {
    ctx.beginPath();
    ctx.ellipse(s.center.x, s.center.y, s.radius, s.radius, 0, 0, 2 * Math.PI);
    ctx.stroke();
    return;
  }
  const pts: Point2D[] = [];
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    const t = (2 * Math.PI * i) / ARC_SEGMENTS;
    pts.push({ x: s.center.x + s.radius * Math.cos(t), y: s.center.y + s.radius * Math.sin(t) });
  }
  strokePolyline(ctx, pts, true, s.dashPattern);
}

function drawArc(ctx: CanvasRenderingContext2D, s: Shape): void {
  // Deliberately not ctx.arc(): its angle convention is in the CURRENT
  // transform's local space, and under our Y-flipped transform that
  // silently mirrors which half of the circle is drawn -- same trap as
  // QPainter::drawArc() the C++ code documents. Sample with plain
  // trig instead.
  let start = s.startAngleRad;
  let end = s.endAngleRad;
  if (end < start) end += 2 * Math.PI;
  const pts: Point2D[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const t = start + ((end - start) * i) / ARC_SEGMENTS;
    pts.push({ x: s.center.x + s.radius * Math.cos(t), y: s.center.y + s.radius * Math.sin(t) });
  }
  strokePolyline(ctx, pts, false, s.dashPattern);
}

function drawPolyline(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.points.length < 2) return;
  const n = s.points.length;
  const hasWidths = s.startWidths.length === n && s.endWidths.length === n;
  if (!hasWidths) {
    const pts = samplePolylinePoints(s.points, s.bulges, s.closed);
    // The closing edge, if any, is already sampled into pts above -- pass
    // closed=false so strokePolyline doesn't also add its own implicit
    // (always-straight) closing segment on top.
    strokePolyline(ctx, pts, false, s.dashPattern);
    return;
  }
  drawWidthAwarePolyline(ctx, s);
}

function drawHatch(ctx: CanvasRenderingContext2D, s: Shape): void {
  if (s.hatchLoops.length === 0) return;
  const { path, bounds } = buildHatchPath(s.hatchLoops);
  if (!Number.isFinite(bounds.minX)) return;

  switch (s.hatchFillKind) {
    case HatchFillKind.Solid:
      ctx.fillStyle = rgbToCss(s.color);
      ctx.fill(path, 'evenodd');
      break;
    case HatchFillKind.Gradient: {
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const halfDiag = 0.5 * Math.hypot(width, height);
      if (halfDiag < 1e-9) {
        ctx.fillStyle = rgbToCss(s.color);
        ctx.fill(path, 'evenodd');
        break;
      }
      const cx = bounds.minX + width / 2;
      const cy = bounds.minY + height / 2;
      const dirX = Math.cos(s.hatchGradientAngleRad);
      const dirY = Math.sin(s.hatchGradientAngleRad);
      const grad = ctx.createLinearGradient(
        cx - dirX * halfDiag,
        cy - dirY * halfDiag,
        cx + dirX * halfDiag,
        cy + dirY * halfDiag,
      );
      grad.addColorStop(0, rgbToCss(s.color));
      grad.addColorStop(1, rgbToCss(s.hatchColor2));
      ctx.fillStyle = grad;
      ctx.fill(path, 'evenodd');
      break;
    }
    case HatchFillKind.Pattern: {
      ctx.save();
      ctx.clip(path, 'evenodd');
      ctx.strokeStyle = rgbToCss(s.color);
      for (const pl of s.hatchPatternLines) drawHatchPatternLine(ctx, pl, bounds);
      ctx.restore();
      break;
    }
  }
}

export interface Viewport {
  /** Doc-space -> CSS-pixel-space transform, as produced by computeZoomFitTransform/zoomAroundPoint/panByScreenDelta. */
  documentToScreen: DOMMatrix;
  /** devicePixelRatio the canvas's backing store is scaled by; 1 if the caller already sized the canvas in device pixels. */
  pixelRatio: number;
  /** Resolved (see FontCache.preload) LFF stroke fonts for this drawing's Text shapes. Omitted/no matching font -> falls back to the browser's own font rendering, same as before LFF support existed. */
  fonts?: FontCache;
}

/** Port of ViewerWidget::paintEvent()'s shape loop. Caller owns clearing/filling the background. */
export function renderShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], viewport: Viewport): void {
  const { documentToScreen, pixelRatio, fonts } = viewport;
  const full = new DOMMatrix([pixelRatio, 0, 0, pixelRatio, 0, 0]).multiply(documentToScreen);
  ctx.setTransform(full);

  const pixelsPerUnit = Math.abs(documentToScreen.a);
  const cosmeticWidth = pixelsPerUnit > 0 ? 1 / pixelsPerUnit : 1;
  ctx.lineWidth = cosmeticWidth; // cosmetic: always ~1 device pixel, regardless of zoom

  for (const s of shapes) {
    ctx.strokeStyle = rgbToCss(s.color);
    switch (s.kind) {
      case ShapeKind.Line:
        drawLine(ctx, s);
        break;
      case ShapeKind.Circle:
        drawCircle(ctx, s);
        break;
      case ShapeKind.Arc:
        drawArc(ctx, s);
        break;
      case ShapeKind.Polyline:
        drawPolyline(ctx, s);
        break;
      case ShapeKind.Text:
        drawText(ctx, s, documentToScreen, pixelRatio, fonts);
        break;
      case ShapeKind.Hatch:
        drawHatch(ctx, s);
        break;
    }
    // Shape cases (Text, Hatch/Pattern) that save()/restore() or otherwise
    // touch the transform/lineWidth always restore it themselves -- reset
    // defensively anyway so one shape's state never leaks into the next.
    ctx.setTransform(full);
    ctx.lineWidth = cosmeticWidth;
  }
}
