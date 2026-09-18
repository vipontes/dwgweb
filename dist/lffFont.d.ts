import type { Point2D } from './types';
export interface LffGlyph {
    strokes: Point2D[][];
    advance: number;
}
export interface LffFont {
    glyphs: Map<number, LffGlyph>;
    letterSpacing: number;
    wordSpacing: number;
    lineSpacingFactor: number;
}
export declare function findGlyph(font: LffFont, codepoint: number): LffGlyph | undefined;
/**
 * Parses .lff file content (already fetched -- see fontLoader.ts) into an
 * LffFont. Returns null if `text` contains no parseable glyph, matching the
 * C++ loadFromFile()'s "can't open/nothing parseable" -> nullptr contract;
 * callers treat that identically to "no such font".
 */
export declare function parseLffFont(text: string): LffFont | null;
