<script setup lang="ts">
// Vue port of dwgviewer's ViewerWidget (src/viewer_widget.h/.cpp): a <canvas>
// that fits/pans/zooms a parsed drawing exactly like the native QWidget did.
// Not a Vue plugin (app.use()) -- just a regular component, per the
// project's own design notes: that's the right shape for a "drop this into
// any Vue app" viewer.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { parseDrawing } from './parser';
import { computeZoomFitTransform, panByScreenDelta, renderShapes, zoomAroundPoint } from './renderer';
import { isValidBoundingBox, type ParsedDrawing } from './types';

const props = defineProps<{
  /** The drawing to load: a File (name gives the .dxf/.dwg extension), raw bytes (pair with fileName), or a URL to fetch. */
  source?: File | ArrayBuffer | Uint8Array | string | null;
  /** Required when `source` is raw bytes rather than a File/URL, so the dxf/dwg reader can be picked. */
  fileName?: string;
}>();

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
let panning = false;
let lastPanX = 0;
let lastPanY = 0;

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
  renderShapes(ctx, drawing.value.shapes, { documentToScreen: transform, pixelRatio });
}

function resizeCanvasToContainer(): void {
  const canvas = canvasEl.value;
  const container = containerEl.value;
  if (!canvas || !container) return;
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

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

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 1) return; // middle-button pan, matching ViewerWidget::mousePressEvent
  panning = true;
  lastPanX = event.clientX;
  lastPanY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event: PointerEvent): void {
  if (!panning || !transform) return;
  const dx = event.clientX - lastPanX;
  const dy = event.clientY - lastPanY;
  lastPanX = event.clientX;
  lastPanY = event.clientY;
  transform = panByScreenDelta(transform, dx, dy);
  render();
}

function onPointerUp(event: PointerEvent): void {
  if (event.button !== 1) return;
  panning = false;
}

function onAuxClick(event: MouseEvent): void {
  // Middle-button pan can otherwise trigger the browser's own middle-click
  // action (e.g. opening a new tab) once the pointer is released.
  if (event.button === 1) event.preventDefault();
}

defineExpose({ zoomFit: () => { zoomFit(); render(); } });

onMounted(() => {
  resizeObserver = new ResizeObserver(() => resizeCanvasToContainer());
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
  <div ref="containerEl" class="dwg-viewer-root">
    <canvas
      ref="canvasEl"
      class="dwg-viewer-canvas"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @auxclick="onAuxClick"
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
  width: 100%;
  height: 100%;
  cursor: default;
  touch-action: none;
  overscroll-behavior: none;
}
</style>
