// Direct, mechanical port of dwgviewer's src/lff_font.h/.cpp -- parses
// LibreCAD's ".lff" stroke-font format (plain text, one section per glyph
// keyed by a hex Unicode codepoint, each glyph a set of pen-up-separated
// strokes of line/arc segments) into glyph outlines the renderer can stroke
// directly, exactly like ViewerWidget does with QPainter. Kept independent
// of Vue/Canvas (same reasoning as dwg_document.h's Shape/Point2D staying
// Qt-free) even though its only current caller is renderer.ts, since
// parsing a font file has nothing to do with painting one. Unlike the C++
// version, this parses an already-fetched string rather than opening a file
// itself -- fetching is fontLoader.ts's job (a browser has no filesystem to
// scan next to an executable).

import type { Point2D } from './types';

// One glyph's geometry: independent strokes (pen-up between them), each
// already flattened to a plain polyline in the font's own design units --
// an "Abulge" suffix on a raw .lff point (same tan(includedAngle/4)
// convention as Shape::bulges) means the segment ending at that point is an
// arc, sampled once here at parse time rather than per-paint, since a
// font's glyphs are parsed once and reused for every occurrence of that
// character.
export interface LffGlyph {
  strokes: Point2D[][];
  // This glyph's own natural width (max X across all its flattened points),
  // NOT yet plus the font's letterSpacing -- callers add that separately
  // between consecutive glyphs, matching how LibreCAD's own .lff renderer
  // separates "how wide is this glyph" from "how much gap goes between
  // glyphs".
  advance: number;
}

// One parsed .lff font. Glyph coordinates are in the format's own design
// units, where a capital letter's cap height is normalized to 9 units --
// matches every sampled glyph in resources/fonts/iso.lff (e.g. 'A' spans
// y=[0,9], baseline at y=0) -- so callers scale by textHeightDoc / 9.
export interface LffFont {
  glyphs: Map<number, LffGlyph>;
  // Header metadata read from the file's own "# LetterSpacing:" /
  // "# WordSpacing:" / "# LineSpacingFactor:" comment lines, already in the
  // same design units as glyph coordinates. Defaults match what a font with
  // no such comment (or an unparseable value) should fall back to.
  letterSpacing: number;
  wordSpacing: number;
  lineSpacingFactor: number;
}

export function findGlyph(font: LffFont, codepoint: number): LffGlyph | undefined {
  return font.glyphs.get(codepoint);
}

// One raw (unflattened) point from a stroke line, e.g. "1.6125,8,A-0.8": x,
// y, and an optional bulge (the "Abulge" suffix) for the segment ending at
// this point -- see LffGlyph's comment on the bulge convention.
interface RawPoint {
  x: number;
  y: number;
  hasBulge: boolean;
  bulge: number;
}

function parsePoint(token: string): RawPoint | null {
  const comma1 = token.indexOf(',');
  if (comma1 === -1) return null;
  const comma2 = token.indexOf(',', comma1 + 1);
  const x = Number(token.slice(0, comma1));
  if (!Number.isFinite(x)) return null;
  if (comma2 === -1) {
    const y = Number(token.slice(comma1 + 1));
    if (!Number.isFinite(y)) return null;
    return { x, y, hasBulge: false, bulge: 0 };
  }
  const y = Number(token.slice(comma1 + 1, comma2));
  if (!Number.isFinite(y)) return null;
  const bulgeToken = token.slice(comma2 + 1);
  if (bulgeToken.length > 0 && (bulgeToken[0] === 'A' || bulgeToken[0] === 'a')) {
    const bulge = Number(bulgeToken.slice(1));
    if (Number.isFinite(bulge)) return { x, y, hasBulge: true, bulge };
  }
  return { x, y, hasBulge: false, bulge: 0 };
}

