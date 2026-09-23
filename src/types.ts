// Mirrors dwgviewer's src/dwg_document.h model structs 1:1 (see that file
// for the authoritative field-by-field documentation) -- this is the plain
// JS/TS shape that parser.ts converts the WASM module's embind objects into.
// Numeric enum values match bindings.cpp's declaration order exactly, so
// `shape.kind === ShapeKind.Line` works directly against the value the WASM
// module hands back with no remapping table.

export interface Point2D {
  x: number;
  y: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export enum ShapeKind {
  Line = 0,
  Circle = 1,
  Arc = 2,
  Polyline = 3,
  Text = 4,
  Hatch = 5,
}

export enum TextHAlign {
  Left = 0,
  Center = 1,
  Right = 2,
}

export enum TextVAlign {
  Baseline = 0,
  Bottom = 1,
  Middle = 2,
  Top = 3,
}

export enum HatchFillKind {
  Solid = 0,
  Gradient = 1,
  Pattern = 2,
}

export interface HatchLoop {
  points: Point2D[];
  bulges: number[];
}

export interface HatchPatternLine {
  angleRad: number;
  basePoint: Point2D;
  offset: Point2D;
  dashPattern: number[];
}

export interface Shape {
  kind: ShapeKind;

  points: Point2D[];
  bulges: number[];
  startWidths: number[];
  endWidths: number[];
  dashPattern: number[];

  center: Point2D;
  radius: number;
  startAngleRad: number;
  endAngleRad: number;

  closed: boolean;
  color: RgbColor;

  text: string;
  textHeightDoc: number;
  textAngleRad: number;
  textHAlign: TextHAlign;
  textVAlign: TextVAlign;
  /** Text / MText only. DXF/DWG code 41 ("width factor") -- a horizontal-only stretch on top of the glyphs' own uniform height scale. TEXT/ATTRIB/ATTDEF carry a real per-entity value here; MTEXT always reports 1.0 (no stretch) -- the C++ model deliberately does NOT read DRW_MText's own `widthscale` field, since libdxfrw reuses it for an unrelated quantity (the MTEXT reference-rectangle wrap width) that would wildly distort rendering if treated as a glyph stretch factor. See native/dwg_document.cpp's makeMTextShape comment. */
  textWidthFactor: number;
  /** Text / MText only. The STYLE table's font file name (e.g. "romans.shx"), verbatim and unresolved -- see fontLoader.ts's stem-based lookup against resources/fonts/*.lff. Empty when unknown, which the renderer treats as "use the browser's fallback font". */
  fontFile: string;

  hatchLoops: HatchLoop[];
  hatchFillKind: HatchFillKind;
  hatchColor2: RgbColor;
  hatchGradientAngleRad: number;
  hatchPatternLines: HatchPatternLine[];
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function isValidBoundingBox(bbox: BoundingBox): boolean {
  return bbox.minX <= bbox.maxX && bbox.minY <= bbox.maxY;
}

export interface ParsedDrawing {
  shapes: Shape[];
  boundingBox: BoundingBox;
  /** Set (and shapes/boundingBox empty) when the file failed to parse. */
  errorMessage: string;
}
