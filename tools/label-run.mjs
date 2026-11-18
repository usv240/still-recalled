// Runs tools/label-test.html in the test profile that has Chrome's built-in model (tools/nano-profile.mjs).
// Usage: node tools/label-run.mjs [--cloud] [--profile=C:/tmp/sr-nano-profile]
import puppeteer from 'puppeteer-core';
import { builtInModelArgs } from './chrome-args.mjs';
const profile = (process.argv.find(a => a.startsWith('--profile=')) || '--profile=C:/tmp/sr-nano-profile').slice(10);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false, pipe: true, ignoreDefaultArgs: true, protocolTimeout: 0, args: [...builtInModelArgs({ userDataDir: profile }), '--no-default-browser-check'] });
try {
  const p = await b.newPage();
  p.on('console', m => { if (/^\d{5} /.test(m.text())) console.log(m.text()); });
  await p.goto('http://localhost:8766/tools/label-test.html', { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => typeof window.__labels === 'function');
  for (let i = 0; i < 24; i++) { if (await p.evaluate(() => LanguageModel.availability({ expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] })) === 'available') break; await new Promise(r => setTimeout(r, 5000)); }
  await p.evaluate(cloud => window.__labels({ cloud }), process.argv.includes('--cloud'));
  console.log((await p.$eval('#log', e => e.textContent)).trim());
} finally { await b.close(); }
