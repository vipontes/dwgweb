# dwg-viewer

A Vue 3 `<DwgViewer>` component that renders `.dxf`/`.dwg` files entirely
client-side. It's built from the [dwgviewer](https://github.com/librecad/librecad)-derived
Qt-free parsing layer (vendored below, no external checkout dependency),
compiled to WebAssembly, plus a Canvas2D reimplementation of that layer's
`ViewerWidget` (zoom-fit, wheel-zoom-around-cursor, left-drag pan).

```
file.dxf/.dwg -> Emscripten (libdxfrw + dwg_document.cpp) -> Shape[]/BoundingBox
              -> DwgViewer.vue -> renderer.ts -> Canvas2D
```

`native/dwg_document.h/.cpp` has zero Qt dependency -- it's plain C++/STL
producing `Shape`/`Point2D`/`BoundingBox` structs. The original dwgviewer
project's `viewer_widget.cpp` (not part of this repo) is the only piece that
touched Qt, via `QPainter`. So rather than compiling Qt itself to
WebAssembly (which wants to own the whole page via its own event
loop/bootstrap, and doesn't compose as a droppable component inside a Vue
app), this project:

1. Compiles `dwg_document.cpp` + vendored `libdxfrw`, with no Qt in the
   build at all, to WASM via Emscripten + embind (`wasm/bindings.cpp`,
   `wasm/build.sh`).
2. Ports `viewer_widget.cpp`'s ~300 lines of `QPainter`/`QTransform` calls
   to Canvas2D/`DOMMatrix` line-for-line (`src/renderer.ts`) -- same
   bulge-to-arc math, same "don't trust `QPainter::drawArc()`'s angle
   convention under a Y-flipped transform" reasoning, same manual dash-walk
   for cosmetic (always-1-pixel) strokes.
3. Wraps both as a regular Vue component (`src/DwgViewer.vue`) -- not a Vue
   plugin (`app.use()`), just `import { DwgViewer } from 'dwg-viewer'`.

## Layout

Fully self-contained -- no dependency on any project outside this directory.

```
dwgweb/
  native/
    dwg_document.h/.cpp  # Qt-free DXF/DWG document model (DRW_Interface callback
                          # implementation -> Shape/Point2D/BoundingBox structs)
  third_party/
    libdxfrw/             # vendored DXF/DWG reader library (GPLv2, see its COPYING) --
                           # treat as read-only; re-vendor from upstream for fixes
  wasm/
    bindings.cpp          # embind wrapper around DwgDocument -- the only WASM-specific code
    build.sh               # emcc build script, compiles native/ + third_party/libdxfrw
  src/
    types.ts               # plain TS mirror of dwg_document.h's Shape/Point2D/BoundingBox/...
    parser.ts              # loads the WASM module, converts its embind objects to types.ts
    renderer.ts             # ported viewer_widget.cpp logic, Canvas2D
    DwgViewer.vue           # <canvas> + ResizeObserver + wheel/pointer handlers
    index.ts                # public exports
    wasm/                   # build output (dwgparser.js/.wasm) -- committed so the package
                             # works without an Emscripten toolchain; regenerate via `npm run build:wasm`
  demo/                     # standalone Vite+Vue app exercising the component against
                             # bundled sample .dxf/.dwg files
```

## Building

