// Development page: first cloud calls through Firebase AI Logic with App Check (debug token).
// Open http://localhost:8766/tools/cloud-test.html and call window.__cloud().
import { cloudModel, imagePart, hasCloudAccess, CLOUD_MODEL } from '../extension/src/ai.js';
import { SYSTEM, SCHEMA, promptText } from '../shared/judge.mjs';
import { bannedHints } from '../shared/banned.mjs';

const log = line => { document.getElementById('log').textContent += line + '\n'; };

async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const out = await fn();
    log(`${label}: OK in ${Math.round(performance.now() - t0)} ms\n  ${out}`);
    return true;
  } catch (e) {
    log(`${label}: FAILED in ${Math.round(performance.now() - t0)} ms\n  ${String(e).slice(0, 600)}`);
    return false;
  }
}

window.__cloud = async (model = CLOUD_MODEL) => {
  document.title = 'cloud test: running';
  log(`debug token in build: ${hasCloudAccess}; model: ${model}`);

  const ok = await timed('text', async () => {
    const r = await cloudModel({ model }).generateContent('Reply with the single word: ready');
    return `"${r.response.text().trim()}" source=${r.response.inferenceSource ?? 'n/a'}`;
  });

  if (ok) {
    await timed('photo + schema', async () => {
      const listing = { title: 'Baby lounger nest, newborn, used twice', description: 'Soft padded lounger, washable cover.' };
      const hints = bannedHints(listing.title);
      const part = await imagePart('/extension/data/sample-lounger.jpg');
      const r = await cloudModel({ model, system: SYSTEM, schema: SCHEMA }).generateContent([promptText(listing, null, hints), part]);
      return r.response.text().trim();
    });
  }
  document.title = 'cloud test: done';
};
