// Setup check. Answers two questions before the real product is built on top:
//   1. Does the Firebase hybrid SDK reach the on-device model from inside an extension, and from which pages?
//   2. Can the extension read listings on live marketplace pages?
// It then runs the real pipeline on a few listings and saves everything through the local collector.
import { deviceStatus, deviceModel, imagePart, cloudJson, hasCloudAccess } from './ai.js';
import { hasRealConfig } from './firebase-config.js';
import { buildIndex, shortlist } from '../../shared/shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from '../../shared/banned.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../../shared/judge.mjs';
import { fetchNotice } from '../../shared/notice.mjs';
import { CONFIRM_SYSTEM, CONFIRM_SCHEMA, confirmParts, decideFinal } from '../../shared/confirm.mjs';

/** The cloud check for one flagged listing. Returns the final decision; on any failure the on-device flag stands. */
async function confirmInCloud(listing, device, hints, listingPhoto) {
  if (!hasCloudAccess) return { final: decideFinal(device, null, hints), cloud: { skipped: 'no App Check token in this build' } };
  try {
    const notice = device.kind === 'recall' && device.card ? await fetchNotice(device.card.id) : null;
    const recallPhoto = notice && notice.images[0] ? await imagePart(notice.images[0]).catch(() => null) : null;
    const { answer, model } = await cloudJson({ system: CONFIRM_SYSTEM, schema: CONFIRM_SCHEMA, parts: confirmParts({ listing, notice, listingPhoto, recallPhoto }) });
    return { final: decideFinal(device, answer, hints), cloud: { model, answer } };
  } catch (e) {
    return { final: decideFinal(device, null, hints), cloud: { error: String(e).slice(0, 200) } };
  }
}

const COLLECTOR = 'http://localhost:8766/save';
const $ = id => document.getElementById(id);
const log = line => { $('log').textContent += line + '\n'; };
const timed = async fn => {
  const t0 = performance.now();
  try { return { ...(await fn()), ms: Math.round(performance.now() - t0) }; }
  catch (e) { return { error: String(e), ms: Math.round(performance.now() - t0) }; }
};

async function checkModelInPanel() {
  const status = await deviceStatus();
  log(`Built-in model seen from the side panel: ${status}`);
  const out = { status };
  if (status === 'unavailable' || status === 'absent') return out;

  const plain = deviceModel({});
  if (status !== 'available') {
    log('Downloading the model (one time, several GB)…');
    await plain.initializeDeviceModel(p => { $('run').textContent = `Downloading ${Math.round(p * 100)}%`; });
    $('run').textContent = 'Running…';
  }
  out.text = await timed(async () => {
    const r = await plain.generateContent('Reply with the single word: ready');
    return { answer: r.response.text().trim().slice(0, 40), inferenceSource: r.response.inferenceSource };
  });
  log(`Firebase SDK, text prompt: ${out.text.error || `"${out.text.answer}" from ${out.text.inferenceSource} in ${out.text.ms} ms`}`);

  out.image = await timed(async () => {
    const part = await imagePart(chrome.runtime.getURL('data/sample-lounger.jpg'));
    const r = await plain.generateContent(['In five words or fewer, what is in this photo?', part]);
    return { answer: r.response.text().trim().slice(0, 80), inferenceSource: r.response.inferenceSource };
  });
  log(`Firebase SDK, photo prompt: ${out.image.error || `"${out.image.answer}" from ${out.image.inferenceSource} in ${out.image.ms} ms`}`);
  return out;
}

async function checkOtherContexts() {
  const worker = await chrome.runtime.sendMessage({ type: 'sr:worker-status' }).catch(e => ({ error: String(e) }));
  log(`Model API present in the service worker: ${worker.languageModelInServiceWorker ?? worker.error}`);
  const opened = await chrome.runtime.sendMessage({ type: 'sr:open-offscreen' }).catch(e => ({ ok: false, error: String(e) }));
  let offscreen = { error: opened.error || 'could not open' };
  if (opened.ok) {
    await new Promise(r => setTimeout(r, 600));          // let the offscreen page load its script
    offscreen = await chrome.runtime.sendMessage({ type: 'sr:offscreen-check' }).catch(e => ({ error: String(e) }));
  }
  log(`Hidden (offscreen) page: ${offscreen.error || `${offscreen.status}${offscreen.text ? `, answered "${offscreen.text}" in ${offscreen.ms} ms` : ''}`}`);
  return { worker, offscreen };
}

