// Bundle the extension's scripts. Usage: node build.mjs
import { build } from 'esbuild';
import { readFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';

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
await build({ ...common, outdir: 'web/build', format: 'esm', entryPoints: { app: 'web/src/app.js', bridge: 'web/src/bridge.js', 'try-preview': 'web/src/try-preview.js', card: 'web/src/card.js', shops: 'web/src/shops.js' } });
await build({ outdir: 'web/build', bundle: true, logLevel: 'info', entryPoints: { style: 'web/src/app.css', try: 'web/src/try.css' },
  loader: { '.woff2': 'file' }, assetNames: 'fonts/[name]-[hash]' });
await mkdir('web/data', { recursive: true });
await cp('extension/data/cards.json', 'web/data/cards.json');
if (existsSync('extension/data/warnings.json')) await cp('extension/data/warnings.json', 'web/data/warnings.json');
await cp('extension/data/meta.json', 'web/data/meta.json');
await cp('extension/icons/icon-32.png', 'web/icon-32.png');
// The practice page's recorded badges live in a shadow root, which needs the font declared under its own file names.
await mkdir('web/fonts', { recursive: true });
for (const f of ['Geist-Regular.woff2', 'Geist-Medium.woff2', 'Geist-SemiBold.woff2', 'Geist-LICENSE.txt']) await cp(`extension/fonts/${f}`, `web/fonts/${f}`);

// The Android app's assets: the rules engine (android/engine/bridge.js and the shared modules it imports, one script
// for Jetpack's JavaScript sandbox), the recall cards in chunks (the sandbox caps the size of one evaluation), the data
// stamp and the example photo.
const assets = 'android/app/src/main/assets';
await build({ entryPoints: ['android/engine/bridge.js'], outfile: `${assets}/engine.js`, bundle: true, format: 'iife', target: 'es2020', logLevel: 'info' });
const { rm: rmDir, writeFile: write } = await import('node:fs/promises');
await rmDir(`${assets}/cards`, { recursive: true, force: true });
await mkdir(`${assets}/cards`, { recursive: true });
const { cards } = JSON.parse(await readFile('extension/data/cards.json', 'utf8'));
const CHUNK = 200;
for (let i = 0; i * CHUNK < cards.length; i++) await write(`${assets}/cards/${String(i).padStart(3, '0')}.json`, JSON.stringify(cards.slice(i * CHUNK, (i + 1) * CHUNK)));
await cp('extension/data/meta.json', `${assets}/meta.json`);
if (existsSync('extension/data/warnings.json')) await cp('extension/data/warnings.json', `${assets}/warnings.json`);
await cp('web/example/listing-26591.jpg', `${assets}/example.jpg`);
