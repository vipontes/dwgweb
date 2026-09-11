# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Vue 3 `<DwgViewer>` component that renders `.dxf`/`.dwg` files entirely
client-side, in the browser. It has two halves that share no code and are
built/tested independently:

- A C++ DXF/DWG parser (vendored `libdxfrw` + a from-scratch, Qt-free
  document model), compiled to WebAssembly via Emscripten/embind.
- A TypeScript/Canvas2D renderer and Vue component that consumes the
  parser's output.

This repo is fully self-contained -- `native/` and `third_party/libdxfrw`
are vendored copies (originally derived from a sibling Qt desktop viewer
project), not references to anything outside this directory.

## Commands

All commands run from the repo root unless noted.

```bash
npm install                    # library deps
npm run build:wasm             # rebuild src/wasm/dwgparser.{js,wasm} from native/ + third_party/libdxfrw
                                # requires emsdk on PATH: source /path/to/emsdk/emsdk_env.sh
npm run build                  # vite build (dist/dwg-viewer.js) + vue-tsc declarations (dist/*.d.ts)
npm run typecheck              # vue-tsc --noEmit, no build output
```

The compiled WASM output is committed under `src/wasm/`, so `npm run
build:wasm` is only needed after changing `native/dwg_document.{h,cpp}` or
`third_party/libdxfrw`. Everything else (`npm run build`, the demo) works
without Emscripten installed.

Demo app (separate `npm install`, aliases the `dwg-viewer` import straight
to `../src` so it exercises current source, not a built package):

```bash
cd demo
npm install
npm run dev      # Vite dev server with basic.dxf / polyline_with_width_test.dwg samples + a file picker
npm run build
```

There is no test suite yet. Verification so far has been: `npm run
typecheck`, `npm run build` succeeding, and manually loading sample files
in the demo (see `demo/public/samples/`) to visually confirm rendering.

## Architecture

```
file.dxf/.dwg -> Emscripten module (native/dwg_document.cpp + third_party/libdxfrw)
              -> Shape[] / BoundingBox (src/types.ts)
              -> DwgViewer.vue -> renderer.ts -> Canvas2D
```

### Why WASM + Canvas2D instead of Qt-for-WebAssembly

The original desktop viewer this is derived from keeps its DXF/DWG parsing
(`native/dwg_document.h/.cpp`, implementing libdxfrw's `DRW_Interface`
callback interface) completely free of Qt -- it produces plain
`Shape`/`Point2D`/`BoundingBox`/`RgbColor` structs. Only that desktop
project's Qt widget (not present in this repo) touched `QPainter`. Qt's own
WebAssembly target wants to own the whole page via its own event
loop/bootstrap and doesn't compose as a droppable component inside a Vue
app's DOM/reactivity, so this project instead: compiles the Qt-free parser
to WASM as-is, and reimplements the ~300-line rendering layer natively
against Canvas2D/`DOMMatrix`.

### native/ + third_party/libdxfrw (C++, compiled to WASM only)

