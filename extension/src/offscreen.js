// Offscreen page: a hidden extension page that hosts the checking engine, so listings are checked with the panel closed.
import './engine.js';
import { deviceStatus, deviceModel } from './ai.js';

// Developer setup check (dev.html): is the on-device model reachable from here?
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || msg.type !== 'sr:offscreen-check') return false;
  (async () => {
    const out = { status: await deviceStatus() };
    if (out.status === 'available') {
      try {
        const t0 = performance.now();
        const result = await deviceModel({}).generateContent('Reply with the single word: ready');
        out.text = result.response.text().trim().slice(0, 40);
        out.inferenceSource = result.response.inferenceSource;
        out.ms = Math.round(performance.now() - t0);
      } catch (e) {
        out.error = String(e);
      }
    }
    reply(out);
  })();
  return true;
});
