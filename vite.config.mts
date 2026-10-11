/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { previewLabelHead } from './scripts/preview-label.mjs';
import react from '@vitejs/plugin-react';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react(), {
    name: 'local-preview-label',
    apply: 'serve',
    transformIndexHtml(html) {
      if (process.env.UNIFIED_STORYBOOK) return html;
      return html.replace('</head>', `${previewLabelHead(process.env.PREVIEW_LABEL)}</head>`);
    },
    configureServer(server) {
      if (!process.env.UNIFIED_PREVIEW) return;
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/storybook') return next();
        res.writeHead(302, { Location: req.url.replace('/storybook', '/storybook/') });
        res.end();
      });
    },
  }],
  server: process.env.UNIFIED_PREVIEW ? {
    proxy: {
      '/storybook/': { target: `http://127.0.0.1:${process.env.STORYBOOK_PORT}`, ws: true, rewrite: path => path.startsWith('/storybook/vite-hmr') ? path : path.replace(/^\/storybook/, '') },
      '/vite-inject-mocker-entry.js': { target: `http://127.0.0.1:${process.env.STORYBOOK_PORT}` },
      '/@id/__x00__virtual:/@storybook/': { target: `http://127.0.0.1:${process.env.STORYBOOK_PORT}` },
      // Storybook's channel uses this fixed root endpoint independently of its iframe base.
      '/storybook-server-channel': { target: `http://127.0.0.1:${process.env.STORYBOOK_PORT}`, ws: true },
    },
  } : undefined,
  // Built pages link their files relatively, so one build works at funkadelicastronaut.com's root or under any subpath.
  base: './',
  // The old vanilla poster is kept in legacy/ but no longer built; public/ serves redirect stubs at its old URLs.
  build: {
    rollupOptions: {
      input: {
        home: 'index.html',
        museum: 'museum/index.html'
      }
    }
  },
  test: {
    projects: [
      {
        extends: true,
        // Runs every story as a browser test, with each play function as its assertions.
        // See https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
        plugins: [storybookTest()],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }]
          }
        }
      }
    ]
  }
});
