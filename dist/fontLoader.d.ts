import { type LffFont } from './lffFont';
/** Strips any directory and extension from a STYLE table font name (e.g. "romans.shx" -> "romans"), lowercased -- matches lffFontStem() in viewer_widget.cpp. */
export declare function lffFontStem(fontFile: string): string;
/**
 * Fetches and caches .lff fonts by STYLE-table name. One instance is meant
 * to live for the component's lifetime (see DwgViewer.vue), so a font
 * fetched for one drawing is reused for the next rather than re-fetched.
 */
export declare class FontCache {
    private readonly baseUrls;
    private resolvedBaseUrl;
    private readonly pending;
    private readonly resolved;
    constructor(baseUrl?: string);
    /**
     * Awaits every font named by `fontFiles` (plus the unicode.lff fallback)
     * so fontFor()/fallbackFont are ready to call synchronously afterward --
     * renderer.ts's draw loop can't itself be async (Canvas2D drawing is
     * inherently synchronous), so DwgViewer.vue awaits this once per parsed
     * drawing before rendering it.
     */
    preload(fontFiles: Iterable<string>): Promise<void>;
    /**
     * Resolves a Shape::fontFile to its loaded LffFont -- null if `fontFile`
     * is empty (no STYLE override known) or names a font this project has no
     * shipped .lff for. Callers (renderer.ts) treat null identically: fall
     * back to the browser's own font rendering, matching this viewer's
     * behavior before LFF support existed. Only meaningful for fonts already
     * awaited via preload(); an unresolved lookup returns null rather than
     * kicking off a fetch, keeping this synchronous for the render loop.
     */
    fontFor(fontFile: string): LffFont | null;
    /** The always-preloaded unicode.lff, or null if it failed to fetch/parse. */
    get fallbackFont(): LffFont | null;
    private load;
    private fetchAndParse;
}
