// Builds the demo video from real footage, slides drawn from the test reports, and narration with captions.
//   footage: scripts/record-demo.mjs (the extension on a live eBay search) and scripts/record-phone.mjs (the web page)
//   numbers: tools/eval-report.json, tools/fresh-report.json, tools/third-report.json (every figure is measured)
//   voice:   edge-tts (Microsoft neural voice; the narration text is sent to Microsoft's speech service)
// Writes <out>/still-recalled-demo.mp4 (1920x1080, 30 fps) and <out>/still-recalled-demo.srt.
// Usage: node scripts/make-video.mjs [--out=C:/tmp/video] [--footage=ebay|craigslist] [--voice=en-US-AvaNeural] [--rate=+6%]
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const OUT = opt('out', 'C:/tmp/video');
const VOICE = opt('voice', 'en-US-AvaNeural');
const RATE = opt('rate', '+6%');
const W = 1920, H = 1080, FPS = 30;
const work = path.join(OUT, 'build');
mkdirSync(work, { recursive: true });
// ffmpeg's caption and label filters need TTF files; the repo ships Geist as woff2. Converted copies (fontTools) live here.
const FONTS = opt('fonts', path.join(OUT, 'fonts'));
if (!existsSync(path.join(FONTS, 'Geist-Medium.ttf'))) throw new Error(`Geist TTF files missing in ${FONTS}: convert extension/fonts/*.woff2 with fontTools`);
const esc = p => p.replace(/\\/g, '/').replace(':', '\\:');
const run = (cmd, a) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const ff = a => run('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
const duration = f => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const pct = x => `${Math.round(x * 100)}%`;

// ---- Numbers, from the reports ----------------------------------------------------------------------------------
const reports = ['tools/eval-report.json', 'tools/fresh-report.json', 'tools/third-report.json', 'tools/fourth-report.json'].filter(existsSync).map(read);
const sum = f => reports.reduce((s, r) => s + f(r), 0);
const N = {
  tests: reports.length,
  listings: sum(r => r.listings),
  mustFlag: sum(r => r.mustFlag),
  mustNotFlag: sum(r => r.mustNotFlag),
  caught: k => sum(r => r.systems[k].caught),
  alarms: k => sum(r => r.systems[k].falseAlarms.length),
  cloudShare: sum(r => r.cost.sentToCloud) / sum(r => r.cost.listings),
};
// The marketplace footage: eBay (scripts/record-demo.mjs) or another site (--url=... --name=craigslist).
const SRC = opt('footage', existsSync(path.join(OUT, 'ebay.json')) && read(path.join(OUT, 'ebay.json')).end ? 'ebay' : 'craigslist');
// The recorder's times are wall-clock seconds; Puppeteer's screencast file runs longer than the wall clock (frames are
// timed at the encoder's rate, 1.2x on this machine). Every time is scaled to the file's own length so a scene cuts
// the moment it was meant to.
const lastFrame = f => parseFloat(run('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', f]).trim().split(/\s+/).pop());
const onFileTime = (marks, file) => {
  const k = lastFrame(file) / marks.end.t;
  const out = { ...marks };
  for (const [name, v] of Object.entries(marks)) if (v && typeof v.t === 'number') out[name] = { ...v, t: +(v.t * k).toFixed(2) };
  return out;
};
const M = onFileTime(read(path.join(OUT, `${SRC}.json`)), path.join(OUT, `${SRC}.webm`));
const pick = M.pick;
const SITE = { ebay: 'eBay', craigslist: 'Craigslist', mercari: 'Mercari' }[SRC] || SRC;
const lounger = /lounger|nest/i.test(pick.badge);
const an = w => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

