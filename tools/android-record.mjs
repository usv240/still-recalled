// Records Still Recalled on a real phone with Gemini Nano, for the demo video: the start screen saying Gemini Nano is
// ready, the example photo (a made-up listing) read on the phone and named as recall 26591, "How it was checked", then
// a listing shared as text. Only the app's own screens and made-up listings are on screen. It changes no setting; turn
// on Do Not Disturb first so no notification lands on the recording, and look at the frames before using the clip.
// About two cloud calls. Crop the status bar before using a clip (its notification icons are the owner's):
//   ffmpeg -i in.mp4 -vf "crop=iw:ih-150:0:150" -an out.mp4
//
//   node tools/android-record.mjs [--out=E:/still-recalled-video/android-nano-real.mp4] [--scenes=example,shared]
// One clip per scene, named after it (android-nano-real-example.mp4).
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const OUT = arg('out') || 'E:/still-recalled-video/android-nano-real.mp4';
const PKG = 'app.web.stillrecalled';
const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe');
const env = { ...process.env, MSYS_NO_PATHCONV: '1' };
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 << 20, env }).replace(/\r/g, '');
if (!process.env.ANDROID_SERIAL) {
  const listed = adb('devices').split('\n').slice(1).filter(l => /\tdevice\b/.test(l)).map(l => l.split('\t')[0]);
  if (listed.length > 1) env.ANDROID_SERIAL = process.env.ANDROID_SERIAL = listed[0];
}
const shell = cmd => adb('shell', cmd);
const pause = ms => new Promise(r => setTimeout(r, ms));
const [W, H] = shell('wm size').match(/(\d+)x(\d+)\s*$/m).slice(1).map(Number);
const X = W >> 1;

const unescape = s => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function onScreen() {
  let xml = '';
  try { xml = shell('uiautomator dump /sdcard/sr-ui.xml >/dev/null 2>&1; cat /sdcard/sr-ui.xml 2>/dev/null || true'); } catch {}
  const nodes = [];
  for (const [node] of xml.matchAll(/<node [^>]*>/g)) {
    const a = Object.fromEntries([...node.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const b = (a.bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    const text = unescape(a.text || a['content-desc'] || '');
    if (text && b && a.package === PKG) nodes.push({ text, x: (+b[1] + +b[3]) >> 1, y: (+b[2] + +b[4]) >> 1 });
  }
  return nodes;
}
async function waitFor(test, ms, what) {
  for (const end = Date.now() + ms; Date.now() < end; await pause(700)) { const n = onScreen().find(test); if (n) return n; }
  throw new Error(`timed out waiting for ${what}`);
}
const tap = n => shell(`input tap ${n.x} ${n.y}`);
// "Check another" shows while the check runs too: the result is in when the checking steps are gone.
const STEPS = /^(Connecting securely|Reading the (screenshot|listing)|Searching recall notices|Looking closer)/;
async function result(what) {
  await waitFor(n => n.text === '← Check another', 120000, what);
  for (const end = Date.now() + 120000; Date.now() < end; await pause(700)) if (!onScreen().some(n => STEPS.test(n.text))) return;
  throw new Error(`timed out waiting for ${what}`);
}
// Slow swipes, so the clip reads as a person scrolling.
const scroll = (frac = 0.32, ms = 1100) => shell(`input swipe ${X} ${Math.round(H * 0.72)} ${X} ${Math.round(H * (0.72 - frac))} ${ms}`);
const toTop = async () => { for (let i = 0; i < 6; i++) shell(`input swipe ${X} ${Math.round(H * 0.3)} ${X} ${Math.round(H * 0.85)} 150`); await pause(500); };
async function scrollTo(test, what) {
  let last = '';
  for (let i = 0; i < 30; i++) {
    const nodes = onScreen(), n = nodes.find(test), now = JSON.stringify(nodes);
    // In view, or at the foot of the page (the screen no longer changes when scrolled).
    if (n && (n.y < H * 0.62 || now === last)) return n;
    last = now; scroll(); await pause(600);
  }
  throw new Error(`could not find ${what}`);
}

// Each scene is its own clip: Android stops a screen recording at three minutes, and the cloud's half of a check can
// take most of a minute.
const scenes = {
  async example(mark) {
    mark('start screen'); await pause(2500);
    await scrollTo(n => /^Gemini Nano is ready on this phone/.test(n.text), 'the Gemini Nano line');
    mark('Gemini Nano is ready'); await pause(3000);
    await toTop(); await pause(800);
    tap(await waitFor(n => n.text === 'Try it with an example photo', 10000, 'the example button'));
    mark('check started');
    await result('the result');
    mark('result'); await pause(4000);
    await scrollTo(n => n.text === 'How it was checked', '"How it was checked"');
    mark('how it was checked'); await pause(5000);
  },
  // A listing shared from another app's share menu arrives as text.
  async shared(mark) {
    await pause(1500);
    shell(`am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "'Fisher-Price Rock n Play sleeper, pink, folds flat. Used 3 months.'" -n ${PKG}/.MainActivity`);
    mark('check started');
    await result('the result');
    mark('result'); await pause(4000);
    await scrollTo(n => n.text === 'How it was checked', '"How it was checked"');
    mark('how it was checked'); await pause(5000);
  },
};

for (const name of (arg('scenes') || 'example,shared').split(',')) {
  const out = OUT.replace(/\.mp4$/, `-${name}.mp4`);
  // The app is open before the recording starts, so the clip never opens on whatever the owner had on screen.
  shell(`am force-stop ${PKG}`);
  shell(`am start -n ${PKG}/.MainActivity`);
  await waitFor(n => n.text === 'Try it with an example photo', 60000, 'the start screen');
  shell('rm -f /sdcard/sr-real.mp4');
  const rec = spawn(ADB, ['shell', 'screenrecord', '--time-limit', '180', '--bit-rate', '8000000', '/sdcard/sr-real.mp4'], { env, stdio: 'ignore' });
  await pause(1500);
  const t0 = Date.now();
  const at = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
  const mark = what => console.log(`${name} ${at()}  ${what}`);
  // Someone using the phone during a take can pull down the notification shade or switch apps: their messages and
  // other apps would be on the clip. Every second, note when anything but this app has the screen.
  const away = [];
  const watch = setInterval(() => {
    try {
      const focus = (shell('dumpsys window 2>/dev/null | grep -m1 mCurrentFocus') || '').trim();
      if (focus && !focus.includes(PKG)) away.push(`${at().trim()} s`);
    } catch {}
  }, 1000);
  try {
    await scenes[name](mark);
  } catch (e) {
    console.log(`${name} stopped: ${e.message}`);
  } finally {
    clearInterval(watch);
    try { shell('pkill -INT screenrecord'); } catch {}
    await pause(2500);
    rec.kill();
    if (away.length) console.log(`${name} WARNING: something other than Still Recalled had the screen at ${away.join(', ')}. Cut those seconds or record again.`);
    mkdirSync(path.dirname(out), { recursive: true });
    adb('pull', '/sdcard/sr-real.mp4', out);
    shell('rm -f /sdcard/sr-real.mp4 /sdcard/sr-ui.xml');
    console.log(`saved ${out}`);
  }
}
