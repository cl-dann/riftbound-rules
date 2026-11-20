import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';

// SINGLE=1: egyetlen, offline is működő HTML fájl (letölthető változat).
const single = process.env.SINGLE === '1';
// ANALYZE=1: bundle térkép (stats.html, gzip méretekkel), a CI artifactként tölti fel.
const analyze = process.env.ANALYZE === '1' && !single;
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : []), ...(analyze ? [visualizer({ filename: 'stats.html', gzipSize: true, template: 'treemap' })] : [])],
  build: single
    ? { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 5000 }
    : { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
});
