// Development only: the Android app's "I own it" mode on a running emulator or phone, through adb. Chooses "I own it",
// shares a text that names a recalled product, and checks the result speaks to the owner.
//   node tools/android-owner.mjs      (the app must be installed: node tools/android-e2e.mjs installs it)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ADB = path.join(process.env.LOCALAPPDATA || '', 'Android/Sdk/platform-tools/adb.exe');
const PKG = 'app.web.stillrecalled';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' }, maxBuffer: 64 << 20 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const screen = () => { adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml'); return adb('shell', 'cat', '/sdcard/ui.xml'); };
const texts = xml => [...xml.matchAll(/text="([^"]+)"/g)].map(m => m[1].replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
function tap(xml, text) {
  // uiautomator writes an apostrophe either as it is or as &apos;, depending on the Android version.
  const m = xml.match(new RegExp(`text="${text.replace(/'/g, "(?:'|&apos;)")}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) return false;
  adb('shell', 'input', 'tap', String((+m[1] + +m[3]) >> 1), String((+m[2] + +m[4]) >> 1));
  return true;
}

let failed = 0;
const steps = [];
const step = (name, ok, detail = '') => { if (!ok) failed++; steps.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`); };

adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
await sleep(2500);
adb('shell', 'input', 'keyevent', '4');
await sleep(1200);
adb('shell', 'am', 'start', '-n', `${PKG}/.MainActivity`);
await sleep(2000);
let xml = screen();
step('the start screen offers "I own it"', tap(xml, 'I own it'));
await sleep(1200);
step('the heading follows the choice', texts(screen()).some(t => /before you sell it or pass it on/i.test(t)));
adb('logcat', '-c');
adb('shell', 'am', 'start', '-a', 'android.intent.action.SEND', '-t', 'text/plain', '--es', 'android.intent.extra.TEXT', `'Boppy newborn lounger, floral cover'`, '-n', `${PKG}/.MainActivity`);
let done = false;
for (let i = 0; i < 40 && !done; i++) { await sleep(2000); done = /check done in/.test(adb('logcat', '-d', '-v', 'brief')); }
await sleep(1500);
const seen = texts(screen());
const action = seen.find(t => /sell it or give it away/i.test(t)) || '';
step('a recalled product: the result speaks to the owner', /^Don't sell it or give it away/.test(action), action);
step('no buyer wording on the owner\'s card', !seen.some(t => /before you buy|the listing|the seller/i.test(t)), seen.find(t => /before you buy|the listing|the seller/i.test(t)) || '');
adb('shell', 'input', 'swipe', '540', '1700', '540', '700', '300');
await sleep(1000);
const more = [...seen, ...texts(screen())];
step('it says what the recall offers', more.some(t => /illegal to sell any recalled product/.test(t)) && more.some(t => /remedy/i.test(t)), (more.find(t => /remedy/i.test(t)) || '').slice(0, 120));
step('no question for a seller, no report', !more.some(t => /Copy and send the question|Report to CPSC/.test(t)));
// Back to the buyer's side, so later tests start as before: the app's saved choice is cleared with its data.
adb('shell', 'cmd', 'statusbar', 'collapse');
adb('shell', 'pm', 'clear', PKG);
const version = (adb('shell', 'dumpsys', 'package', PKG).match(/versionName=(\S+)/) || [])[1] || '';
mkdirSync('tools/android-e2e-out', { recursive: true });
writeFileSync('tools/android-e2e-out/owner-report.json', JSON.stringify({ at: new Date().toISOString(), version, failed, steps }, null, 1));
console.log(JSON.stringify({ failed, version }));
process.exit(failed ? 1 : 0);
