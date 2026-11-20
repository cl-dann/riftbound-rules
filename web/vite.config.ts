import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

// ANALYZE=1: bundle térkép (stats.html, gzip méretekkel), a CI artifactként tölti fel.
const analyze = process.env.ANALYZE === '1';
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(analyze ? [visualizer({ filename: 'stats.html', gzipSize: true, template: 'treemap' })] : [])],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2500 },
});
