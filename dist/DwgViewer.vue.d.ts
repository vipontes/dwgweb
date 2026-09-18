import { type ParsedDrawing } from './types';
type __VLS_Props = {
    /** The drawing to load: a File (name gives the .dxf/.dwg extension), raw bytes (pair with fileName), or a URL to fetch. */
    source?: File | ArrayBuffer | Uint8Array | string | null;
    /** Required when `source` is raw bytes rather than a File/URL, so the dxf/dwg reader can be picked. */
    fileName?: string;
    /** Overrides where TEXT/MTEXT stroke fonts (resources/fonts/*.lff) are fetched from -- see fontLoader.ts's defaultFontsBaseUrl() for what it resolves to otherwise. */
    fontsBaseUrl?: string;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {
    zoomFit: () => void;
}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    loaded: (drawing: ParsedDrawing) => any;
    error: (message: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onLoaded?: ((drawing: ParsedDrawing) => any) | undefined;
    onError?: ((message: string) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
