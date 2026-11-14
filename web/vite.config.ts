import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1: egyetlen, offline is működő HTML fájl (letölthető változat).
const single = process.env.SINGLE === '1';
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  build: single
    ? { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 5000 }
    : { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
});
