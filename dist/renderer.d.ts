import type { FontCache } from './fontLoader';
import { type BoundingBox, type Shape } from './types';
/** Port of ViewerWidget::zoomFit(). */
export declare function computeZoomFitTransform(bbox: BoundingBox, canvasWidth: number, canvasHeight: number, marginPx?: number): DOMMatrix;
/** Port of ViewerWidget::wheelEvent()'s zoom-around-cursor math. */
export declare function zoomAroundPoint(transform: DOMMatrix, cursorX: number, cursorY: number, factor: number): DOMMatrix;
/**
 * Port of ViewerWidget::mouseMoveEvent()'s pan math: `documentToScreen_ *
 * QTransform::fromTranslate(delta)`. Applying an existing transform first
 * and then shifting the *result* by a screen-space delta is just adding
 * that delta to the transform's own translation component (e/f) -- see the
 * C++ comment on mouseMoveEvent for why this order (not the reverse) is the
 * one that gives 1:1 screen-space panning independent of zoom level.
 */
export declare function panByScreenDelta(transform: DOMMatrix, dx: number, dy: number): DOMMatrix;
export interface Viewport {
    /** Doc-space -> CSS-pixel-space transform, as produced by computeZoomFitTransform/zoomAroundPoint/panByScreenDelta. */
    documentToScreen: DOMMatrix;
    /** devicePixelRatio the canvas's backing store is scaled by; 1 if the caller already sized the canvas in device pixels. */
    pixelRatio: number;
    /** Resolved (see FontCache.preload) LFF stroke fonts for this drawing's Text shapes. Omitted/no matching font -> falls back to the browser's own font rendering, same as before LFF support existed. */
    fonts?: FontCache;
}
/** Port of ViewerWidget::paintEvent()'s shape loop. Caller owns clearing/filling the background. */
export declare function renderShapes(ctx: CanvasRenderingContext2D, shapes: Shape[], viewport: Viewport): void;
