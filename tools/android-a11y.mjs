// Accessibility check of the Android app on a running emulator or phone, through adb and uiautomator: on each screen,
// at normal text size and at 200 percent, every tappable element must be at least 48 by 48 dp (Android's minimum
// touch target), must have a name a screen reader can say, and nothing may run off the screen's edge. Screenshots of
// each go to tools/android-a11y-out. The inputs are words only (no listing photo, nothing a model is asked about), so
// no model is called.
//
//   node tools/android-a11y.mjs [--apk=android/app/build/outputs/apk/release/app-release.apk]
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const apk = (args.find(a => a.startsWith('--apk=')) || '').slice(6) || 'android/app/build/outputs/apk/release/app-release.apk';
const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe');
const PKG = 'app.web.stillrecalled';
const out = path.resolve('tools/android-a11y-out');
mkdirSync(out, { recursive: true });
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 64 << 20 });
// A phone on wireless debugging can be listed twice (its address and its mDNS name): use one. ANDROID_SERIAL chooses.
if (!process.env.ANDROID_SERIAL) {
  const listed = adb('devices').split('\n').slice(1).filter(l => /\tdevice\b/.test(l)).map(l => l.split('\t')[0]);
  if (listed.length > 1) { process.env.ANDROID_SERIAL = listed[0]; console.log(`several devices listed; using ${listed[0]} (set ANDROID_SERIAL to choose)`); }
}
const shot = name => writeFileSync(path.join(out, `${name}.png`), execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function dump() {
  for (let i = 0; i < 4; i++) {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    const xml = adb('shell', 'cat', '/sdcard/ui.xml');
    // A slow emulator can put Android's own "System UI isn't responding" dialog over the app: choose Wait, look again.
    const wait = /isn(?:'|&apos;)t responding/.test(xml) && xml.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!wait) return xml;
    adb('shell', 'input', 'tap', String((+wait[1] + +wait[3]) >> 1), String((+wait[2] + +wait[4]) >> 1));
    execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 2500)']);
  }
  return '';
}
const density = +(adb('shell', 'wm', 'density').match(/(\d+)\s*$/m) || [0, 420])[1] / 160;
const [, width, height] = (adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/m) || [0, 1080, 2400]).map(Number);

const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
/** The nodes of a uiautomator dump, each with its own attributes and the text of the nodes inside it. */
function nodes(xml) {
  const list = [];
  const stack = [];
  for (const m of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node>/g)) {
    if (m[0] === '</node>') { const n = stack.pop(); if (n) list.push(n); continue; }
    const a = attrs(m[1]);
    const b = (a.bounds || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    const n = { ...a, box: b ? b.slice(1).map(Number) : [0, 0, 0, 0], inner: [] };
    for (const s of stack) s.inner.push(a.text || '', a['content-desc'] || '');
    if (m[2] === '/') list.push(n); else stack.push(n);
  }
  return list.filter(n => n.package === PKG);
}

