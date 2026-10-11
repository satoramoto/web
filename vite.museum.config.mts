import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A separate artifact keeps the band's homepage and static assets out of the portfolio.
export default defineConfig({
  plugins: [react(), {
    name: 'museum-pages-root',
    closeBundle() {
      const output = resolve('dist-museum');
      const html = readFileSync(resolve(output, 'museum/index.html'), 'utf8');
      writeFileSync(resolve(output, 'index.html'), html.replaceAll('../assets/', './assets/'));
      copyFileSync(resolve('public/museum/credits.txt'), resolve(output, 'credits.txt'));
      copyFileSync(resolve('assets/fonts/archivo/OFL.txt'), resolve(output, 'assets/Archivo-OFL.txt'));
      writeFileSync(resolve(output, '.nojekyll'), '');
      rmSync(resolve(output, 'museum'), { recursive: true });
    },
  }],
  base: '/web/',
  publicDir: false,
  build: {
    outDir: 'dist-museum',
    rollupOptions: { input: 'museum/index.html' },
  },
});
