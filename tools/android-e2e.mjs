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
import { execFileSync } from 'node:child_process';
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = () => adb('logcat', '-d', '-v', 'brief');
const results = { apk, build: /debug/.test(apk) ? 'debug' : 'release', steps: [], checks: [] };
const step = (name, ok, detail = '') => { results.steps.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };
async function waitFor(re, ms) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(1500)) { const m = log().match(re); if (m) return m; }
  return null;
}
function tapText(text) {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
  const xml = adb('shell', 'cat', '/sdcard/ui.xml');
  const m = xml.match(new RegExp(`text="${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
  return true;
}
const share = text => adb('shell', 'am', 'start', '-a', 'android.intent.action.SEND', '-t', 'text/plain', '--es', 'android.intent.extra.TEXT', `'${text}'`, '-n', `${PKG}/.MainActivity`);
async function check(name, start, expect) {
  adb('logcat', '-c');
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
  try { adb('install', '-r', apk); } catch { adb('uninstall', PKG); adb('install', apk); }
  adb('shell', 'pm', 'clear', PKG);
  adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS');
  adb('logcat', '-c');
  const t0 = Date.now();
  adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
  const tok = await waitFor(/AppCheckBridge.*token received/, 45000);
  step('App Check token from the reCAPTCHA bridge', !!tok, tok ? `${((Date.now() - t0) / 1000).toFixed(0)} s after launch` : '');
  const dm = (log().match(/on-device model: ([^;]+); device ([^\r\n]+)/) || []);
  results.device = { model: (dm[1] || 'unknown').trim(), phone: (dm[2] || '').trim() };
  console.log(`device: ${results.device.phone}; on-device model: ${results.device.model}`);
  if (args.includes('--nano')) step('Gemini Nano available on this phone', /^available/.test(results.device.model), results.device.model);
  const caught = await waitFor(/Worker result SUCCESS for Work.*RecallWorker/, 120000);
  step('recall list catches up with CPSC (background worker)', !!caught);
  await sleep(3000);

  await check('example photo: infant lounger', () => tapText('Try it with an example photo'), (lv, badge) => lv !== 'none' && /lounger/i.test(badge));
  if (args.includes('--nano')) {
    const ex = results.checks.find(c => c.name.startsWith('example photo'));
    step('the example photo was read by Gemini Nano on the phone', !!ex && ex.readOnDevice === 'true', ex ? `read on device: ${ex.readOnDevice}` : '');
  }
  adb('shell', 'input', 'keyevent', '4');
  await check('shared text: Rock n Play', () => share("Fisher-Price Rock n Play sleeper, pink, folds flat"), (lv, _b, how) => lv !== 'none' && /^\d+ /.test(how.candidate || ''));
  await check('shared text: Graco swing', () => share('Graco baby swing, wind-up, still swings'), lv => lv !== 'none');
  await check('shared text: wooden blocks', () => share('Wooden building blocks, painted'), lv => lv === 'none');
  await check('shared text: recall published after the build (Kidsview, 2026-11-19)', () => share('Kidsview baby bouncer with toy bar, khaki'), (lv, _b, how) => lv !== 'none');

  if (args.includes('--watch')) {
    adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`, '--ez', 'dev_forget_live', 'true');
    await sleep(3000);
    await check('watch: the bouncer before its recall arrives', () => share('Kidsview baby bouncer with toy bar, khaki. Bought 2022, used a few months.'), lv => lv === 'none');
    adb('shell', 'input', 'swipe', '540', '1700', '540', '900', '300');
    await sleep(800);
    step('watch: Watch for recalls', tapText('Watch for recalls'));
    await sleep(1500);
    tapText('Watching');
    await sleep(1500);
    adb('logcat', '-c');
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
process.exit(failed ? 1 : 0);