// ---- Narration: one entry per scene. Neutral voice; every number comes from the reports. ------------------------
const scenes = [
  { key: 'hook', footage: SRC, from: M['search loaded'].t, to: M['first badge'].t + 1.5,
    say: lounger
      ? `A parent shopping ${SITE} for a used baby lounger sees listings like these. Infant loungers are never safe for sleep: young babies can't lift their heads away from the soft padding, and many have been recalled. Nothing on the page says so.`
      : `A parent shopping ${SITE} for used crib bedding sees sets like these. Some include padded crib bumpers. Selling one has been against federal law since 2022, because bumpers can suffocate a baby. The titles rarely say so, and nothing on the page warns the parent.` },
  { key: 'scan', footage: SRC, from: M['first badge'].t + 1.5, to: M['engine done'].t, label: 'sped up',
    say: `Still Recalled is a Chrome extension that checks every listing on the page, against every CPSC recall since 1973. Chrome's built-in model, Gemini Nano, looks at each title and photo right on this laptop. Only the listings it flags go to Gemini in the cloud, through Firebase AI Logic, with the full recall notice and both photos.` },
  { key: 'card', footage: SRC, from: M['listing in view'].t - 1, to: M.end.t,
    say: lounger
      ? `This one is flagged as ${an(pick.badge.toLowerCase())}: the built-in model saw it in the photo, and the cloud confirmed it${pick.where ? ', and outlined exactly where it saw it' : ''}. The card says why, and gives the shopper the one question that settles it. For products the law bans outright, like padded crib bumpers, it also copies a ready report for CPSC.`
      : `This listing is flagged as ${an(pick.badge.toLowerCase())}. The card shows the seller's photo and the rule, asks the seller the one question that settles it, and when the law rules the sale out, copies a ready report for CPSC, which has listings like this taken down.` },
  { key: 'hybrid', slide: 'hybrid',
    say: `Why hybrid? A search page has sixty listings, and a parent scrolls through hundreds. Screening them all in the cloud would send their browsing to a server and cost money for every look. So screening runs only on the device, and the cloud only confirms. The cloud also wrote the device's field guide: it read all ten thousand recall notices once, so the laptop can match every one of them on its own. Across ${["", "one", "two", "three", "four"][N.tests] || N.tests} tests, ${pct(1 - N.cloudShare)} of listings never left the laptop.` },
  { key: 'results', slide: 'results',
    say: `It was tested ${['', 'once', 'twice', 'three times', 'four times'][N.tests] || `${N.tests} times`}, on ${N.listings} real listings it had never seen, labelled blind. Word rules alone raised ${N.alarms('words only')} false alarms. The built-in model cut that to ${N.alarms('on-device only')} by looking at the photos, and the cloud check cut it to ${N.alarms('hybrid')}, while catching ${N.caught('hybrid')} of the ${N.mustFlag} listings that should be flagged.` },
  { key: 'phone', footage: 'phone', slide: 'phone',
    say: `A phone has no built-in model, so the web page asks Firebase AI Logic to prefer the device, and the same call runs on Gemini in the cloud instead. Take a screenshot of any listing, even on Facebook Marketplace, and get the same check.` },
  { key: 'close', slide: 'close',
    say: `It never says a product is safe: no match only means no recall was found. Still Recalled. Free, and open source.` },
];

