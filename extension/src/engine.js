// The checking pipeline, run in the offscreen page so it works with the side panel closed.
//
//   1. words (instant, every listing)   shortlist a recall by brand, line or model number; spot banned-type words;
//                                       drop parts and toys; decide which listings need eyes
//   2. on-device model (photo + title)  only listings that could matter: a recall candidate, banned-type words, a
//                                       bedding set, or any infant product. Nothing leaves the device here.
//   3. cloud model                      only listings step 2 flagged, with the full recall notice and both photos
import { deviceStatus, deviceModel, imagePart, cloudJson, hasCloudAccess } from './ai.js';
import { buildIndex, shortlist } from '../../shared/shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from '../../shared/banned.mjs';
import { SYSTEM, SCHEMA, promptText, decide } from '../../shared/judge.mjs';
import { fetchNotice } from '../../shared/notice.mjs';
import { CONFIRM_SYSTEM, CONFIRM_SCHEMA, confirmParts, decideFinal } from '../../shared/confirm.mjs';
import { present } from '../../shared/present.mjs';

// Infant products get a photo check even without a recall candidate: a lounger listed as "baby bed" has no telling words.
const INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;

let indexPromise = null;
let cardsUrl = () => chrome.runtime.getURL('data/cards.json');
const index = () => (indexPromise ||= fetch(cardsUrl()).then(r => r.json()).then(d => buildIndex(d.cards)));
/** For pages that are not extension pages: the web page and the local accuracy test. */
export function useCards(url) { cardsUrl = () => url; indexPromise = null; }
/** Step 1 alone, for a page that shows its progress. */
export async function triageListing(listing) { return triage(await index(), listing); }

