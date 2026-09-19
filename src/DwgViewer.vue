<script setup lang="ts">
// Vue port of dwgviewer's ViewerWidget (src/viewer_widget.h/.cpp): a <canvas>
// that fits/pans/zooms a parsed drawing exactly like the native QWidget did.
// Not a Vue plugin (app.use()) -- just a regular component, per the
// project's own design notes: that's the right shape for a "drop this into
// any Vue app" viewer.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { FontCache } from './fontLoader';
import { parseDrawing } from './parser';
import { computeZoomFitTransform, panByScreenDelta, renderShapes, zoomAroundPoint } from './renderer';
import { isValidBoundingBox, ShapeKind, type ParsedDrawing } from './types';

const props = defineProps<{
  /** The drawing to load: a File (name gives the .dxf/.dwg extension), raw bytes (pair with fileName), or a URL to fetch. */
  source?: File | ArrayBuffer | Uint8Array | string | null;
  /** Required when `source` is raw bytes rather than a File/URL, so the dxf/dwg reader can be picked. */
  fileName?: string;
  /** Overrides where TEXT/MTEXT stroke fonts (resources/fonts/*.lff) are fetched from -- see fontLoader.ts's defaultFontsBaseUrl() for what it resolves to otherwise. */
  fontsBaseUrl?: string;
}>();

// One FontCache per component instance (not per load) so a font fetched for
// one drawing is reused across subsequent `source` changes rather than
// re-fetched -- see FontCache's own doc comment.
const fontCache = new FontCache(props.fontsBaseUrl);

const emit = defineEmits<{
  loaded: [drawing: ParsedDrawing];
  error: [message: string];
}>();

const containerEl = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const drawing = shallowRef<ParsedDrawing | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

let transform: DOMMatrix | null = null;
let hasFitOnce = false;
let resizeObserver: ResizeObserver | null = null;
const activePointers = new Map<number, { x: number; y: number }>();
let lastPinch: { midX: number; midY: number; distance: number } | null = null;

const statusMessage = computed(() => {
  if (loading.value) return 'Loading drawing…';
  if (loadError.value) return loadError.value;
  if (!drawing.value || drawing.value.shapes.length === 0) return 'No drawing loaded';
  return null;
});

function zoomFit(): void {
  const canvas = canvasEl.value;
  if (!canvas || !drawing.value) return;
  const bbox = drawing.value.boundingBox;
  if (!isValidBoundingBox(bbox)) return;
  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  transform = computeZoomFitTransform(bbox, cssWidth, cssHeight);
  hasFitOnce = true;
}

function render(): void {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Dark canvas, matching LibreCAD/dwgviewer's default drawing-view
  // background.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const message = statusMessage.value;
  if (message) {
    const pixelRatio = window.devicePixelRatio || 1;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = 'gray';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.clientWidth / 2, canvas.clientHeight / 2);
  }

  if (!drawing.value || !transform || !hasFitOnce) return;
  ctx.imageSmoothingEnabled = true;
  const pixelRatio = window.devicePixelRatio || 1;
  renderShapes(ctx, drawing.value.shapes, { documentToScreen: transform, pixelRatio, fonts: fontCache });
}

function resizeCanvasToContainer(width?: number, height?: number): void {
  const canvas = canvasEl.value;
  const container = containerEl.value;
  if (!canvas || !container) return;

  // Use provided dimensions (from ResizeObserver entry) when available to
  // avoid re-querying the DOM mid-layout, which can return an already-mutated
  // size and feed a resize loop.
  const w = Math.max(1, Math.floor(width ?? container.clientWidth));
  const h = Math.max(1, Math.floor(height ?? container.clientHeight));
  const pixelRatio = window.devicePixelRatio || 1;
  const newW = Math.round(w * pixelRatio);
  const newH = Math.round(h * pixelRatio);

  // Skip if the bitmap dimensions haven't actually changed.
  if (canvas.width === newW && canvas.height === newH) return;

  canvas.width = newW;
  canvas.height = newH;

  // Simple policy, matching ViewerWidget::resizeEvent(): always re-fit on
  // resize rather than preserving the user's current pan/zoom.
  zoomFit();
  render();
}