const results = [];
function audit(screen) {
  const all = nodes(dump());
  const tappable = all.filter(n => n.clickable === 'true' || n.checkable === 'true');
  const scrollers = all.filter(n => n.scrollable === 'true');
  const problems = [];
  for (const n of tappable) {
    const [x1, y1, x2, y2] = n.box;
    const w = (x2 - x1) / density, h = (y2 - y1) / density;
    const name = [n.text, n['content-desc'], ...n.inner].filter(Boolean).join(' ').trim();
    // A target cut by the screen's edge, or by the edge of the scrolling area (under the tab bar), is only scrolled
    // part way into view: its size is measured on a later screen.
    const cut = y1 <= 0 || y2 >= height - 1 || scrollers.some(s => s.box[1] < y2 && y1 < s.box[3] && (y1 <= s.box[1] + 1 || y2 >= s.box[3] - 1));
    if (!cut && (w < 47.5 || h < 47.5)) problems.push(`small target ${Math.round(w)}x${Math.round(h)} dp: "${name.slice(0, 40)}"`);
    // A field scrolled mostly out of view can lose its label from the dump; it is checked whole on another screen.
    if (!name && !cut) problems.push(`no spoken name: ${n.class} at ${n.bounds}`);
  }
  for (const n of all) if (n.box[2] > width + 1 || n.box[0] < -1) problems.push(`off the screen's edge: ${n.class} "${(n.text || '').slice(0, 30)}" ${n.bounds}`);
  results.push({ screen, tappable: tappable.length, problems });
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${screen}: ${tappable.length} tappable${problems.length ? '\n       ' + problems.join('\n       ') : ''}`);
  shot(screen.replace(/[^\w]+/g, '-'));
}
function tap(text) {
  const n = nodes(dump()).find(n => n.text === text || n['content-desc'] === text);
  if (!n) return false;
  adb('shell', 'input', 'tap', String((n.box[0] + n.box[2]) >> 1), String((n.box[1] + n.box[3]) >> 1));
  return true;
}
const share = text => adb('shell', 'am', 'start', '-a', 'android.intent.action.SEND', '-t', 'text/plain', '--es', 'android.intent.extra.TEXT', `'${text}'`, '-n', `${PKG}/.MainActivity`);
/** Every screen of the page, scrolled through, audited at each step. */
async function auditScrolled(screen, pages = 4) {
  let last = '';
  for (let i = 0; i < pages; i++) {
    const xml = dump();
    if (xml === last) break;
    last = xml;
    audit(`${screen} ${i + 1}`);
    adb('shell', 'input', 'swipe', String(width >> 1), String(height * 0.7 | 0), String(width >> 1), String(height * 0.3 | 0), '400');
    await sleep(900);
  }
}

// A phone with a second user (Private Space, a work profile) refuses installs for every user: install for the owner.
try { adb('install', '-r', '--user', '0', apk); } catch { adb('shell', 'pm', 'uninstall', '--user', '0', PKG); adb('install', '--user', '0', apk); }
adb('shell', 'pm', 'grant', '--user', '0', PKG, 'android.permission.POST_NOTIFICATIONS');
const before = adb('shell', 'settings', 'get', 'system', 'font_scale').trim();
// Text size is a setting of the whole phone. An emulator is checked at 100 and 200 percent, and set back. Someone's
// own phone is checked at the size its owner chose, and the setting is not touched, unless --large-text asks for
// 200 percent too.
const emulator = adb('shell', 'getprop', 'ro.kernel.qemu').trim() === '1';
const own = before === 'null' ? '1.0' : before;
const scales = emulator ? ['1.0', '2.0'] : args.includes('--large-text') ? [own, '2.0'] : [own];
if (!emulator) console.log(`a phone, not an emulator: checked at its own text size (${Math.round(+own * 100)}%)${args.includes('--large-text') ? ' and at 200%' : ''}`);
// A real phone's log rolls over within seconds: the app's own lines are streamed for the whole run.
let logText = '';
const logcat = spawn(ADB, ['logcat', '-v', 'brief', '-s', 'StillRecalled:V'], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
logcat.stdout.on('data', d => { logText += d.toString(); });
try {
  for (const scale of scales) {
    if (scale !== before) adb('shell', 'settings', 'put', 'system', 'font_scale', scale);
    adb('shell', 'am', 'force-stop', PKG);
    logText = '';
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
    await sleep(6000);
    const tag = `text ${Math.round(+scale * 100)}%`;
    await auditScrolled(`start screen, ${tag}`);
    tap('Watching'); await sleep(1500);
    await auditScrolled(`watching, ${tag}`, 2);
    tap('How it works'); await sleep(1500);
    await auditScrolled(`how it works, ${tag}`);
    tap('Check'); await sleep(1500);
    share('Wooden building blocks, painted'); await sleep(4000);
    await auditScrolled(`no match, ${tag}`);
    tap('← Check another'); await sleep(1200);
    share('this one, like new, pick up only'); await sleep(4000);
    const vague = dump();
    results.push({ screen: `words that name no product, ${tag}`, problems: /Watch for recalls/.test(vague) ? ['offers Watch for recalls with nothing to watch'] : [] });
    console.log(`${/Watch for recalls/.test(vague) ? 'FAIL' : 'ok  '} words that name no product, ${tag}: no watch offered`);
    await auditScrolled(`nothing to match, ${tag}`, 2);
    const callLines = logText.split('\n').filter(l => /model call:/.test(l));
    const calls = callLines.length;
    if (calls) console.log(callLines.map(l => '       ' + l.trim().slice(0, 160)).join('\n'));
    results.push({ screen: `model calls, ${tag}`, problems: calls ? [`${calls} model calls`] : [] });
    console.log(`${calls ? 'FAIL' : 'ok  '} model calls at ${tag}: ${calls}`);
    tap('← Check another'); await sleep(1000);
  }
} finally {
  if (adb('shell', 'settings', 'get', 'system', 'font_scale').trim() !== before) adb('shell', 'settings', 'put', 'system', 'font_scale', own);
  logcat.kill();
}
const failed = results.filter(r => r.problems.length).length;
writeFileSync(path.join(out, emulator ? 'report.json' : 'report-phone.json'), JSON.stringify({ at: new Date().toISOString(), apk, device: emulator ? 'emulator' : 'phone', density, width, results }, null, 2));
console.log(JSON.stringify({ screens: results.length, failed }));
process.exit(failed ? 1 : 0);
