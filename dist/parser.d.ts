import type { ParsedDrawing } from './types';
/**
 * Parses a .dxf or .dwg file's raw bytes into a ParsedDrawing. `fileName` is
 * only used to pick the dxf/dwg reader (by extension) -- the bytes never
 * touch a real filesystem, they're written into Emscripten's in-memory FS
 * for the duration of this call.
 */
export declare function parseDrawing(data: ArrayBuffer | Uint8Array, fileName: string): Promise<ParsedDrawing>;
