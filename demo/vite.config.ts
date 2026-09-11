import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
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
