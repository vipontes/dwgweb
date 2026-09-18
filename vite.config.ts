import { cpSync, existsSync, mkdirSync } from 'node:fs';
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

// TEXT/MTEXT stroke fonts (resources/fonts/*.lff, see src/fontLoader.ts)
// live at the package's top level, same as dwgviewer's own resources/ --
// CMakeLists.txt copies that tree next to the built executable so the
// running app doesn't depend on the source tree still being around; this is
// the same copy for a web build, landing the fonts next to dwg-viewer.js in
// dist/ so a built dist/ is self-contained the same way dist/wasm/ already
// is. fontLoader.ts's default base URL prefers this dist-local copy and
// falls back to the package-root resources/ (this copy's own source) for
// dev, where nothing has been built to dist/ yet.
function copyResourcesFonts(): Plugin {
  return {
    name: 'copy-resources-fonts',
    apply: 'build',
    writeBundle() {
      const srcDir = resolve(__dirname, 'resources/fonts');
      if (!existsSync(srcDir)) return; // matches CMakeLists.txt's own `if(EXISTS ".../resources")` guard
      const outDir = resolve(__dirname, 'dist/resources/fonts');
      mkdirSync(outDir, { recursive: true });
      cpSync(srcDir, outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [vue(), copyDwgParserWasm(), copyResourcesFonts()],
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
