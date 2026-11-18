import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const SPA_404_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jiang Nan — Redirecting…</title>
    <script>
      (function () {
        var path = window.location.pathname || '/';
        var search = window.location.search || '';
        var hash = window.location.hash || '';
        if (/\\/survey\\/?$/i.test(path)) {
          var baseSurvey = path.replace(/\\/survey\\/?$/i, '/');
          window.location.replace(window.location.origin + baseSurvey + search + '#/survey');
        } else if (/\\/responses\\/?$/i.test(path)) {
          var baseResponses = path.replace(/\\/responses\\/?$/i, '/');
          window.location.replace(window.location.origin + baseResponses + search + '#/responses');
        } else {
          var cleanBase = path.replace(/\\/[^/]*$/, '/');
          window.location.replace(window.location.origin + cleanBase + search + (hash || '#/'));
        }
      })();
    </script>
  </head>
  <body></body>
</html>
`;

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      // Copies assets and prepares static GitHub Pages bundles for root (/), /docs, and /dist
      {
        name: 'prepare-github-pages-bundles',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const rootDir = import.meta.dirname;
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          // 1. Write 404.html and .nojekyll into dist/
          if (fs.existsSync(distDir)) {
            fs.writeFileSync(path.join(distDir, '404.html'), SPA_404_HTML, 'utf8');
            fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
          }

          // 2. Populate gh-pages-dist/app.js & app.css for root index.html branch deployments
          const builtAssetsDir = path.join(distDir, 'assets');
          const ghPagesDistDir = path.resolve(rootDir, 'gh-pages-dist');
          if (fs.existsSync(builtAssetsDir)) {
            fs.mkdirSync(ghPagesDistDir, {recursive: true});
            const files = fs.readdirSync(builtAssetsDir);
            const jsFile = files.find((f) => f.endsWith('.js'));
            const cssFile = files.find((f) => f.endsWith('.css'));
            if (jsFile) {
              fs.copyFileSync(
                path.join(builtAssetsDir, jsFile),
                path.join(ghPagesDistDir, 'app.js')
              );
            }
            if (cssFile) {
              fs.copyFileSync(
                path.join(builtAssetsDir, cssFile),
                path.join(ghPagesDistDir, 'app.css')
              );
            }
          }

          // 3. Copy public/assets to root /assets so root index.html resolves ./assets/...
          const publicAssetsDir = path.resolve(rootDir, 'public/assets');
          const rootAssetsDir = path.resolve(rootDir, 'assets');
          if (fs.existsSync(publicAssetsDir)) {
            fs.cpSync(publicAssetsDir, rootAssetsDir, {recursive: true, force: true});
          }

          // 4. Write root 404.html and .nojekyll for root branch deployments
          fs.writeFileSync(path.resolve(rootDir, '404.html'), SPA_404_HTML, 'utf8');
          fs.writeFileSync(path.resolve(rootDir, '.nojekyll'), '', 'utf8');

          // 5. Mirror dist/ into docs/ in case GitHub Pages is configured to serve /docs
          const docsDir = path.resolve(rootDir, 'docs');
          if (fs.existsSync(distDir)) {
            fs.cpSync(distDir, docsDir, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