interface ArcParams {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

// Same chord+bulge -> center/radius/start+end-angle conversion as
// renderer.ts's bulgeToArc(). Deliberately not shared with it -- pulling a
// document-geometry helper into a font parser (or vice versa) for one small
// trig function isn't worth the cross-module coupling, same reasoning as
// the C++ original.
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
  const perpX = sign > 0 ? -dy : dy;
  const perpY = sign > 0 ? dx : -dx;
  const perpLen = Math.hypot(perpX, perpY);
  const distToCenter = radius * Math.cos(halfAngle);
  const center = { x: midX + (perpX / perpLen) * distToCenter, y: midY + (perpY / perpLen) * distToCenter };

  let startAngle = Math.atan2(p1.y - center.y, p1.x - center.x);
  let endAngle = Math.atan2(p2.y - center.y, p2.x - center.x);
  if (sign > 0) {
    if (endAngle < startAngle) endAngle += 2 * Math.PI;
  } else if (endAngle > startAngle) {
    endAngle -= 2 * Math.PI;
  }
  return { center, radius, startAngle, endAngle };
}

// Appends the flattened segment from p1 to p2 to `out` (p1 itself excluded
// -- the caller's array already ends with it): a straight line if `bulge`
// is ~0, otherwise a sampled arc.
function appendSegment(out: Point2D[], p1: Point2D, p2: Point2D, bulge: number): void {
  const arc = bulgeToArc(p1, p2, bulge);
  if (!arc) {
    out.push(p2);
    return;
  }
  const { center, radius, startAngle, endAngle } = arc;
  const sweep = endAngle - startAngle;
  const segments = Math.min(64, Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 24))));
  for (let i = 1; i <= segments; i++) {
    const t = startAngle + (sweep * i) / segments;
    out.push({ x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) });
  }
}

// Parses one stroke line (semicolon-separated points) into a flattened
// polyline. Malformed tokens are skipped rather than aborting the whole
// glyph -- a single bad point in a hand-edited font file shouldn't blank
// out an otherwise-fine character.
function parseStroke(line: string): Point2D[] {
  const raw: RawPoint[] = [];
  for (const token of line.split(';')) {
    const p = parsePoint(token);
    if (p) raw.push(p);
  }
  const flat: Point2D[] = [];
  if (raw.length === 0) return flat;
  flat.push({ x: raw[0].x, y: raw[0].y });
  for (let i = 1; i < raw.length; i++) {
    appendSegment(flat, { x: raw[i - 1].x, y: raw[i - 1].y }, { x: raw[i].x, y: raw[i].y }, raw[i].hasBulge ? raw[i].bulge : 0);
  }
  return flat;
}

// One entry in a glyph's not-yet-resolved definition: either a literal
// flattened stroke, or a "compose from" reference (an LFF line that's just
// "C" + a hex codepoint, e.g. "C0043") -- LibreCAD's accented-Latin glyphs
// (Ç, É, Ã, ...) are defined as their plain base letter plus a couple of
// extra strokes for the diacritic, rather than duplicating the whole
// letter's geometry for every accented variant.
interface RawGlyphEntry {
  isComposeRef: boolean;
  composeRef: number;
  stroke: Point2D[]; // valid when !isComposeRef
}

// True if `line` is exactly "C" followed by one or more hex digits and
// nothing else -- the composition-reference form. Every real stroke line
// contains at least one comma (it's "x,y[,Abulge];..."), so checking for
// that first rules out any accidental collision before even trying the
// hex-digit scan.
function parseComposeRef(line: string): number | null {
  if (line.length < 2 || line[0] !== 'C' || line.includes(',')) return null;
  const rest = line.slice(1);
  if (!/^[0-9A-Fa-f]+$/.test(rest)) return null;
  return Number.parseInt(rest, 16);
}

// Recognizes "# LetterSpacing: 3" / "# WordSpacing: 6.75" /
// "# LineSpacingFactor: 1" header comments (leading/trailing whitespace
// around the key and value tolerated -- real files pad the colon out with
// spaces to align a trailing description column). Any other "#" comment
// (Format/Creator/Name/Author/License/...) is metadata this viewer has no
// use for and is silently ignored.
function parseHeaderComment(rawLine: string, font: LffFont): void {
  let pos = 1; // skip leading '#'
  while (pos < rawLine.length && rawLine[pos] === ' ') pos++;
  const rest = rawLine.slice(pos);
  const colon = rest.indexOf(':');
  if (colon === -1) return;
  const key = rest.slice(0, colon);
  const value = Number(rest.slice(colon + 1));
  if (!Number.isFinite(value)) return; // not a numeric header field (e.g. "# Name: ISO 3098-2") -- ignore
  if (key === 'LetterSpacing') font.letterSpacing = value;
  else if (key === 'WordSpacing') font.wordSpacing = value;
  else if (key === 'LineSpacingFactor') font.lineSpacingFactor = value;
}

