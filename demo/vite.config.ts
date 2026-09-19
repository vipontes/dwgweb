import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

// The TEXT/MTEXT stroke fonts (../resources/fonts/*.lff) are fetched at
// runtime relative to the library's own module URL (see src/fontLoader.ts's
// defaultFontsBaseUrls()). Vite bundles that module into dist/assets/, so its
// first candidate is dist/assets/resources/fonts/ -- copy them there so the
// built demo is self-contained. (Dev doesn't need this: the source module's
// "../resources/fonts/" candidate resolves to the repo-root resources/.)
function copyResourcesFonts(): Plugin {
  return {
    name: 'copy-resources-fonts',
    apply: 'build',
    writeBundle(options) {
      const outDir = resolve(options.dir ?? resolve(__dirname, 'dist'), 'assets/resources/fonts');
      mkdirSync(outDir, { recursive: true });
      cpSync(resolve(__dirname, '../resources/fonts'), outDir, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [vue(), copyResourcesFonts()],
  // Relative asset URLs so the built demo works from any path (e.g.
  // https://host/demo/), not just a domain root. With the default '/',
  // the emscripten glue's `new URL("/assets/dwgparser-*.wasm", import.meta.url)`
  // points at the host root and the wasm fetch 404s under a subpath.
  base: './',
  resolve: {
    // Point straight at the library's source during development instead of
    // requiring a `npm run build` in the parent package first.
    alias: {
      'dwg-viewer': resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    fs: {
      // The aliased 'dwg-viewer' source lives outside demo/'s own root.
      allow: [resolve(__dirname, '..')],
    },
  },
});
