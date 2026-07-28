import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/playground',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        playground: 'index.html',
        benchmark: 'benchmark.html',
        visualFixtures: 'visual-fixtures.html',
      },
    },
  },
});