// ---- Slides -------------------------------------------------------------------------------------------------------
const font = f => pathToFileURL(path.resolve('extension/fonts', f)).href;
const base = `
@font-face { font-family: Geist; src: url("${font('Geist-Regular.woff2')}"); font-weight: 400; }
@font-face { font-family: Geist; src: url("${font('Geist-Medium.woff2')}"); font-weight: 500; }
@font-face { font-family: Geist; src: url("${font('Geist-SemiBold.woff2')}"); font-weight: 600; }
:root { --ground: #f8f8f8; --surface: #fff; --text: #0a0a0a; --muted: #5e5e5e; --rule: #e6e6e6; --primary: #141414;
  --likely: #c4242a; --quiet: #c9c9c9; --cloud: #eef1f6; }
* { box-sizing: border-box; }
html, body { margin: 0; width: ${W}px; height: ${H}px; background: var(--ground); color: var(--text); font-family: Geist, system-ui, sans-serif; }
.slide { width: ${W}px; height: ${H}px; padding: 80px 140px 190px; display: flex; flex-direction: column; justify-content: center; }
h1 { font-size: 64px; line-height: 1.06; font-weight: 600; letter-spacing: -0.025em; margin: 0; max-width: 1500px; text-wrap: balance; }
.lede { font-size: 28px; line-height: 1.4; color: var(--muted); margin: 22px 0 0; max-width: 1400px; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 24px; }
.brand i { width: 18px; height: 18px; border-radius: 4px; background: var(--likely); display: inline-block; }
code { font-family: Geist, monospace; font-size: 20px; background: #ececec; padding: 3px 8px; border-radius: 5px; }
`;
const SLIDES = {
  hybrid: `<style>${base}
.zones { display: grid; grid-template-columns: 2fr 1fr; gap: 28px; margin-top: 64px; }
.zone { border-radius: 14px; padding: 36px; display: flex; flex-direction: column; gap: 24px; }
.laptop { background: var(--surface); border: 1px solid var(--rule); }
.cloud { background: var(--cloud); } .cloud code { background: #dde3ec; }
.zone h2 { margin: 0; font-size: 22px; font-weight: 600; color: var(--muted); }
.steps { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.step { display: flex; flex-direction: column; gap: 12px; }
.what { font-size: 34px; font-weight: 600; letter-spacing: -0.01em; }
.how { font-size: 23px; line-height: 1.45; color: var(--muted); }
</style><div class="slide">
<h1>Every listing is checked on the laptop. Only the few it flags go to the cloud.</h1>
<p class="lede">Firebase AI Logic runs the same prompt and JSON schema on Chrome's built-in Gemini Nano and on Gemini in the cloud.</p>
<div class="zones">
  <div class="zone laptop"><h2>On the laptop. Nothing leaves it.</h2><div class="steps">
    <div class="step"><span class="what">1. Word rules</span><span class="how">Every title against all 10,089 CPSC recalls since 1973. Parts, toys and doll items dropped.</span></div>
    <div class="step"><span class="what">2. Gemini Nano</span><span class="how">Baby products: title and photo. The product, a part or a toy? A lounger, a padded bumper?<br><br><code>ONLY_ON_DEVICE</code></span></div>
  </div></div>
  <div class="zone cloud"><h2>In the cloud</h2>
    <div class="step"><span class="what">3. Gemini</span><span class="how">Only flagged listings, with the full recall notice and its photo. Confirms or clears.</span></div>
  </div>
</div></div>`,
  results: (() => {
    const rows = [['words only', 'Word rules only'], ['on-device only', 'Built-in model only'], ['hybrid', 'Hybrid']];
    const chart = (title, of, val) => `<div class="chart"><h3>${title}</h3>${rows.map(([k, label]) => {
      const v = val(k); const w = v ? Math.max(1, Math.round((v / of) * 84)) : 0;
      return `<div class="row"><span class="lab">${label}</span><span class="track"><span class="bar ${k === 'hybrid' ? 'is-h' : ''}" style="width:${w}%"></span><span class="val">${v}</span></span></div>`;
    }).join('')}</div>`;
    return `<style>${base}
.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; margin-top: 72px; }
.chart h3 { margin: 0 0 22px; font-size: 26px; font-weight: 500; color: var(--muted); }
.row { display: grid; grid-template-columns: 290px 1fr; align-items: center; gap: 18px; height: 64px; }
.lab { font-size: 27px; }
.track { display: flex; align-items: center; gap: 16px; height: 30px; }
.bar { display: block; height: 30px; border-radius: 0 5px 5px 0; background: var(--quiet); }
.bar.is-h { background: var(--primary); }
.val { font-size: 34px; font-weight: 600; font-variant-numeric: tabular-nums; }
</style><div class="slide">
<h1>The built-in model removes false alarms. The cloud catches what words miss.</h1>
<p class="lede">${['', 'One', 'Two', 'Three', 'Four'][N.tests] || N.tests} blind tests, ${N.listings} real listings from eBay${reports.length > 2 ? ', Mercari' : ''} and Craigslist that the rules had never seen.</p>
<div class="charts">${chart(`False alarms, among ${N.mustNotFlag} listings that were fine`, Math.max(...rows.map(([k]) => N.alarms(k))), N.alarms)}${chart(`Caught, of ${N.mustFlag} that should be flagged`, N.mustFlag, N.caught)}</div>
</div>`;
  })(),
  phone: `<style>${base}
.slide { padding-left: 860px; justify-content: center; }
h1 { font-size: 60px; }
.frame { position: absolute; left: 250px; top: 60px; width: 470px; height: 960px; border-radius: 44px; background: #111; }
</style><div class="frame"></div><div class="slide">
<h1>On a phone, the same call runs in the cloud.</h1>
<p class="lede"><code>PREFER_ON_DEVICE</code> reads the screenshot on the device when Chrome has a built-in model, and on Gemini in the cloud when it doesn't. The page says which one ran.</p>
</div>`,
  close: `<style>${base}
.slide { justify-content: center; align-items: flex-start; }
.brand { font-size: 72px; gap: 24px; letter-spacing: -0.02em; } .brand i { width: 48px; height: 48px; border-radius: 10px; }
.links { margin-top: 48px; font-size: 32px; line-height: 1.6; color: var(--muted); }
.links b { color: var(--text); font-weight: 500; }
</style><div class="slide">
<div class="brand"><i></i>Still Recalled</div>
<div class="links"><b>still-recalled.web.app</b><br>Chrome extension and code: <b>github.com/usv240/still-recalled</b><br>Built with Firebase AI Logic hybrid inference</div>
</div>`,
};

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, pipe: true, args: ['--allow-file-access-from-files'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  for (const [name, html] of Object.entries(SLIDES)) {
    const f = path.join(work, `slide-${name}.html`);
    writeFileSync(f, `<!doctype html><meta charset="utf-8">${html}`);
    await page.goto(pathToFileURL(f).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(work, `slide-${name}.png`) });
  }
} finally {
  await browser.close();
}