- `native/dwg_document.h/.cpp` -- `DwgDocument` implements libdxfrw's
  `DRW_Interface`. Each `add<Entity>()` callback that carries geometry
  pushes a `Shape` into an internal vector; most of `DRW_Interface`'s ~40
  pure virtuals are no-ops on purpose (a viewer doesn't need write-path
  callbacks or entity types it doesn't render).
- `third_party/libdxfrw` -- vendored wholesale from LibreCAD's in-tree
  libdxfrw fork. **Treat as read-only.** If a real bug fix is needed here,
  flag it explicitly rather than patching silently -- ideally upstream it to
  LibreCAD -- so re-vendoring later doesn't silently lose the fix. GPLv2
  licensed (see `third_party/libdxfrw/COPYING`); this project links it
  statically into the WASM module and inherits that license.
- `wasm/bindings.cpp` -- the only WASM-specific code. An embind wrapper
  exposing `DwgDocument`'s existing public surface
  (`loadFile`/`shapes`/`boundingBox`/`errorMessage`) and the plain
  Shape/Point2D/etc. structs as embind `value_object`s and
  `register_vector`s.
- `wasm/build.sh` -- the `em++` invocation. Compiles `native/dwg_document.cpp`
  + `bindings.cpp` + every `.cpp` under `third_party/libdxfrw/src`, no Qt
  anywhere in the command line.

Conventions for adding a new entity type: add the `DRW_Interface` override
in `dwg_document.h`/`.cpp`, extend `ShapeKind`/`Shape` if new fields are
needed, mirror the new field in `bindings.cpp`'s `value_object<Shape>`,
mirror it again in `src/types.ts`'s `Shape` interface and `src/parser.ts`'s
`toShape()` conversion, then add the drawing case in `src/renderer.ts`.
Four places, always in that order (C++ model -> embind -> TS model -> TS
converter -> renderer) -- missing one produces a silent `undefined` field
rather than a compile error, since `parser.ts`'s embind interop is
necessarily typed loosely (see below).

### embind <-> TypeScript boundary (src/parser.ts)

This is the trickiest part of the codebase and worth understanding before
touching it. `bindings.cpp` registers `std::vector<T>` fields (`Shape::points`,
`::hatchLoops`, etc.) via `register_vector<T>`, which binds each vector as a
real class handle (`.size()`/`.get(i)`/`.delete()`) -- **not** a plain JS
array, and **not** garbage collected. Every such handle `parser.ts` touches
must be walked into a plain array and then explicitly `.delete()`d, or it
leaks on the WASM heap for the life of the page. `value_object`-bound
structs (`Shape`, `Point2D`, `HatchLoop`, ...) don't have this problem --
embind converts those to plain JS objects on read -- so the conversion code
only ever needs to reach into vector-typed fields. `parser.ts`'s
`vecToArray()` + the `to*()` functions are hand-written (not generated)
specifically because this shape isn't something a reflection-based
converter should guess at.

`DwgDocument` itself (the `class_`-bound type) also needs `.delete()`.
`Module.loadDwgFile()` returns a fresh copy each call (verified empirically,
not just assumed), so deleting nested vectors and then the document itself,
in that order, is safe -- no double-free.

Enum fields (`Shape::kind`, `textHAlign`, etc.) come back from embind as
`{ value: number, ... }` wrapper objects, not raw numbers -- `parser.ts`
extracts `.value`. The extracted numeric values are defined in `src/types.ts`
to match `bindings.cpp`'s `enum_<>(...).value(...)` declaration order
exactly; there's no name-based remapping, so reordering an enum in one file
without the other silently breaks entity rendering (wrong `switch` case).

### src/renderer.ts (Canvas2D rendering)

A line-for-line port of the original desktop viewer's `QPainter`-based
rendering, not a reimplementation from geometry-first-principles -- when
modifying a case here, look for the equivalent logic pattern (bulge-to-arc
conversion, dash-pattern walking, hatch pattern-line sampling) before
inventing new math, since the existing math already handles the DXF-spec
edge cases.

Two transform-composition subtleties worth knowing before changing
`computeZoomFitTransform`/`zoomAroundPoint`/`panByScreenDelta`:

- Cosmetic strokes (`ctx.lineWidth`) must be set to `1 / pixelsPerUnit`
  (where `pixelsPerUnit = Math.abs(documentToScreen.a)`), not `1` -- canvas
  strokes scale with the current transform, but every entity in a DXF/DWG
  file should render at a constant ~1 device pixel regardless of zoom
  level, matching the original QPen cosmetic-width behavior.
- Text is never drawn through the same Y-flipped `documentToScreen`
  transform used for geometry -- doing so mirrors glyphs backwards. Each
  `Text` shape gets its own from-scratch transform (translate + rotate + a
  plain positive scale), built via `ctx.save()`/`setTransform()`/`restore()`
  around just that one shape.

`renderShapes()` takes a `Viewport { documentToScreen, pixelRatio }` rather
than reading canvas dimensions itself -- devicePixelRatio/resize handling is
entirely `DwgViewer.vue`'s responsibility, keeping `renderer.ts` a pure
function of (shapes, transform) that doesn't touch the DOM.

### src/DwgViewer.vue

Plain Vue component (not a Vue plugin / `app.use()` registration) --
`import { DwgViewer } from 'dwg-viewer'`. Accepts `source` as a `File`, raw
bytes (pair with the `fileName` prop, needed to distinguish .dxf from
.dwg), or a URL string. Owns canvas sizing (ResizeObserver +
devicePixelRatio), the current pan/zoom `DOMMatrix`, and pointer/wheel event
handling; delegates all actual parsing to `parser.ts` and all drawing to
`renderer.ts`.

Resize policy is intentionally simple: every resize triggers a full re-fit
(`zoomFit()`), discarding the user's current pan/zoom, rather than
preserving it. Left-mouse-button drag pans. The original desktop viewer
binds pan to the middle button instead, but on Linux, holding the middle
button down and dragging gets hijacked by the browser itself (Chrome/Firefox
autoscroll, Firefox's primary-selection-paste-as-URL) in ways `preventDefault()`
can't reliably suppress from page JS, so this deviates from
`ViewerWidget::mousePressEvent` to avoid it.

### Build tooling gotcha: Vite library mode force-inlines assets

`vite.config.ts` marks `./wasm/dwgparser.js` (and `.wasm`) as Rollup
`external` and copies both files to `dist/wasm/` via a custom
`writeBundle` plugin hook, rather than letting Vite's normal asset pipeline
handle them. This is deliberate: Vite's library build mode
(`build.lib`) base64-inlines any asset it discovers through its own
static-URL analysis -- including an explicit `?url` import -- ignoring
`assetsInlineLimit` entirely. Without the `external` + manual-copy
workaround, the ~2MB `dwgparser.wasm` gets inlined into the ~19KB JS
bundle, bloating it ~150x. If you see the built `dist/*.js` suddenly grow
to megabytes, this is almost certainly why.