Requires Node 18+ (Vite 5's minimum). [emsdk](https://emscripten.org/docs/getting_started/downloads.html)
on `PATH` (`source /path/to/emsdk/emsdk_env.sh`) is only needed if you're
regenerating the WASM parser; the compiled output is committed under
`src/wasm/`, so a plain clone builds without any Emscripten toolchain
installed.

```bash
npm install
npm run build:wasm   # only if native/dwg_document.cpp or third_party/libdxfrw changed
npm run build         # vite build + vue-tsc -> dist/dwg-viewer.js, dist/wasm/, dist/*.d.ts
npm run typecheck     # vue-tsc --noEmit, no build output -- fast check while iterating
```

`npm run build` must be run at least once before the package is usable from
another project -- `main`/`module`/`types` in `package.json` all point at
`dist/`, which is `.gitignore`d and not committed.

## Installing in another project

This package isn't published to a registry, so point another project's
`package.json` at this repo directly. From a sibling directory:

```bash
npm install ../dwgweb          # file: dependency, resolved to a relative path
# or, from a git remote:
npm install git+https://<remote-url>#<branch-or-tag>
```

Either way `npm install` runs against **this repo's built output**, not its
source -- run `npm run build` here first (and again after pulling changes,
since `npm install file:...` doesn't re-run the dependency's own build
step). `npm link` works too for local iteration, with the same caveat: relink
or reinstall after every rebuild since Vite doesn't watch across the link
boundary in `npm run build` mode (use `npm run dev` here, which is
`vite build --watch`, if you want the consuming app to pick up changes
automatically).

## Demo

```bash
cd demo
npm install
npm run dev
```

Opens a page with two bundled sample files (`demo/public/samples/`) plus a
file picker for any local `.dxf`/`.dwg`.

## Using the component

`DwgViewer` is a plain Vue component, not a plugin -- there's no
`app.use()` step, just import and drop it in:

```vue
<script setup lang="ts">
import { DwgViewer } from 'dwg-viewer';
</script>

<template>
  <!-- source: a File, raw bytes (pair with file-name), or a URL string -->
  <DwgViewer :source="myFileOrUrl" file-name="drawing.dwg" style="width: 100%; height: 600px" />
</template>
```

The component fills its container, so the container needs an explicit
size (`style`, a CSS class, or a sized parent) -- it does not impose one
itself.

### Props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `source` | `File \| ArrayBuffer \| Uint8Array \| string \| null` | yes | The drawing to load. A `File` (from an `<input type="file">` or drag/drop), raw bytes, or a URL string to fetch. |
| `fileName` | `string` | only with raw bytes | Needed when `source` is `ArrayBuffer`/`Uint8Array` rather than a `File` or URL, so the `.dxf` vs `.dwg` extension can be determined. |

Loading is triggered automatically whenever `source` changes (or on
mount), so swapping `source` -- e.g. to a different `File` from a picker --
re-parses and re-fits the view with no extra calls needed.

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `loaded` | `ParsedDrawing` (`{ shapes, boundingBox }`, see `src/types.ts`) | Parsing succeeds and the view has been zoom-fit to the drawing. |
| `error` | `string` | Parsing fails (unsupported/corrupt file, fetch failure for a URL `source`, etc.). The viewer also renders the message itself, so handling this event is optional -- use it if you want your own error UI instead. |

### Exposed methods

Access these via a template ref:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { DwgViewer } from 'dwg-viewer';

const viewer = ref<InstanceType<typeof DwgViewer> | null>(null);
</script>

<template>
  <DwgViewer ref="viewer" :source="myFile" style="width: 100%; height: 600px" />
  <button @click="viewer?.zoomFit()">Zoom to fit</button>
</template>
```

| Method | Description |
| --- | --- |
| `zoomFit()` | Re-fits the current drawing to the canvas. Also called automatically after load and after the container resizes. |

### Built-in interaction

- **Mouse wheel** -- zoom in/out, centered on the cursor.
- **Left-mouse drag** -- pan. (The original desktop viewer binds this to
  the middle button; that's deliberately not used here -- on Linux, holding
  the middle button and dragging gets hijacked by the browser itself, e.g.
  Chrome/Firefox's autoscroll or Firefox's primary-selection-paste-as-URL,
  in ways a web page can't reliably suppress.)
- Resizing the container always re-fits the view rather than preserving
  pan/zoom.

## Known gaps

- No `SPLINE`, `ELLIPSE`-boundary hatch loops, `DIMORDINATE`/`DIMARC`, line
  weight, or XREF block resolution -- inherited as-is from `native/dwg_document.cpp`.
- Text is drawn with the browser's default sans-serif font at the entity's
  DXF height, not the file's actual `STYLE` table font, and canvas
  font-metrics approximation (no per-font `QFontMetricsF` equivalent) means
  multi-line vertical alignment is only as accurate as
  `TextMetrics.fontBoundingBox{Ascent,Descent}`.

## License

`third_party/libdxfrw` is vendored from LibreCAD's libdxfrw fork and is
GPLv2 (some files "or later") -- see `third_party/libdxfrw/COPYING`. This
project links it statically into the compiled WASM module and inherits that
license. Not legal advice -- review the license before distributing
anything built from this repo. Don't modify files under `third_party/`
directly; if a real bug fix is needed there, flag it explicitly and
ideally upstream it to LibreCAD rather than patching silently, so
re-vendoring later doesn't lose the fix.