async function readPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: 'no active tab' };
  let page;
  try {
    page = await chrome.tabs.sendMessage(tab.id, { type: 'sr:read-page' });
  } catch {
    // The tab was open before the extension loaded, so the content script is not in it yet.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['build/content.js'] });
      page = await chrome.tabs.sendMessage(tab.id, { type: 'sr:read-page' });
    } catch (e) {
      return { url: tab.url, error: 'This tab is not a supported marketplace page, or it needs a reload. ' + e };
    }
  }
  log(`Page: ${page.site || 'unknown site'}, ${page.count} listings found (${page.withImage} with a photo, ${page.withPrice} with a price)`);
  log(`Model API present in the page's content script: ${page.languageModelInContentScript}`);
  for (const l of page.sample.slice(0, 3)) log(`   • ${l.title.slice(0, 70)} ${l.price}`);
  return page;
}

async function runPipeline(page, modelOk) {
  if (!modelOk || !page.sample || !page.sample.length) return [];
  const { cards } = await (await fetch(chrome.runtime.getURL('data/cards.json'))).json();
  const index = buildIndex(cards);
  const judge = deviceModel({ system: SYSTEM, schema: SCHEMA });
  const rows = [];
  for (const listing of page.sample.slice(0, 6)) {
    if (notTheProduct(listing.title)) {
      rows.push({ title: listing.title, decision: 'none', why: 'part or toy (word rule)' });
      log(`   none     (part or toy)  ${listing.title.slice(0, 56)}`);
      continue;
    }
    const candidate = shortlist(index, listing.title)[0] || null;
    const hints = bannedHints(listing.title);
    const row = { title: listing.title, candidate: candidate && `${candidate.strength} ${candidate.card.id}`, hints: hints.map(h => h.key) };
    const res = await timed(async () => {
      const photo = listing.image ? await imagePart(listing.image) : null;
      const parts = [promptText(listing, candidate, hints)];
      if (photo) parts.push(photo);
      const r = await judge.generateContent(parts);
      const answer = JSON.parse(r.response.text());
      const d = decide(answer, candidate, hints, mayContain(listing.title));
      const out = { answer, inferenceSource: r.response.inferenceSource, onDevice: d.level, decision: d.level, why: d.why, hadPhoto: !!photo };
      // Only flagged listings, and sets that may hide a banned item, go to the cloud.
      if (d.level !== 'none' || d.askCloud) {
        const t0 = performance.now();
        const { final, cloud } = await confirmInCloud(listing, d, hints, photo);
        Object.assign(out, { decision: final.level, why: final.why, check: final.check || '', cloud, cloudMs: Math.round(performance.now() - t0) });
      }
      return out;
    });
    rows.push({ ...row, ...res });
    log(`   ${res.error ? 'ERROR ' + res.error : `${res.onDevice.padEnd(8)}${res.cloud ? ` -> ${res.decision.padEnd(8)} (cloud ${res.cloudMs} ms)` : ''} ${res.ms} ms`}  ${listing.title.slice(0, 56)}`);
  }
  return rows;
}

async function run() {
  $('run').disabled = true;
  $('run').textContent = 'Running…';
  $('log').textContent = '';
  const report = { when: new Date().toISOString(), chrome: navigator.userAgent, hasRealFirebaseConfig: hasRealConfig };
  report.panel = await checkModelInPanel().catch(e => ({ error: String(e) }));
  report.contexts = await checkOtherContexts().catch(e => ({ error: String(e) }));
  report.page = await readPage().catch(e => ({ error: String(e) }));
  const modelOk = report.panel && report.panel.text && !report.panel.text.error;
  log('Checking the first listings with the on-device model…');
  report.pipeline = await runPipeline(report.page, modelOk).catch(e => [{ error: String(e) }]);
  try {
    const r = await fetch(COLLECTOR, { method: 'POST', body: JSON.stringify(report) });
    log(r.ok ? '\nSaved. You can tell Claude it is done.' : '\nCould not save; copy this text instead.');
  } catch {
    log('\nCollector not running; copy this text instead.');
  }
  $('run').disabled = false;
  $('run').textContent = 'Run check';
}

$('run').addEventListener('click', run);
