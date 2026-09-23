// Loads the Emscripten-compiled parser (wasm/bindings.cpp + dwgviewer's
// Qt-free dwg_document.cpp) and converts its embind objects into the plain
// TS model in types.ts.
//
// embind detail that shapes this whole file: bindings.cpp registers
// std::vector<T> fields (Shape::points, ::bulges, ::hatchLoops, etc.) via
// register_vector<T>, which binds each vector as a real class_ handle (with
// .size()/.get(i)/.delete()) -- NOT a plain JS array, and NOT automatically
// freed by JS garbage collection. Every such handle this file touches must
// be walked into a plain array and then explicitly .delete()d, or it leaks
// on the WASM heap for the lifetime of the page. value_object-bound structs
// (Shape, Point2D, HatchLoop, ...) don't have this problem -- embind already
// converts those to plain JS objects on read -- so the explicit conversion
// below only ever needs to reach into the vector-typed fields.
import type {
  BoundingBox,
  HatchLoop,
  HatchPatternLine,
  ParsedDrawing,
  Point2D,
  Shape,
} from './types';

// The embind module's own generated types are untyped (plain `any`) from
// TS's perspective -- createDwgParserModule() is generated JS, not TS, and
// its exact per-binding shape (class_ handles vs. value objects vs. enum
// wrappers) isn't something a hand-written .d.ts should re-assert; the
// conversion functions below are the single place that encodes that shape,
// matching bindings.cpp field-for-field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmVector = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WasmValue = any;

let modulePromise: Promise<WasmModule> | null = null;

function loadModule(): Promise<WasmModule> {
  if (!modulePromise) {
    // './wasm/dwgparser.js' is deliberately marked `external` in
    // vite.config.ts rather than let Vite bundle it: Vite's library build
    // mode base64-inlines any asset it discovers through its own static-URL
    // analysis (even an explicit `?url` import), which would balloon this
    // ~2MB .wasm into the JS bundle. Left external, this import (and the
    // glue's own internal `new URL("dwgparser.wasm", import.meta.url)`)
    // resolves against the copied file at runtime instead -- see the
    // copy-dwgparser-wasm plugin in vite.config.ts.
    modulePromise = import('./wasm/dwgparser.js').then((mod) => mod.default());
  }
  return modulePromise;
}

/** Converts an embind vector handle to a plain array, freeing the handle. */
function vecToArray<T>(vec: WasmVector, convert: (item: WasmValue) => T): T[] {
  const n = vec.size();
  const out: T[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = convert(vec.get(i));
  vec.delete();
  return out;
}

function toPoint2D(p: WasmValue): Point2D {
  return { x: p.x, y: p.y };
}

function toNumber(x: WasmValue): number {
  return x;
}

function toHatchLoop(loop: WasmValue): HatchLoop {
  return {
    points: vecToArray(loop.points, toPoint2D),
    bulges: vecToArray(loop.bulges, toNumber),
  };
}

function toHatchPatternLine(pl: WasmValue): HatchPatternLine {
  return {
    angleRad: pl.angleRad,
    basePoint: toPoint2D(pl.basePoint),
    offset: toPoint2D(pl.offset),
    dashPattern: vecToArray(pl.dashPattern, toNumber),
  };
}

function toShape(s: WasmValue): Shape {
  return {
    kind: s.kind.value,
    points: vecToArray(s.points, toPoint2D),
    bulges: vecToArray(s.bulges, toNumber),
    startWidths: vecToArray(s.startWidths, toNumber),
    endWidths: vecToArray(s.endWidths, toNumber),
    dashPattern: vecToArray(s.dashPattern, toNumber),
    center: toPoint2D(s.center),
    radius: s.radius,
    startAngleRad: s.startAngleRad,
    endAngleRad: s.endAngleRad,
    closed: s.closed,
    color: { r: s.color.r, g: s.color.g, b: s.color.b },
    text: s.text,
    textHeightDoc: s.textHeightDoc,
    textAngleRad: s.textAngleRad,
    textHAlign: s.textHAlign.value,
    textVAlign: s.textVAlign.value,
    textWidthFactor: s.textWidthFactor,
    fontFile: s.fontFile,
    hatchLoops: vecToArray(s.hatchLoops, toHatchLoop),
    hatchFillKind: s.hatchFillKind.value,
    hatchColor2: { r: s.hatchColor2.r, g: s.hatchColor2.g, b: s.hatchColor2.b },
    hatchGradientAngleRad: s.hatchGradientAngleRad,
    hatchPatternLines: vecToArray(s.hatchPatternLines, toHatchPatternLine),
  };
}

function toBoundingBox(b: WasmValue): BoundingBox {
  return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
}

function extensionOf(fileName: string): 'dxf' | 'dwg' {
  return fileName.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf';
}

let loadCounter = 0;

/**
 * Parses a .dxf or .dwg file's raw bytes into a ParsedDrawing. `fileName` is
 * only used to pick the dxf/dwg reader (by extension) -- the bytes never
 * touch a real filesystem, they're written into Emscripten's in-memory FS
 * for the duration of this call.
 */
export async function parseDrawing(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ParsedDrawing> {
  const Module = await loadModule();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  // Unique path per call: guards against a second parseDrawing() running
  // concurrently (e.g. the user drops a new file before the first finishes)
  // from clobbering the still-in-flight first call's input file.
  const path = `/input-${loadCounter++}.${extensionOf(fileName)}`;
  Module.FS.writeFile(path, bytes);

  let doc: WasmValue | undefined;
  try {
    doc = Module.loadDwgFile(path);
    const errorMessage: string = doc.errorMessage();
    if (errorMessage) {
      return { shapes: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, errorMessage };
    }
    const shapes = vecToArray(doc.shapes(), toShape);
    const boundingBox = toBoundingBox(doc.boundingBox());
    return { shapes, boundingBox, errorMessage: '' };
  } finally {
    doc?.delete();
    try {
      Module.FS.unlink(path);
    } catch {
      // best-effort cleanup
    }
  }
}
