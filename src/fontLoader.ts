// Web counterpart to dwgviewer's viewer_widget.cpp "LFF stroke-font
// resolution" section (lffFontsDir/lffFontIndex/lffFontStem/lffFontFor):
// resolves a Shape::fontFile (a STYLE table's raw font name, e.g.
// "romans.shx") to a loaded, cached LffFont. TEXT/MTEXT's actual font is
// looked up here rather than in the WASM document model, same reasoning as
// the C++ original -- finding/parsing a font *file* is a rendering concern,
// not a document-model one.
//
// Differs from the C++ version in exactly one way, forced by the browser
// having no filesystem to scan next to an executable: instead of indexing
// every *.lff under resources/fonts/ up front, this fetches
// "<stem>.lff" directly by name and caches a null result for a 404 exactly
// like lffFontFor() caches a null lookup -- an unresolvable style still
// only costs one request, ever, not a repeated directory scan.
import { parseLffFont, type LffFont } from './lffFont';

// LibreCAD ships "unicode.lff" as a broad-coverage fallback for glyphs a
// narrower stroke font (most of resources/fonts/*.lff are Latin-only)
// doesn't define -- see FontCache.fallbackFont, used by renderer.ts's
// per-glyph lookup exactly like lffStepGlyph()'s `fallback` argument.
const FALLBACK_STEM = 'unicode';

// Two candidate locations for resources/fonts/*.lff, tried in order (see
// FontCache.fetchAndParse) and both resolved relative to this module's own
// import.meta.url so they still work however this module ends up served:
//
// 1. "./resources/fonts/" -- a copy sitting next to dwg-viewer.js itself.
//    vite.config.ts's copyResourcesFonts plugin puts one there at build
//    time (mirroring dist/wasm/dwgparser.wasm), so a built dist/ is
//    self-contained and doesn't depend on anything outside it -- this is
//    the one real deployments should hit.
// 2. "../resources/fonts/" -- the package-root resources/ this copy came
//    from, i.e. dwgviewer's own top-level resources/ layout (see its
//    CMakeLists.txt, which copies that same tree next to the built
//    executable the native way). Only reachable in dev, where Vite serves
//    this module straight from src/ with nothing built to dist/ yet.
//
// Both are fetched at runtime with a template-literal URL (`${stem}.lff`),
// which Vite's static-asset scanner doesn't recognize as a single
// resolvable file, so neither gets base64-inlined into the bundle -- see
// CLAUDE.md's note on why dwgparser.wasm needs the `external` + explicit
// copy treatment instead. Pass DwgViewer's `fontsBaseUrl` prop to override
// this entirely when a deployment can't satisfy either.
function defaultFontsBaseUrls(): string[] {
  // /* @vite-ignore */ suppresses Vite's (correct, but expected) "doesn't
  // exist at build time" warning for these literal paths -- both are
  // deliberately resolved at runtime, not build time.
  return [
    new URL(/* @vite-ignore */ './resources/fonts/', import.meta.url).toString(),
    new URL(/* @vite-ignore */ '../resources/fonts/', import.meta.url).toString(),
  ];
}

/** Strips any directory and extension from a STYLE table font name (e.g. "romans.shx" -> "romans"), lowercased -- matches lffFontStem() in viewer_widget.cpp. */
export function lffFontStem(fontFile: string): string {
  const base = fontFile.split(/[/\\]/).pop() ?? fontFile;
  const dot = base.lastIndexOf('.');
  return (dot === -1 ? base : base.slice(0, dot)).toLowerCase();
}

// Distinguishes "this base URL doesn't have resources/fonts/ at all" (try
// the next candidate) from "it does, and this stem is genuinely a font
// this project doesn't ship" (authoritative -- don't retry against a
// different base for the same reason lffFontFor() caches a null lookup
// rather than re-scanning the directory). A candidate only counts as
// "found" once its response actually parses as a real .lff -- checking
// `response.ok` alone isn't enough: Vite's dev server (and plenty of other
// static hosts/SPA setups) serves index.html with a 200 for *any*
// unmatched path, including a candidate base that's simply wrong, which
// would otherwise get misread as "this base is correct, and this
// particular font is missing" and get locked in permanently.
async function tryFetch(baseUrl: string, stem: string): Promise<{ found: false } | { found: true; font: LffFont }> {
  try {
    const response = await fetch(new URL(`${stem}.lff`, baseUrl));
    if (!response.ok) return { found: false };
    const font = parseLffFont(await response.text());
    if (!font) return { found: false };
    return { found: true, font };
  } catch {
    return { found: false }; // network error / opaque response -- treat like "no such font", same as lffFontFor()
  }
}

/**
 * Fetches and caches .lff fonts by STYLE-table name. One instance is meant
 * to live for the component's lifetime (see DwgViewer.vue), so a font
 * fetched for one drawing is reused for the next rather than re-fetched.
 */
export class FontCache {
  private readonly baseUrls: string[];
  // Once any fetch against one of `baseUrls` succeeds (finds *something*,
  // even a font that fails to parse), every later lookup goes straight to
  // that same base instead of re-probing every candidate -- in practice
  // this is settled by the very first preload() call, since it always
  // includes the always-present unicode.lff fallback.
  private resolvedBaseUrl: string | null = null;
  private readonly pending = new Map<string, Promise<LffFont | null>>();
  private readonly resolved = new Map<string, LffFont | null>();

  constructor(baseUrl?: string) {
    this.baseUrls = baseUrl ? [baseUrl] : defaultFontsBaseUrls();
  }

  /**
   * Awaits every font named by `fontFiles` (plus the unicode.lff fallback)
   * so fontFor()/fallbackFont are ready to call synchronously afterward --
   * renderer.ts's draw loop can't itself be async (Canvas2D drawing is
   * inherently synchronous), so DwgViewer.vue awaits this once per parsed
   * drawing before rendering it.
   */
  async preload(fontFiles: Iterable<string>): Promise<void> {
    const stems = new Set<string>([FALLBACK_STEM]);
    for (const fontFile of fontFiles) {
      if (fontFile) stems.add(lffFontStem(fontFile));
    }
    await Promise.all([...stems].map((stem) => this.load(stem)));
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
  fontFor(fontFile: string): LffFont | null {
    if (!fontFile) return null;
    return this.resolved.get(lffFontStem(fontFile)) ?? null;
  }

  /** The always-preloaded unicode.lff, or null if it failed to fetch/parse. */
  get fallbackFont(): LffFont | null {
    return this.resolved.get(FALLBACK_STEM) ?? null;
  }

  private load(stem: string): Promise<LffFont | null> {
    let promise = this.pending.get(stem);
    if (!promise) {
      promise = this.fetchAndParse(stem).then((font) => {
        this.resolved.set(stem, font);
        return font;
      });
      this.pending.set(stem, promise);
    }
    return promise;
  }

  private async fetchAndParse(stem: string): Promise<LffFont | null> {
    const candidates = this.resolvedBaseUrl ? [this.resolvedBaseUrl] : this.baseUrls;
    for (const baseUrl of candidates) {
      const result = await tryFetch(baseUrl, stem);
      if (result.found) {
        this.resolvedBaseUrl = baseUrl;
        return result.font;
      }
    }
    return null;
  }
}
