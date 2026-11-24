// End-to-end test of the Android app on a running emulator or phone, through adb: the real app, the real App Check
// bridge, Firebase AI Logic and the CPSC API.
//
//   node tools/android-e2e.mjs [--apk=android/app/build/outputs/apk/release/app-release.apk] [--watch]
//
// --watch replays a recall arriving after a purchase: the app forgets the recalls fetched since its build, a
// Kidsview bouncer (recalled 2026-11-19) is checked and watched, then the recall list is refreshed and the watch must
// raise a notification. It needs a debug build (the "forget" switch exists only there), with no debug token in
// android/local.properties, so App Check still goes through the bridge.
//
// --nano is for a phone with Gemini Nano (AICore; for example a recent Pixel or Galaxy flagship): the run fails unless
// the app reports the on-device model as available and the example photo is read on the phone. The report records the
// phone, the model and, for each check, whether its reading ran on the device. The model can take a while to download
// the first time; open the app once and let it finish ("Gemini Nano is ready on this phone" on the start screen) first.
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe');
const PKG = 'app.web.stillrecalled';
const apk = opt('apk', args.includes('--watch') ? 'android/app/build/outputs/apk/debug/app-debug.apk' : 'android/app/build/outputs/apk/release/app-release.apk');
const out = path.resolve('tools/android-e2e-out');
mkdirSync(out, { recursive: true });

