// Draws the toolbar and store icons (extension/icons/icon-N.png) from the same price-tag mark the UI uses.
// Each size is rasterised by Chrome at that size, not scaled down, so the 16px icon stays sharp.
// Usage: node scripts/make-icons.mjs   (needs Chrome and ffmpeg on this computer)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const out = path.resolve('extension/icons');
const work = path.join(tmpdir(), 'sr-icons');
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });

// The tag is cut out (mask), not painted over, so the hole shows whatever toolbar colour is behind it.
const svg = pad => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${24 + 2 * pad} ${24 + 2 * pad}" width="100%" height="100%">
  <mask id="m"><rect x="-9" y="-9" width="42" height="42" fill="#fff"/>
    <circle cx="7.6" cy="7.6" r="1.7" fill="#000"/>
    <path d="M11.2 12.8h5.2" stroke="#000" stroke-width="2" stroke-linecap="round"/></mask>
  <path mask="url(#m)" fill="#c4242a" d="M3 5.5A2.5 2.5 0 0 1 5.5 3h6.1a2.5 2.5 0 0 1 1.77.73l7.4 7.4a2.5 2.5 0 0 1 0 3.54l-6.1 6.1a2.5 2.5 0 0 1-3.54 0l-7.4-7.4A2.5 2.5 0 0 1 3 11.6Z"/>
</svg>`;

// Store guidance: a 128px icon holds 96px of art inside 16px of transparent padding. Toolbar sizes use the full box.
const SIZES = { 16: -1.2, 32: -1, 48: 0, 128: 3 };
for (const [size, pad] of Object.entries(SIZES)) {
  const html = path.join(work, `i${size}.html`);
  writeFileSync(html, `<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg(pad)}`);
  const shot = path.join(work, `i${size}.png`);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=200,200`, `--screenshot=${shot}`, `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', shot, '-vf', `crop=${size}:${size}:0:0`, path.join(out, `icon-${size}.png`)]);
  console.log(`icon-${size}.png`);
}
rmSync(work, { recursive: true, force: true });
