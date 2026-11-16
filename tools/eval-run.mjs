// Runs the accuracy test harness (tools/eval-test.html) in the separate test profile that has Chrome's built-in model
// (made by tools/nano-profile.mjs), so a test run needs no one's own Chrome. Needs the local test server
// (node tools/collector.mjs) and a development build (npm run build), which carries the App Check debug token.
// Usage: node tools/eval-run.mjs --set=third [--mode=hybrid|words] [--resume] [--profile=C:/tmp/sr-nano-profile]
import puppeteer from 'puppeteer-core';
import { builtInModelArgs } from './chrome-args.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => (args.find(a => a.startsWith(`--${name}=`)) || `--${name}=${dflt}`).split('=').slice(1).join('=');
const set = opt('set', 'eval');
const mode = opt('mode', 'hybrid');
const profile = opt('profile', 'C:/tmp/sr-nano-profile');
const resume = args.includes('--resume');

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: false, pipe: true, ignoreDefaultArgs: true, protocolTimeout: 0,
  args: [...builtInModelArgs({ userDataDir: profile }), '--no-default-browser-check'],
});
try {
  const page = await browser.newPage();
  page.on('console', m => { const t = m.text(); if (/^\s*\d+ |model is|stopping|done/.test(t)) console.log(t.slice(0, 160)); });
  await page.goto('http://localhost:8766/tools/eval-test.html', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => typeof window.__eval === 'function', { timeout: 30000 });
  // The built-in model can report "downloadable" for a few seconds after Chrome starts.
  await page.waitForFunction(() => 'LanguageModel' in self, { timeout: 30000 });
  for (let i = 0; i < 24; i++) {
    const s = await page.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] }));
    if (s === 'available' || mode === 'words') break;
    await new Promise(r => setTimeout(r, 5000));
  }
  const t0 = Date.now();
  await page.evaluate((o) => window.__eval(o), { mode, set, resume });
  console.log(`${set} ${mode}: finished in ${Math.round((Date.now() - t0) / 1000)} s -> tools/${set}-results-${mode}.json`);
} finally {
  await browser.close();
}
