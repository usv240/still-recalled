// Builds the demo video: every frame is drawn by scripts/demo/stage.js in a headless Chrome and encoded, then the
// narration is laid under it. Captions are burned in and also written as an .srt file.
//   takes:  scripts/demo/record.mjs (frames with times and named moments), plus the clip recorded on the Pixel
//   voice:  scripts/demo/voice.py (one audio file a scene, with word times)
// Usage: node scripts/demo/build.mjs [--dir=E:/still-recalled-video] [--stills=3.5,12,40] [--sheet] [--scene=asks]
//   --stills  write PNG frames at these seconds (of the whole video) instead of the video; "all" = one every 2 s
//   --scene   with --stills: times are within that scene; without: render only that scene (no sound)
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const DIR = opt('dir', 'E:/still-recalled-video');
const TAKES = path.join(DIR, 'takes'), BUILD = path.join(DIR, 'build'), VOICE = path.join(BUILD, 'voice');
const FPS = 30, W = 1920, H = 1080;
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).replace(/%23/g, '#').replace(/%20/g, ' ');
const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'inherit'] });
mkdirSync(BUILD, { recursive: true });

// The Pixel clip as a take: frames at 30 a second, and the three moments the scene uses (found from the clip itself:
// the shared listing arrives at 2.8 s, the result at 11.45 s, "How it was checked" is on screen from 39.3 s).
const pixelDir = path.join(TAKES, 'pixel');
if (!existsSync(path.join(pixelDir, 'take.json'))) {
  mkdirSync(pixelDir, { recursive: true });
  ff(['-i', path.join(DIR, 'android-nano-shared-clean.mp4'), '-vf', 'fps=30,scale=672:-2', '-q:v', '3', path.join(pixelDir, 'f%06d.jpg')]);
  const frames = readdirSync(pixelDir).filter(f => /^f\d+\.jpg$/.test(f)).sort().map((f, i) => ({ f, t: +(i / 30).toFixed(3) }));
  writeFileSync(path.join(pixelDir, 'take.json'), JSON.stringify({ name: 'pixel', width: 672, height: 1420, marks: [{ name: 'share', t: 2.8 }, { name: 'result', t: 11.45 }, { name: 'how', t: 39.4 }], frames }));
}
// The web page in a Chrome with no built-in model, recorded 2026-11-26 by scripts/record-phone.mjs (docs/accuracy.md,
// section 38). Its file runs 1.197 times its wall clock; the marks are in file time, with the real seconds beside them.
const cloudDir = path.join(TAKES, 'cloud-earlier');
if (!existsSync(path.join(cloudDir, 'take.json')) && existsSync(path.join(DIR, 'fallback/web-cloud.webm'))) {
  mkdirSync(cloudDir, { recursive: true });
  ff(['-i', path.join(DIR, 'fallback/web-cloud.webm'), '-vf', 'fps=12.5', '-q:v', '3', path.join(cloudDir, 'f%06d.jpg')]);
  const frames = readdirSync(cloudDir).filter(f => /^f\d+\.jpg$/.test(f)).sort().map((f, i) => ({ f, t: +(i / 12.5).toFixed(3) }));
  writeFileSync(path.join(cloudDir, 'take.json'), JSON.stringify({ name: 'cloud-earlier', width: 390, height: 844, notes: { from: 'fallback/web-cloud.webm', nano: 'no built-in model in this Chrome' },
    marks: [{ name: 'click', t: 4.5 }, { name: 'read', t: 54.8, realSeconds: 42, text: 'Read in the cloud', box: { x: 16, y: 322, w: 358, h: 68 } }, { name: 'result', t: 93.2, realSeconds: 74 }, { name: 'result shown', t: 94.4, cy: 258 },{ name: 'end', t: 111.8 }], frames }));
}
const takes = {};
for (const d of readdirSync(TAKES)) { const f = path.join(TAKES, d, 'take.json'); if (existsSync(f)) takes[d] = JSON.parse(readFileSync(f, 'utf8')); }
const voice = JSON.parse(readFileSync(path.join(VOICE, 'voice.json'), 'utf8'));

