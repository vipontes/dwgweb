export interface Point2D {
    x: number;
    y: number;
}
export interface RgbColor {
    r: number;
    g: number;
    b: number;
}
export declare enum ShapeKind {
    Line = 0,
    Circle = 1,
    Arc = 2,
    Polyline = 3,
    Text = 4,
    Hatch = 5
}
export declare enum TextHAlign {
    Left = 0,
    Center = 1,
    Right = 2
}
export declare enum TextVAlign {
    Baseline = 0,
    Bottom = 1,
    Middle = 2,
    Top = 3
}
export declare enum HatchFillKind {
    Solid = 0,
    Gradient = 1,
    Pattern = 2
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
export declare function isValidBoundingBox(bbox: BoundingBox): boolean;
export interface ParsedDrawing {
    shapes: Shape[];
    boundingBox: BoundingBox;
    /** Set (and shapes/boundingBox empty) when the file failed to parse. */
    errorMessage: string;
}