const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 64 << 20 });
// A phone on wireless debugging can be listed twice (its address and its mDNS name): use one. ANDROID_SERIAL chooses.
if (!process.env.ANDROID_SERIAL) {
  const listed = adb('devices').split('\n').slice(1).filter(l => /\tdevice\b/.test(l)).map(l => l.split('\t')[0]);
  if (listed.length > 1) { process.env.ANDROID_SERIAL = listed[0]; console.log(`several devices listed; using ${listed[0]} (set ANDROID_SERIAL to choose)`); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A real phone's log rolls over within seconds, so reading it back afterwards misses lines: the app's own tags are
// streamed into memory for the whole run. "Clearing" the log starts a new section of that stream.
let logText = '';
const logcat = spawn(ADB, ['logcat', '-v', 'brief', '-s', 'StillRecalled:V', 'AppCheckBridge:V', 'WM-WorkerWrapper:V'], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
logcat.stdout.on('data', d => { logText += d.toString().replace(/\r/g, ''); });
const log = () => logText;
const clearLog = () => { logText = ''; };
const results = { apk, build: /debug/.test(apk) ? 'debug' : 'release', steps: [], checks: [] };
const step = (name, ok, detail = '') => { results.steps.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
async function waitFor(re, ms) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(1500)) { const m = log().match(re); if (m) return m; }
  return null;
}
function tapText(text) {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  let xml = adb('shell', 'cat', '/sdcard/ui.xml');
  // A slow emulator can put Android's own "System UI isn't responding" dialog over the app: choose Wait, look again.
  const wait = /isn(?:'|&apos;)t responding/.test(xml) && xml.match(/text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (wait) {
    adb('shell', 'input', 'tap', String((+wait[1] + +wait[3]) >> 1), String((+wait[2] + +wait[4]) >> 1));
    execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 2500)']);
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    xml = adb('shell', 'cat', '/sdcard/ui.xml');
    results.dialogsDismissed = (results.dialogsDismissed || 0) + 1;
  }
  const m = xml.match(new RegExp(`text="${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
  return true;
}
const share = text => adb('shell', 'am', 'start', '-a', 'android.intent.action.SEND', '-t', 'text/plain', '--es', 'android.intent.extra.TEXT', `'${text}'`, '-n', `${PKG}/.MainActivity`);
async function check(name, start, expect) {
  clearLog();
  start();
  const m = await waitFor(/check done in (\d+) ms: (\w+) \/ ([^;]*); read on device: (\w+); how: (\{.*\})/, 120000);
  if (!m) return step(name, false, 'no result in 120 s');
  const how = JSON.parse(m[5]);
  const calls = [...log().matchAll(/model call: ([^,]+), (\d+) ms/g)].map(c => `${c[1]} ${c[2]} ms`);
  results.checks.push({ name, ms: +m[1], level: m[2], badge: m[3], readOnDevice: m[4], how, calls });
  step(name, expect(m[2], m[3], how), `${m[2]} / ${m[3] || 'no match'} in ${(m[1] / 1000).toFixed(1)} s (${calls.join(', ') || 'no model call'})`);
}

try {
  step('device connected', /\tdevice/.test(adb('devices')));
  // A build signed with another key (debug vs release) can't update in place: start from a clean install.
  // A phone with a second user (Private Space, a work profile) refuses installs for every user: install for the owner.
  try { adb('install', '-r', '--user', '0', apk); } catch { adb('shell', 'pm', 'uninstall', '--user', '0', PKG); adb('install', '--user', '0', apk); }
  adb('shell', 'pm', 'clear', '--user', '0', PKG);
  adb('shell', 'pm', 'grant', '--user', '0', PKG, 'android.permission.POST_NOTIFICATIONS');
  clearLog();
  const t0 = Date.now();
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  const tok = await waitFor(/AppCheckBridge.*token received/, 45000);
  step('App Check token from the reCAPTCHA bridge', !!tok, tok ? `${((Date.now() - t0) / 1000).toFixed(0)} s after launch` : '');
  const dm = (log().match(/on-device model: ([^;]+); device ([^\r\n]+)/) || []);
  // The phone's family and Android version only (for example "Google Pixel, Android 17"), not its exact model.
  const phone = (dm[2] || '').trim().match(/^(\S+) (\S+).*?(Android \S+)?$/);
  results.device = { model: (dm[1] || 'unknown').trim(), phone: phone ? `${phone[1]} ${phone[2]}${phone[3] ? ', ' + phone[3] : ''}` : '' };
  results.emulator = adb('shell', 'getprop', 'ro.kernel.qemu').trim() === '1' || /sdk_gphone|emulator/i.test(adb('shell', 'getprop', 'ro.product.model'));
  console.log(`device: ${results.device.phone}; on-device model: ${results.device.model}`);
  if (args.includes('--nano')) step('Gemini Nano available on this phone', /^available/.test(results.device.model), results.device.model);
  const caught = await waitFor(/Worker result SUCCESS for Work.*RecallWorker/, 120000);
  step('recall list catches up with CPSC (background worker)', !!caught);
  await sleep(3000);

  // The example is a made-up listing for a VEVOR lounger, recall 26591, which covers every unit: the check must name it.
  await check('example photo: VEVOR lounger, recall 26591', () => tapText('Try it with an example photo'), (lv, _b, how) => lv !== 'none' && /^26591 /.test(how.candidate || ''));
  if (args.includes('--nano')) {
    const ex = results.checks.find(c => c.name.startsWith('example photo'));
    step('the example photo was read by Gemini Nano on the phone', !!ex && ex.readOnDevice === 'true', ex ? `read on device: ${ex.readOnDevice}` : '');
  }
  adb('shell', 'input', 'keyevent', '4');
  await check('shared text: Rock n Play', () => share("Fisher-Price Rock n Play sleeper, pink, folds flat"), (lv, _b, how) => lv !== 'none' && /^\d+ /.test(how.candidate || ''));
  await check('shared text: Graco swing', () => share('Graco baby swing, wind-up, still swings'), lv => lv !== 'none');
  // CPSC warned about these loungers in 2026; their seller never recalled them, so the recall API has no notice.
  await check('shared text: a product CPSC warned about (Aila+Aiden lounger)', () => share('Aila+Aiden baby lounger, grey, like new'), (lv, badge, how) => lv !== 'none' && /^W26-742 /.test(how.candidate || '') && /CPSC warning/.test(badge));
  // The words name no brand, only a nickname ("the rock and play one"), so the phone's word rules find only a type.
  // The cloud knows the product by that description, calls lookup_recalls, and the field guide on the phone answers
  // (function calling). The type flag stands; the recall is named on the card.
  await check('shared text: no brand, only a nickname (the cloud asks the phone)', () => share('Inclined baby sleeper, pink, folds flat. It is the rock and play one everyone had, used 3 months'),
    (lv, _badge, how) => lv !== 'none' && !how.candidate && (how.lookups || []).some(l => l.found.includes('23088')));
  await check('shared text: wooden blocks', () => share('Wooden building blocks, painted'), lv => lv === 'none');
  await check('shared text: recall published after the build (Kidsview, 2026-11-19)', () => share('Kidsview baby bouncer with toy bar, khaki'), (lv, _b, how) => lv !== 'none');

  // What logcat holds about a check: where each step ran and recall numbers, never the shopper's words or the
  // cloud's answer.
  const said = JSON.stringify(results.checks.map(c => c.how));
  step('the log keeps no listing words or cloud answers', results.checks.length > 0 && !/"(answer|asked|cloud|seen|deviceError|cloudError)"|Kidsview|bouncer|lounger|Rock n Play/i.test(said));

  // Back from a shared check returns to the app that shared it (here the launcher), with the result kept.
  await sleep(1500);
  adb('shell', 'input', 'keyevent', '4');
  await sleep(2000);
  const resumed = () => (adb('shell', 'dumpsys', 'activity', 'activities').match(/(?:mResumedActivity|topResumedActivity)[^\n]*/) || [''])[0];
  // On someone's own phone the app on top is one of theirs: the report says only whether it was this one.
  const top = resumed();
  step('Back after a share leaves the app', !top.includes(PKG), top.includes(PKG) ? 'Still Recalled is still on top' : 'another app is on top (its name is not kept)');

  // Android closes the app in the background (low memory, or the user was away in Messenger): the result comes back.
  clearLog();
  adb('shell', 'am', 'kill', PKG);
  await sleep(1500);
  // pidof exits with an error when no process has the name: that is the state wanted here.
  const killed = (() => { try { return !adb('shell', 'pidof', PKG).trim(); } catch { return true; } })();
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  const back = await waitFor(/result restored after the app was closed/, 30000);
  await sleep(1500);
  const screen = () => { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); return adb('shell', 'cat', '/sdcard/ui.xml'); };
  step('the result survives Android closing the app', killed && !!back && /Kidsview/i.test(screen()));
  tapText('← Check another');
  await sleep(1500);

  // Typed or shared words that name no product say so, not "no recall found". No model call.
  await check('shared text: words that name no product', () => share('this one, like new, pick up only'), lv => lv === 'none');
  await sleep(1500);
  step('words that name no product: "We couldn\'t tell what the product is"', /tell what the product is/.test(screen()));

  if (args.includes('--watch')) {
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`, '--ez', 'dev_forget_live', 'true');
    await sleep(3000);
    await check('watch: the bouncer before its recall arrives', () => share('Kidsview baby bouncer with toy bar, khaki. Bought 2022, used a few months.'), lv => lv === 'none');
    { const [, w, h] = (adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/m) || [0, 1080, 2400]).map(Number); adb('shell', 'input', 'swipe', String(w >> 1), String(h * 0.7 | 0), String(w >> 1), String(h * 0.37 | 0), '300'); }
    await sleep(800);
    step('watch: Watch for recalls', tapText('Watch for recalls'));
    await sleep(1500);
    tapText('Watching');
    await sleep(1500);
    clearLog();
    const t1 = Date.now();
    step('watch: Check for new recalls now', tapText('↻ Check for new recalls now'));
    let note = '';
    for (; Date.now() - t1 < 240000; await sleep(3000)) {
      note = adb('shell', 'dumpsys', 'notification', '--noredact');
      if (note.includes(`pkg=${PKG}`)) break;
    }
    const shown = note.includes(`pkg=${PKG}`);
    const title = (note.match(/android\.title=String \(([^)]*)\)/) || [])[1] || '';
    step('watch: a new recall raises a notification', shown, shown ? `${((Date.now() - t1) / 1000).toFixed(0)} s: "${title}"` : '');
    adb('exec-out', 'screencap', '-p');
  }
} catch (e) {
  step('run', false, String(e).slice(0, 300));
}
writeFileSync(path.join(out, args.includes('--nano') ? 'report-nano.json' : args.includes('--watch') ? 'report-watch.json' : 'report.json'), JSON.stringify({ at: new Date().toISOString(), ...results }, null, 2));
const failed = results.steps.filter(s => !s.ok).length;
console.log(JSON.stringify({ passed: results.steps.length - failed, failed }));
logcat.kill();
process.exit(failed ? 1 : 0);
