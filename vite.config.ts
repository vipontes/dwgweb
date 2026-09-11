import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

// The Emscripten-generated dwgparser.js/.wasm pair (see wasm/build.sh) is
// deliberately kept out of Rollup's asset pipeline entirely -- see the
// `external` entry below and the comment in src/parser.ts's loadModule().
// This plugin just copies the pair into dist/wasm/ verbatim so the
// unbundled `import('./wasm/dwgparser.js')` in the built dwg-viewer.js
// still resolves at runtime.
function copyDwgParserWasm(): Plugin {
  return {
    name: 'copy-dwgparser-wasm',
    apply: 'build',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/wasm');
      const outDir = resolve(__dirname, 'dist/wasm');
      mkdirSync(outDir, { recursive: true });
      cpSync(resolve(srcDir, 'dwgparser.js'), resolve(outDir, 'dwgparser.js'));
      cpSync(resolve(srcDir, 'dwgparser.wasm'), resolve(outDir, 'dwgparser.wasm'));
    },
  };
}

export default defineConfig({
  plugins: [vue(), copyDwgParserWasm()],
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DwgViewer',
      fileName: 'dwg-viewer',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', /\.\/wasm\/dwgparser\.(js|wasm)$/],
    },
  },
});