async function loadSource(): Promise<void> {
  const source = props.source;
  transform = null;
  hasFitOnce = false;
  drawing.value = null;
  loadError.value = null;

  if (!source) {
    render();
    return;
  }

  loading.value = true;
  render();
  try {
    let bytes: ArrayBuffer;
    let fileName: string;
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Failed to fetch ${source}: ${response.status}`);
      bytes = await response.arrayBuffer();
      fileName = props.fileName ?? source;
    } else if (source instanceof File) {
      bytes = await source.arrayBuffer();
      fileName = props.fileName ?? source.name;
    } else {
      bytes = source instanceof Uint8Array ? source.slice().buffer : source;
      if (!props.fileName) {
        throw new Error('fileName prop is required when source is raw bytes (need it to tell .dxf from .dwg)');
      }
      fileName = props.fileName;
    }

    const parsed = await parseDrawing(bytes, fileName);
    if (parsed.errorMessage) {
      loadError.value = parsed.errorMessage;
      emit('error', parsed.errorMessage);
      return;
    }
    // Preload every STYLE font this drawing's Text shapes actually
    // reference (plus the unicode.lff fallback) before the first render, so
    // TEXT/MTEXT draws with its real stroke font from the start rather than
    // flashing the browser-font fallback in and then swapping -- mirrors
    // dwgviewer's lffFontFor() being synchronous (a local file read) by
    // making the one round of network fetches this needs happen up front.
    const fontFiles = parsed.shapes.filter((s) => s.kind === ShapeKind.Text).map((s) => s.fontFile);
    await fontCache.preload(fontFiles);
    drawing.value = parsed;
    zoomFit();
    emit('loaded', parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    loadError.value = message;
    emit('error', message);
  } finally {
    loading.value = false;
    render();
  }
}

function onWheel(event: WheelEvent): void {
  if (!transform || !hasFitOnce) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
  const canvas = canvasEl.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;
  transform = zoomAroundPoint(transform, cursorX, cursorY, factor);
  render();
}

// Touch gestures: one pointer pans, two pointers pinch-zoom (and pan with the
// midpoint between them). A third simultaneous pointer is ignored.
function pinchState(): { midX: number; midY: number; distance: number } | null {
  const canvas = canvasEl.value;
  if (!canvas || activePointers.size !== 2) return null;
  const rect = canvas.getBoundingClientRect();
  const [a, b] = [...activePointers.values()];
  return {
    midX: (a.x + b.x) / 2 - rect.left,
    midY: (a.y + b.y) / 2 - rect.top,
    distance: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

function onPointerDown(event: PointerEvent): void {
  // Left-button pan. The original desktop viewer binds this to the middle
  // button, but on Linux both Firefox and Chrome hijack a held-down middle
  // button for their own purposes (autoscroll, primary-selection paste-as-URL)
  // in ways that can't be reliably suppressed from page JS, so this diverges
  // from ViewerWidget::mousePressEvent to sidestep that entirely.
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (activePointers.size >= 2) return;
  event.preventDefault();
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  lastPinch = pinchState();
}

function onPointerMove(event: PointerEvent): void {
  const previous = activePointers.get(event.pointerId);
  if (!previous || !transform) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 2) {
    const pinch = pinchState();
    if (!pinch) return;
    if (lastPinch && lastPinch.distance > 0 && pinch.distance > 0) {
      // Pan by how far the midpoint moved, then scale around the new
      // midpoint, so the drawing point under the fingers stays under them.
      transform = panByScreenDelta(transform, pinch.midX - lastPinch.midX, pinch.midY - lastPinch.midY);
      transform = zoomAroundPoint(transform, pinch.midX, pinch.midY, pinch.distance / lastPinch.distance);
      render();
    }
    lastPinch = pinch;
    return;
  }

  transform = panByScreenDelta(transform, event.clientX - previous.x, event.clientY - previous.y);
  render();
}

function onPointerUp(event: PointerEvent): void {
  if (event.pointerType === 'mouse' && event.type === 'pointerup' && event.button !== 0) return;
  event.preventDefault();
  activePointers.delete(event.pointerId);
  // Going from two fingers to one resumes panning from the remaining
  // finger's current position (the map already holds it), with no jump.
  lastPinch = null;
}

defineExpose({ zoomFit: () => { zoomFit(); render(); } });

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Use the observer-reported content-box size so we never re-query a
      // mid-layout DOM value that may already reflect a previous mutation.
      const box = entry.contentBoxSize?.[0];
      if (box) {
        resizeCanvasToContainer(box.inlineSize, box.blockSize);
      } else {
        // Fallback for older browsers without contentBoxSize.
        resizeCanvasToContainer(entry.contentRect.width, entry.contentRect.height);
      }
    }
  });
  if (containerEl.value) resizeObserver.observe(containerEl.value);
  resizeCanvasToContainer();
  void loadSource();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

watch(() => props.source, () => {
  void loadSource();
});
</script>

<template>
  <div
    ref="containerEl"
    class="dwg-viewer-root"
    :style="{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', minWidth: '200px', minHeight: '200px' }"
  >
    <canvas
      ref="canvasEl"
      class="dwg-viewer-canvas"
      :style="{ position: 'absolute', inset: '0', width: '100%', height: '100%' }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />
  </div>
</template>

<style scoped>
.dwg-viewer-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 200px;
  min-height: 200px;
  overflow: hidden;
  overscroll-behavior: none;
}
.dwg-viewer-canvas {
  display: block;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: default;
  touch-action: none;
  overscroll-behavior: none;
}
</style>