// ---- Narration, then each scene's picture cut to the narration's length -----------------------------------------
const srt = [];
let clock = 0;
const clips = [];
const stamp = s => { const ms = Math.round(s * 1000); const h = String(Math.floor(ms / 3600000)).padStart(2, '0'); const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0'); const sec = String(Math.floor(ms / 1000) % 60).padStart(2, '0'); return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`; };
const parseSrt = text => text.trim().split(/\r?\n\r?\n/).map(b => { const l = b.split(/\r?\n/); const [a, z] = l[1].split(' --> ').map(t => { const [hh, mm, rest] = t.split(':'); const [ss, ms] = rest.split(','); return +hh * 3600 + +mm * 60 + +ss + +ms / 1000; }); return { a, z, text: l.slice(2).join(' ') }; });
for (const s of scenes) {
  const mp3 = path.join(work, `${s.key}.mp3`), sub = path.join(work, `${s.key}.srt`);
  run('edge-tts', ['--voice', VOICE, `--rate=${RATE}`, '--text', s.say, '--write-media', mp3, '--write-subtitles', sub]);
  const said = duration(mp3);
  const D = +(said + 0.7).toFixed(2);
  for (const c of parseSrt(readFileSync(sub, 'utf8'))) srt.push({ a: clock + c.a, z: clock + c.z, text: c.text });
  const clip = path.join(work, `${s.key}.mp4`);
  const vf = `fps=${FPS},format=yuv420p`;
  if (s.footage && s.footage !== 'phone') {
    const span = s.to - s.from;
    const speed = span / D;
    const label = s.label && speed > 1.3 ? `,drawtext=fontfile='${esc(path.join(FONTS, 'Geist-Medium.ttf'))}':text='${Math.round(speed)}x speed':x=w-tw-40:y=36:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12` : '';
    ff(['-ss', String(s.from), '-t', String(span), '-i', path.join(OUT, `${s.footage}.webm`), '-vf', `setpts=PTS/${speed},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0xf8f8f8${label},${vf}`, '-t', String(D), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', clip]);
  } else if (s.footage === 'phone') {
    const raw = read(path.join(OUT, 'phone.json'));
    const k = lastFrame(path.join(OUT, 'phone.webm')) / raw.end;   // the phone recorder saves bare numbers
    const ph = Object.fromEntries(Object.entries(raw).map(([name, v]) => [name, typeof v === 'number' ? +(v * k).toFixed(2) : v]));
    const from = Math.max(0, ph['example tapped'] - 1.5), span = ph.end - from;
    const speed = Math.max(1, span / D);
    ff(['-loop', '1', '-i', path.join(work, 'slide-phone.png'), '-ss', String(from), '-i', path.join(OUT, 'phone.webm'),
      '-filter_complex', `[1:v]setpts=PTS/${speed},scale=440:-2[ph];[0:v][ph]overlay=265:75:shortest=0,${vf}`, '-t', String(D), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', clip]);
  } else {
    ff(['-loop', '1', '-i', path.join(work, `slide-${s.slide}.png`), '-vf', vf, '-t', String(D), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', clip]);
  }
  const wav = path.join(work, `${s.key}.wav`);
  ff(['-i', mp3, '-af', `apad=whole_dur=${D}`, '-ar', '48000', '-ac', '2', wav]);
  clips.push({ clip, wav, D });
  clock += D;
  console.log(`${s.key.padEnd(8)} ${D.toFixed(1)} s`);
}

// ---- Join, then burn in the captions ---------------------------------------------------------------------------------
writeFileSync(path.join(work, 'video.txt'), clips.map(c => `file '${c.clip.replace(/\\/g, '/')}'`).join('\n'));
writeFileSync(path.join(work, 'audio.txt'), clips.map(c => `file '${c.wav.replace(/\\/g, '/')}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(work, 'video.txt'), '-c', 'copy', path.join(work, 'joined.mp4')]);
ff(['-f', 'concat', '-safe', '0', '-i', path.join(work, 'audio.txt'), '-c', 'pcm_s16le', path.join(work, 'narration.wav')]);
const srtFile = path.join(OUT, 'still-recalled-demo.srt');
writeFileSync(srtFile, srt.map((c, i) => `${i + 1}\n${stamp(c.a)} --> ${stamp(c.z)}\n${c.text}\n`).join('\n'));
// Captions as ASS at the video's own size: with plain SRT, libass lays out on a 384 x 288 canvas.
const assTime = t => { const cs = Math.round(t * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const assFile = path.join(work, 'captions.ass');
writeFileSync(assFile, [
  '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', '',
  '[V4+ Styles]',
  'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
  'Style: Cap,Geist Medium,40,&H00FFFFFF,&H00FFFFFF,&H28141414,&H28141414,0,0,0,0,100,100,0,0,3,14,0,2,260,260,56,1',
  '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ...srt.map(c => `Dialogue: 0,${assTime(c.a)},${assTime(c.z)},Cap,,0,0,0,,${c.text.replace(/\r?\n/g, ' ')}`),
].join('\n'));
ff(['-i', path.join(work, 'joined.mp4'), '-i', path.join(work, 'narration.wav'),
  '-vf', `ass='${esc(assFile)}':fontsdir='${esc(FONTS)}'`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart',
  path.join(OUT, 'still-recalled-demo.mp4')]);
console.log(`wrote ${path.join(OUT, 'still-recalled-demo.mp4')} (${clock.toFixed(1)} s) and the captions ${srtFile}`);
