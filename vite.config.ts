import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves this repo from /paper-prism/, so the demo build
  // must use relative asset URLs. The normal build stays at the domain root.
  base: mode === 'demo' ? './' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8790'
    }
  },
  build: {
    target: 'es2022',
    outDir: mode === 'demo' ? 'dist-demo' : 'dist'
  }
}));