// Resolves one glyph's final (flattened, composition-expanded) strokes and
// advance, memoizing into `resolved` so a base letter referenced by many
// accented variants (e.g. 'A' under À/Á/Â/Ã/Ä/Å) is only flattened once.
// `stack` guards against a cycle (a composition reference loop, which would
// otherwise recurse forever) -- not expected in any real .lff file, but
// cheap to make safe rather than assume.
function resolveGlyph(
  codepoint: number,
  raw: Map<number, RawGlyphEntry[]>,
  resolved: Map<number, LffGlyph>,
  stack: number[],
): LffGlyph {
  const existing = resolved.get(codepoint);
  if (existing) return existing;

  const glyph: LffGlyph = { strokes: [], advance: 0 }; // stays empty for an unknown or cyclic reference
  const rawEntries = raw.get(codepoint);
  const cyclic = stack.includes(codepoint);
  if (rawEntries && !cyclic) {
    stack.push(codepoint);
    for (const entry of rawEntries) {
      if (entry.isComposeRef) {
        const base = resolveGlyph(entry.composeRef, raw, resolved, stack);
        glyph.strokes.push(...base.strokes);
      } else {
        glyph.strokes.push(entry.stroke);
      }
    }
    stack.pop();
    for (const stroke of glyph.strokes) {
      for (const pt of stroke) glyph.advance = Math.max(glyph.advance, pt.x);
    }
  }
  resolved.set(codepoint, glyph);
  return glyph;
}

/**
 * Parses .lff file content (already fetched -- see fontLoader.ts) into an
 * LffFont. Returns null if `text` contains no parseable glyph, matching the
 * C++ loadFromFile()'s "can't open/nothing parseable" -> nullptr contract;
 * callers treat that identically to "no such font".
 */
export function parseLffFont(text: string): LffFont | null {
  const font: LffFont = { glyphs: new Map(), letterSpacing: 3.0, wordSpacing: 6.75, lineSpacingFactor: 1.0 };
  const raw = new Map<number, RawGlyphEntry[]>();
  let inGlyph = false;
  let currentCodepoint = 0;

  for (let line of text.split('\n')) {
    if (line.endsWith('\r')) line = line.slice(0, -1); // tolerate CRLF files
    if (line.length === 0) continue;

    if (line[0] === '#') {
      parseHeaderComment(line, font);
      continue;
    }
    if (line[0] === '[') {
      const close = line.indexOf(']');
      if (close === -1) {
        inGlyph = false;
        continue;
      }
      const hex = line.slice(1, close);
      const cp = Number.parseInt(hex, 16);
      if (Number.isFinite(cp)) {
        currentCodepoint = cp;
        if (!raw.has(currentCodepoint)) raw.set(currentCodepoint, []); // ensure an (initially empty) entry exists
        inGlyph = true;
      } else {
        inGlyph = false; // malformed section header -- skip its stroke lines below
      }
      continue;
    }
    if (!inGlyph) continue; // stray line before any "[XXXX]" header

    const composeRef = parseComposeRef(line);
    if (composeRef !== null) {
      raw.get(currentCodepoint)!.push({ isComposeRef: true, composeRef, stroke: [] });
      continue;
    }
    const stroke = parseStroke(line);
    if (stroke.length > 0) {
      raw.get(currentCodepoint)!.push({ isComposeRef: false, composeRef: 0, stroke });
    }
  }

  if (raw.size === 0) return null;

  const stack: number[] = [];
  for (const codepoint of raw.keys()) resolveGlyph(codepoint, raw, font.glyphs, stack);
  return font;
}
