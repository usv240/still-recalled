// Development page: the label check on real labels. Each case is a label close-up from a CPSC recall notice, read by
// the extension's own readLabel (Firebase AI Logic hybrid: the built-in model when the device has it) and judged by
// shared/label.mjs against the recall card. Each label is judged twice: against its own recall, where the answer
// should be "recalled", and against a different recall of the same kind of product, where it should not be.
// window.__labels() -> tools/label-results.json; window.__labels({ cloud: true }) -> the cloud model reads instead,
// tools/label-results-cloud.json
import { readLabel, useCards } from '../extension/src/engine.js';
import { judgeLabel, LABEL_SYSTEM, LABEL_SCHEMA } from '../shared/label.mjs';
import { cloudJson } from '../extension/src/ai.js';

useCards('/extension/data/cards.json');
const log = line => { document.getElementById('log').textContent += line + '\n'; };

// [recall, label photo, another recall of the same kind to judge it against]
export const CASES = [
  ['21158', 'https://www.cpsc.gov/s3fs-public/ThelawlabelontherecalledRumbleSeat.png', '20164'],
  ['21706', 'https://www.cpsc.gov/s3fs-public/2-10849PM.png', '10212'],
  ['20164', 'https://www.cpsc.gov/s3fs-public/2-104845AM.png', '20052'],
  ['20121', 'https://www.cpsc.gov/s3fs-public/3_29.png', '17096'],
  ['20052', 'https://www.cpsc.gov/s3fs-public/3_22.png', '20164'],
  ['18088', 'https://www.cpsc.gov/s3fs-public/fan2_0.png', '89024'],
  ['18058', 'https://www.cpsc.gov/s3fs-public/Mattress label with date of manufacture and model number.jpg', '08296'],
  ['17231', 'https://www.cpsc.gov/s3fs-public/photo 3_3.jpg', '20121'],
  ['17146', 'https://www.cpsc.gov/s3fs-public/Combi Stroller pic 3.jpg', '20052'],
  ['17096', 'https://www.cpsc.gov/s3fs-public/swing3.jpg', '16143'],
  ['16226', 'https://www.cpsc.gov/s3fs-public/Recall.2016.16226.16226b.jpg', '16226'],
  ['21747', 'https://www.cpsc.gov/s3fs-public/LocationofLabelManufactureCodeManufactureDate.jpg', '21125'],
];

async function asJpeg(url) {
  const blob = await (await fetch(`/img?u=${encodeURIComponent(url)}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(jpeg); });
}

window.__labels = async ({ cloud = false } = {}) => {
  const cards = new Map((await (await fetch('/extension/data/cards.json')).json()).cards.map(c => [c.id, c]));
  const rows = [];
  for (const [id, url, otherId] of CASES) {
    const t0 = performance.now();
    let reading = null, source = '', error = '';
    try {
      const photo = await asJpeg(url);
      if (cloud) {
        const [, mimeType, data] = /^data:([^;]+);base64,(.+)$/.exec(photo);
        reading = (await cloudJson({ system: LABEL_SYSTEM, schema: LABEL_SCHEMA, parts: ['Read the label in this photo.', { inlineData: { mimeType, data } }] })).answer;
        source = 'in_cloud';
      } else ({ reading, source } = await readLabel(photo, cards.get(id)));
    } catch (e) { error = String(e).slice(0, 160); }
    const own = reading ? judgeLabel(reading, cards.get(id)).state : 'error';
    const other = reading && otherId !== id ? judgeLabel(reading, cards.get(otherId)).state : '';
    const row = { id, otherId, source, ms: Math.round(performance.now() - t0), read: reading && reading.model_numbers, year: reading && reading.year, own, other, listed: cards.get(id).codes.slice(0, 6), error };
    rows.push(row);
    log(`${id} ${source.padEnd(9)} own=${own.padEnd(10)} other=${String(other).padEnd(10)} read=${JSON.stringify(row.read)} ${row.year || ''} listed=${row.listed.join(',')} ${row.ms}ms ${error}`);
  }
  await fetch(`/save-as?name=label-results${cloud ? '-cloud' : ''}`, { method: 'POST', body: JSON.stringify({ when: new Date().toISOString(), rows }) });
  document.title = 'labels: done';
  return rows;
};