const font = f => pathToFileURL(path.resolve(here, '../../extension/fonts', f)).href;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${font('Geist-Regular.woff2')}"); font-weight: 400; }
@font-face { font-family: Geist; src: url("${font('Geist-Medium.woff2')}"); font-weight: 500; }
@font-face { font-family: Geist; src: url("${font('Geist-SemiBold.woff2')}"); font-weight: 600; }
${readFileSync(path.join(here, 'stage.css'), 'utf8')}</style>
<div id="stage"></div><div id="cap"><span></span></div>
<script>${readFileSync(path.join(here, 'stage.js'), 'utf8')}</script>`;
const stageFile = path.join(BUILD, 'stage.html');
writeFileSync(stageFile, html);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, protocolTimeout: 0,
  args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'] });
let info;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('stage error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('stage:', m.text()); });
  await page.goto(pathToFileURL(stageFile).href, { waitUntil: 'load' });
  info = await page.evaluate(d => window.setup(d), { fps: FPS, voice, takes, takesUrl: pathToFileURL(TAKES).href });
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  console.log(info.scenes.map((s, i) => `${i + 1} ${s.id.padEnd(9)} ${mmss(s.start)}  ${s.dur.toFixed(1)} s`).join('\n'));
  console.log(`total ${mmss(info.duration)} (${info.duration.toFixed(2)} s)`);
  if (info.duration > 179) console.log('WARNING: longer than 2:59');

  const stamp = s => { const ms = Math.max(0, Math.round(s * 1000)); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  writeFileSync(path.join(DIR, 'still-recalled-demo.srt'), info.captions.map((c, i) => `${i + 1}\n${stamp(c.a)} --> ${stamp(c.b)}\n${c.text}\n`).join('\n'));

  const only = opt('scene', ''), sc = only ? info.scenes.find(s => s.id === only) : null;
  if (only && !sc) throw new Error(`no scene "${only}"`);
  const cdp = await page.createCDPSession();
  const shot = async (t, format = 'jpeg') => {
    await page.evaluate(x => window.render(x), t);
    // A capture can fail when the computer is short of memory; wait and try again.
    for (let attempt = 0; ; attempt++) {
      try {
        const { data } = await cdp.send('Page.captureScreenshot', format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 94, optimizeForSpeed: true });
        return Buffer.from(data, 'base64');
      } catch (e) {
        if (attempt >= 8) throw e;
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  };

  const stills = opt('stills', '');
  if (stills) {
    const out = path.join(BUILD, 'stills');
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const base = sc ? sc.start : 0, len = sc ? sc.dur : info.duration;
    const times = stills === 'all' ? Array.from({ length: Math.ceil(len / 2) }, (_, i) => i * 2 + 0.5).filter(t => t < len) : stills.split(',').map(Number);
    for (const [n, t] of times.entries()) writeFileSync(path.join(out, `s${String(n + 1).padStart(3, '0')}.jpg`), await shot(base + t));
    console.log(times.map((t, n) => `${n + 1}: ${t.toFixed(1)}`).join('  '));
    console.log(`wrote ${times.length} stills to ${out}`);
    if (args.includes('--sheet')) {
      const cols = Math.min(4, times.length), rows = Math.ceil(times.length / cols);
      ff(['-framerate', '1', '-i', path.join(out, 's%03d.jpg'), '-vf', `scale=960:-2,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', '-update', '1', '-q:v', '3', path.join(BUILD, 'sheet.jpg')]);
    }
  } else {
    const from = sc ? Math.round(sc.start * FPS) : 0, to = sc ? Math.round((sc.start + sc.dur) * FPS) : Math.round(info.duration * FPS);
    const silent = path.join(BUILD, sc ? `scene-${sc.id}.mp4` : 'video.mp4');
    const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      // --enc=nvenc encodes on the graphics card, which needs little memory; the default is x264.
      ...(opt('enc', 'x264') === 'nvenc' ? ['-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', '-cq', '16', '-b:v', '0', '-maxrate', '24M', '-bufsize', '48M', '-g', '60']
        : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '15']), '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
    enc.stdin.on('error', () => {});
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      const buf = await shot(f / FPS);
      if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
      if ((f - from) % 300 === 0) console.log(`  frame ${f - from} of ${to - from}, ${Math.round((Date.now() - t0) / 1000)} s`);
    }
    enc.stdin.end();
    await new Promise((res, rej) => enc.on('close', c => (c ? rej(new Error(`ffmpeg exited ${c}`)) : res())));
    if (!sc || args.includes('--join')) {
      // --join (with --scene=<the last one rendered>): the scenes were rendered one at a time; put them end to end.
      if (sc) {
        const list = path.join(BUILD, 'scenes.txt');
        writeFileSync(list, info.scenes.map(s => `file '${path.join(BUILD, `scene-${s.id}.mp4`).replace(/\\/g, '/')}'`).join('\n'));
        ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(BUILD, 'video.mp4')]);
      }
      const silent = path.join(BUILD, 'video.mp4');
      // The narration: each scene's audio starts at the scene's start plus its lead.
      const inputs = info.scenes.flatMap((s, i) => ['-i', path.join(VOICE, `scene-${i + 1}.mp3`)]);
      const delays = info.scenes.map((s, i) => `[${i}:a]adelay=${Math.round((s.start + s.lead) * 1000)}:all=1[a${i}]`).join(';');
      const mix = `${delays};${info.scenes.map((_, i) => `[a${i}]`).join('')}amix=inputs=${info.scenes.length}:normalize=0,apad=whole_dur=${info.duration.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[a]`;
      const wav = path.join(BUILD, 'narration.wav');
      ff([...inputs, '-filter_complex', mix, '-map', '[a]', '-ar', '48000', '-ac', '2', '-t', info.duration.toFixed(3), wav]);
      const final = path.join(DIR, 'still-recalled-demo.mp4');
      ff(['-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
      console.log(`wrote ${final}`);
    } else console.log(`wrote ${silent}`);
  }
} finally {
  await browser.close();
}
