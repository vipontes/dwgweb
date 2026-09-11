<script setup lang="ts">
import { ref } from 'vue';
import { DwgViewer, type ParsedDrawing } from 'dwg-viewer';

const source = ref<File | string | null>('/samples/basic.dxf');
const fileName = ref<string | undefined>('basic.dxf');
const status = ref('');

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  source.value = file;
  fileName.value = file.name;
}

function loadSample(path: string, name: string): void {
  source.value = path;
  fileName.value = name;
}

function onLoaded(drawing: ParsedDrawing): void {
  status.value = `Loaded ${drawing.shapes.length} shapes. BBox: (${drawing.boundingBox.minX.toFixed(
    1,
  )}, ${drawing.boundingBox.minY.toFixed(1)}) - (${drawing.boundingBox.maxX.toFixed(1)}, ${drawing.boundingBox.maxY.toFixed(1)})`;
}

function onError(message: string): void {
  status.value = `Error: ${message}`;
}
</script>

<template>
  <div class="app">
    <header>
      <h1>dwg-viewer demo</h1>
      <div class="controls">
        <input type="file" accept=".dxf,.dwg" @change="onFileChange" />
      </div>
      <p class="status">{{ status }}</p>
    </header>
    <main>
      <DwgViewer :source="source" :file-name="fileName" @loaded="onLoaded" @error="onError" />
    </main>
  </div>
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
}
body {
  font-family: system-ui, sans-serif;
  background: #1e1e1e;
  color: #eee;
}
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
header {
  padding: 8px 16px;
  border-bottom: 1px solid #444;
}
h1 {
  font-size: 16px;
  margin: 0 0 8px;
}
.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}
.status {
  margin: 8px 0 0;
  font-size: 12px;
  color: #aaa;
  min-height: 1.2em;
}
main {
  flex: 1;
  min-height: 0;
}
</style>
