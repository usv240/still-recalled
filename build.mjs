// Bundle the extension's scripts. Usage: node build.mjs
import { build } from 'esbuild';
import { readFile, mkdir, cp } from 'node:fs/promises';

// Development-only App Check debug token, read from a gitignored file. Without it, cloud calls are refused.
// RELEASE=1 leaves it out of every bundle: anything published (the web page, a packed extension) must never carry it.
const release = process.env.RELEASE === '1';
let debugToken = '';
try {
  const src = await readFile('extension/src/appcheck-debug.local.js', 'utf8');
  debugToken = (src.match(/APPCHECK_DEBUG_TOKEN\s*=\s*'([^']+)'/) || [])[1] || '';
} catch { /* no local token: on-device only */ }
if (release) debugToken = '';
console.log(release ? 'Release build: no debug token' : debugToken ? 'App Check debug token: found (development build)' : 'App Check debug token: none (cloud calls will be refused)');

const common = {
  outdir: 'extension/build',
  bundle: true,
  target: 'chrome139',
  logLevel: 'info',
  define: { __APPCHECK_DEBUG_TOKEN__: JSON.stringify(debugToken) },
  // The content script puts its styles in a shadow root, so it imports CSS as text.
  loader: { '.css': 'text' },
};

// Extension pages and the service worker load as modules.
await build({
  ...common,
  format: 'esm',
  entryPoints: {
    background: 'extension/src/background.js',
    panel: 'extension/src/panel.js',
    offscreen: 'extension/src/offscreen.js',
    dev: 'extension/src/dev.js',
    welcome: 'extension/src/welcome.js',
  },
});

// Content scripts are classic scripts, so they are wrapped instead of exported.
await build({ ...common, format: 'iife', entryPoints: { content: 'extension/src/content.js' } });

// Local test pages served by tools/collector.mjs.
await build({ ...common, outdir: 'tools', format: 'esm', entryPoints: {
  'cloud-test.bundle': 'tools/cloud-test.js',
  'confirm-test.bundle': 'tools/confirm-test.js',
  'live-test.bundle': 'tools/live-test.js',
  'eval-test.bundle': 'tools/eval-test.js',
  'label-test.bundle': 'tools/label-test.js',
  'preview/badges.bundle': 'tools/preview/badges.js',
} });

// The web page (web/, served as-is by Firebase Hosting). It reuses the extension's engine, prompts and detail view.
await build({ ...common, outdir: 'web/build', format: 'esm', entryPoints: { app: 'web/src/app.js', bridge: 'web/src/bridge.js' } });
await build({ outdir: 'web/build', bundle: true, logLevel: 'info', entryPoints: { style: 'web/src/app.css', try: 'web/src/try.css' },
  loader: { '.woff2': 'file' }, assetNames: 'fonts/[name]-[hash]' });
await mkdir('web/data', { recursive: true });
await cp('extension/data/cards.json', 'web/data/cards.json');
await cp('extension/data/meta.json', 'web/data/meta.json');
await cp('extension/icons/icon-32.png', 'web/icon-32.png');