let judge = null;
const judgeModel = () => (judge ||= deviceModel({ system: SYSTEM, schema: SCHEMA }));
const DEVICE_TIMEOUT_MS = 45000;
const withTimeout = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} did not answer within ${ms / 1000} s`)), ms))]);

/** Step 1, for one listing. `needsEyes` says whether the on-device model should look at it. */
export function triage(idx, listing) {
  const text = `${listing.title} ${listing.description || ''}`;
  const partOrToy = notTheProduct(listing.title);
  const candidate = partOrToy ? null : shortlist(idx, text)[0] || null;
  const hints = partOrToy ? [] : bannedHints(text);
  const maybe = partOrToy ? [] : mayContain(listing.title);
  const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title));
  return { partOrToy, candidate, hints, maybe, needsEyes };
}

/** The whole pipeline for one listing. Returns a presented result (plain data). */
export async function checkListing(listing, opts) {
  return confirmInCloud(await lookOnDevice(listing, opts), opts);
}

/**
 * Steps 1 and 2. Returns a stage: either finished (`stage.result`) or waiting for the cloud. Split from step 3 so the
 * queue can run the built-in model on the next listing while cloud checks are still out.
 * `judge` replaces the on-device-only model: the web page passes a hybrid one, which runs on the device when it can.
 * `secondOpinion` (web page only): every baby product goes to the cloud, which may raise a soft flag on its own.
 */
export async function lookOnDevice(listing, { modelReady, cloud, imageUrl = u => u, judge: judgeOverride = null, secondOpinion = false }) {
  const idx = await index();
  const t = triage(idx, listing);
  if (!t.needsEyes) return { result: present(listing, { level: 'none', why: t.partOrToy ? 'part or toy' : 'no recall or risky type in the words' }, { words: true }) };

  let device, photo = null, usedDevice = false, deviceError = '';
  if (modelReady) {
    photo = listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null;
    const parts = [promptText(listing, t.candidate, t.hints)];
    if (photo) parts.push(photo);
    try {
      // A stuck model session must not stall the whole page: give up on this listing's look and start a fresh
      // session for the next one.
      const r = await withTimeout((judgeOverride || judgeModel()).generateContent(parts), DEVICE_TIMEOUT_MS, 'the built-in model');
      device = decide(JSON.parse(r.response.text()), t.candidate, t.hints, t.maybe);
      usedDevice = (r.response.inferenceSource || 'on_device') === 'on_device';
    } catch (e) {
      if (!judgeOverride) judge = null;
      deviceError = String(e).slice(0, 160);
      device = decide({ what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!t.candidate, banned_type: 'none' }, t.candidate, t.hints, t.maybe);
    }
  } else {
    // No built-in model on this computer: the words alone decide what the cloud should look at.
    device = decide({ what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!t.candidate, banned_type: 'none' }, t.candidate, t.hints, t.maybe);
  }

  if (secondOpinion && !/part or a toy/.test(device.why || '')) device = { ...device, secondOpinion: true };
  const deviceLevel = device.level === 'none' && device.askCloud ? 'ask' : device.level;
  const how = { device: usedDevice, deviceLevel, judgedInCloud: modelReady && !usedDevice && !deviceError, deviceError };
  const stage = { listing, hints: t.hints, device, photo, how, result: null };
  if ((device.level === 'none' && !device.askCloud && !device.secondOpinion) || !cloud || !hasCloudAccess) {
    stage.result = present(listing, device.level === 'none' ? device : decideFinal(device, null, t.hints), how);
  }
  return stage;
}

/** Step 3, for a stage lookOnDevice left open: the cloud reads the full recall notice and both photos. */
export async function confirmInCloud(stage, { imageUrl = u => u } = {}) {
  if (stage.result) return stage.result;
  const { listing, device, hints, how } = stage;
  try {
    const photo = stage.photo || (listing.image ? await imagePart(imageUrl(listing.image)).catch(() => null) : null);
    const notice = device.kind === 'recall' && device.card ? await fetchNotice(device.card.id) : null;
    const recallPhoto = notice && notice.images[0] ? await imagePart(imageUrl(notice.images[0])).catch(() => null) : null;
    const { answer, model } = await cloudJson({ system: CONFIRM_SYSTEM, schema: CONFIRM_SCHEMA, parts: confirmParts({ listing, notice, listingPhoto: photo, recallPhoto }) });
    return present(listing, decideFinal(device, answer, hints), { ...how, cloud: { model, answer } });
  } catch (e) {
    // The on-device flag stands, marked unconfirmed.
    return present(listing, device.level === 'none' ? device : decideFinal(device, null, hints), { ...how, cloudError: String(e).slice(0, 160) });
  }
}

// ---- Queue -------------------------------------------------------------------------------------------------------
// One listing at a time (the on-device model is one session). Listings that matched words go first, then the rest
// in page order. Jobs for a page the tab has left are dropped.
const queue = [];
let running = false;
const CLOUD_AT_ONCE = 2;   // the no-cost Gemini tier allows only a few requests a minute
let cloudBusy = 0;
const cloudWaiting = [];
const cloudSlot = () => (cloudBusy < CLOUD_AT_ONCE ? (cloudBusy++, Promise.resolve()) : new Promise(r => cloudWaiting.push(r)));
const releaseCloudSlot = () => { const next = cloudWaiting.shift(); if (next) next(); else cloudBusy--; };
const livePage = new Map();   // tabId -> pageKey

// Offscreen pages cannot read chrome.storage, so the background sends the shopper's settings with each batch.
function enqueue(tabId, pageKey, listings, { cloud = true } = {}) {
  livePage.set(tabId, pageKey);
  listings.forEach((listing, i) => queue.push({ tabId, pageKey, listing, order: listing.order ?? i, cloud }));
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  try {
    const idx = await index();
    while (queue.length) {
      // Re-rank each time: new pages arrive while old ones run.
      queue.sort((a, b) => rank(idx, a) - rank(idx, b) || a.order - b.order);
      const job = queue.shift();
      if (livePage.get(job.tabId) !== job.pageKey) continue;
      const status = await deviceStatus();
      const send = result => {
        result.order = job.order;
        chrome.runtime.sendMessage({ type: 'sr:engine-result', tabId: job.tabId, pageKey: job.pageKey, result }).catch(() => {});
      };
      const failed = e => send({ id: job.listing.id, listing: job.listing, level: 'error', kind: null, error: String(e).slice(0, 160) });
      let stage;
      try {
        stage = await lookOnDevice(job.listing, { modelReady: status === 'available', cloud: job.cloud });
      } catch (e) {
        failed(e);
        continue;
      }
      if (stage.result) { send(stage.result); continue; }
      // The built-in model is one session, so it works through listings one at a time; cloud checks run alongside it,
      // up to CLOUD_AT_ONCE. When all cloud slots are busy, the queue waits for one.
      await cloudSlot();
      confirmInCloud(stage).then(send, failed).finally(releaseCloudSlot);
    }
  } finally {
    running = false;
  }
}

const rankCache = new WeakMap();
function rank(idx, job) {
  if (!rankCache.has(job)) {
    const t = triage(idx, job.listing);
    rankCache.set(job, !t.needsEyes ? 0 : (t.candidate || t.hints.length || t.maybe.length) ? 1 : 2);
  }
  return rankCache.get(job);
}

if (globalThis.chrome && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || typeof msg.type !== 'string') return false;
  if (msg.type === 'sr:engine-check') {
    enqueue(msg.tabId, msg.pageKey, msg.listings, msg.settings);
    reply({ queued: queue.length });
    return false;
  }
  if (msg.type === 'sr:engine-forget') {
    livePage.delete(msg.tabId);
    return false;
  }
  if (msg.type === 'sr:engine-status') {
    deviceStatus().then(model => reply({ model, cloudAccess: hasCloudAccess, queued: queue.length, running }));
    return true;
  }
  return false;
});
