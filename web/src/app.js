// Still Recalled on the web: one screenshot in, the extension's own check out.
//   1. read the screenshot   hybrid inference: Chrome's built-in model when this device has it, Gemini otherwise
//   2. words                 the extension's shortlist of every CPSC recall since 1973 and its risky-type rules, here
//   3. look and confirm      the extension's judge (hybrid) and its cloud double-check against the full notice
import { useCards, triageListing, checkListing, readLabel, refreshRecalls, setLiveCards } from '../../extension/src/engine.js';
import { hybridJson, cloudJson, hybridModel, imagePart, deviceStatus, hasCloudAccess } from '../../extension/src/ai.js';
import { SYSTEM, SCHEMA } from '../../shared/judge.mjs';
import { READ_SYSTEM, READ_SCHEMA, listingFromRead, listingFromText } from '../../shared/read.mjs';
import { productName, noMatchView } from '../../shared/present.mjs';
import { detailView } from '../../extension/src/ui/detail.js';
import { h, safeUrl } from '../../extension/src/ui/dom.js';
import { icon, mark } from '../../extension/src/ui/icons.js';

useCards('data/cards.json');
// Phone visitors on Android get the app, which takes shared listings from any app.
if (/Android/i.test(navigator.userAgent)) document.getElementById('android-cta').hidden = false;
const $ = id => document.getElementById(id);
const INFANT = /\b(bab(y|ies)|infants?|newborns?|toddlers?|cribs?|bassinets?|cradles?|nursery|high\s*chairs?|strollers?|car\s*seats?|loungers?|bedside\s*sleepers?|play\s*yards?|pacifiers?|teethers?)\b/i;
let meta = { count: 10089, since: '1973-01-01', built: '' };
// Recalls CPSC published after this page's data was built: fetched from CPSC in the visitor's browser and matched by
// their words, kept for six hours. The page does not ask Gemini to write their field-guide entries: that would be a
// dozen cloud calls on every first visit, before the visitor has checked anything. The extension and the Android app,
// which keep their entries for days, still have Gemini write them.
let liveCards = [];
// Recall notices, the CPSC safety warnings bundled with them, and the recalls published since the build.
const noticeCount = () => meta.count + (meta.warnings || 0) + liveCards.length;
async function catchUp() {
  try {
    const saved = JSON.parse(localStorage.getItem('sr-live') || 'null');
    if (saved && Date.now() - saved.at < 6 * 3600e3 && saved.built === meta.built) { liveCards = saved.cards; setLiveCards(liveCards); return; }
  } catch { /* no storage: fetch again */ }
  try {
    liveCards = (await refreshRecalls({ cloud: false })).cards;
    try { localStorage.setItem('sr-live', JSON.stringify({ at: Date.now(), built: meta.built, cards: liveCards })); } catch { /* fine */ }
  } catch { /* CPSC unreachable: the built data stands */ }
}
// Who is asking: someone about to buy a listing, or someone who owns the item (selling it, giving it away, or using
// a hand-me-down). The check is the same; the words that follow it are not.
let audience = 'buyer';
try { if (localStorage.getItem('sr-audience') === 'owner') audience = 'owner'; } catch { /* no storage */ }
const WHO = {
  buyer: { title: 'Check a secondhand listing before you buy', add: 'Add a screenshot', hint: 'or drop or paste an image here',
    lede: 'Add a screenshot of the listing. Still Recalled compares it with every U.S. recall notice and flags recalled baby gear and the infant sleep products linked to deaths.' },
  owner: { title: 'Check what you own before you sell it or pass it on', add: 'Add a photo of it', hint: 'the item, its label, or your draft listing',
    lede: 'Selling it, giving it away, or using a hand-me-down? Add a photo. Still Recalled compares it with U.S. recall notices and safety warnings, and says what to do with it.' },
};
let model = 'absent';
let judge = null;
let running = false;

const monthYear = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const longDate = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---- Input ---------------------------------------------------------------------------------------------------------
function inputView() {
  const file = h('input', { type: 'file', accept: 'image/*', id: 'file', class: 'visually-hidden' });
  file.addEventListener('change', () => { if (file.files[0]) take(file.files[0]); file.value = ''; });
  const take = f => (isPicture(f) ? run({ file: f }) : showError(NOT_A_PICTURE, { type: true }));

  const addLabel = h('span', { class: 'btn btn-primary drop-btn' }, WHO[audience].add);
  const addHint = h('span', { class: 'drop-hint' }, WHO[audience].hint);
  const drop = h('label', { class: 'drop', for: 'file' }, icon('image', { size: 24 }), addLabel, addHint);

  // Two choices, so a pair of buttons, not a menu. The words on the page follow the choice.
  const choose = who => {
    audience = who;
    try { localStorage.setItem('sr-audience', who); } catch { /* fine */ }
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.who === who));
    addLabel.textContent = WHO[who].add;
    addHint.textContent = WHO[who].hint;
    $('title').textContent = WHO[who].title;
    $('lede').textContent = WHO[who].lede;
  };
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Who is checking' },
    ...[['buyer', "I'm buying it"], ['owner', 'I own it']].map(([who, label]) => {
      const b = h('button', { class: 'seg-btn', type: 'button', 'data-who': who, 'aria-pressed': String(who === audience) }, label);
      b.addEventListener('click', () => choose(who));
      return b;
    }));
  $('title').textContent = WHO[audience].title;
  $('lede').textContent = WHO[audience].lede;
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, e => { e.preventDefault(); drop.dataset.over = ''; });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => delete drop.dataset.over);
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const f = [...e.dataTransfer.files][0];
    if (f) take(f);
  });

  const text = h('input', { type: 'text', id: 'text', class: 'field', autocomplete: 'off', enterkeyhint: 'search',
    placeholder: 'Brand, product and model number' });
  const form = h('form', { class: 'type-form' },
    h('label', { for: 'text', class: 'field-label' }, 'Or type what it is'),
    h('div', { class: 'field-row' }, text, h('button', { class: 'btn btn-secondary', type: 'submit' }, 'Check')),
  );
  form.addEventListener('submit', e => { e.preventDefault(); if (text.value.trim()) run({ text: text.value }); });

  // What a match looks like, one press away: the product's signature should not hide in a small link.
  const example = h('button', { class: 'btn btn-secondary', type: 'button' }, 'See an example match');
  example.addEventListener('click', runExample);

  return h('div', { class: 'input' }, seg, file, drop, form,
    h('div', { class: 'example' }, example, h('span', { class: 'muted' }, 'A made-up listing with the photo from a real CPSC recall notice.')));
}

addEventListener('paste', e => {
  if (running) return;
  const item = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); run({ file: item.getAsFile() }); }
});

// The example is a made-up listing (scripts/make-example.mjs) around the photo from CPSC recall notice 26591 (VEVOR
// baby loungers, July 2026, every unit recalled). It shows what a match looks like without a real listing.
async function runExample() {
  const blob = await fetch('example/listing-26591.jpg').then(r => (r.ok ? r.blob() : null), () => null);
  if (!blob) { showError('The example photo could not be loaded. Add your own screenshot instead.'); return; }
  run({ file: new File([blob], 'example.jpg', { type: 'image/jpeg' }), example: true });
}

// ---- The check -----------------------------------------------------------------------------------------------------
// Chrome opens PNG, JPEG, WebP, GIF, BMP and AVIF. An iPhone's HEIC photo, a PDF or a text file can't be read here.
const isPicture = f => /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.type || '') || (!f.type && /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name || ''));
const NOT_A_PICTURE = "That file isn't a picture this page can open. Add a PNG or JPG screenshot of the listing. On an iPhone, a screenshot works; a HEIC photo doesn't.";
// Read by screen readers once per change: the start of a check, its result, or what went wrong. The cards themselves
// are not live regions, so the long result is not read out in full each time it appears.
const say = text => { const s = $('status'); if (s) { s.textContent = ''; setTimeout(() => { s.textContent = text; }, 50); } };
const STEPS = [
  { key: 'read', label: 'Reading the screenshot' },
  { key: 'words', label: `Searching recall notices` },
  { key: 'look', label: 'Looking closer' },
];

function stepsView(imageUrl, title) {
  const list = h('ol', { class: 'steps' }, STEPS.map(s =>
    h('li', { class: 'step', 'data-step': s.key, 'data-state': 'waiting' },
      h('span', { class: 'step-mark' }),
      h('span', { class: 'step-text' }, h('span', { class: 'step-label' }, s.label), h('span', { class: 'step-detail' })),
    )));
  return h('div', { class: 'working' },
    imageUrl ? h('img', { class: 'shot', src: imageUrl, alt: 'Your screenshot' }) : h('p', { class: 'typed' }, `“${title}”`),
    list);
}

function setStep(key, state, detail = '') {
  const li = document.querySelector(`.step[data-step="${key}"]`);
  if (!li) return;
  li.dataset.state = state;
  li.querySelector('.step-mark').replaceChildren(state === 'done' ? icon('check', { size: 14 }) : state === 'skipped' ? icon('dash', { size: 14 }) : '');
  li.querySelector('.step-detail').textContent = detail;
}

const withArticle = name => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

let last = null;   // what was last checked, so "Try again" runs the same thing again
async function run({ file, text, example = null }) {
  if (running) return;
  running = true;
  last = { file, text, example };
  say('Checking. This takes a few seconds.');
  const imageUrl = file ? URL.createObjectURL(file) : '';
  const side = $('side');
  side.replaceChildren(h('div', { class: 'card' }, stepsView(imageUrl, text)));
  // On a phone the progress card sits below the form: bring its top into view so the steps can be watched. On a wide
  // screen it sits beside the form and nothing moves.
  if (side.getBoundingClientRect().top > innerHeight * 0.4) {
    side.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  try {
    let listing, readSource = '';
    if (file) {
      setStep('read', 'active', model === 'available' ? 'On this device' : 'In the cloud: this browser has no built-in model');
      const photo = await imagePart(imageUrl, 1024).catch(() => { throw Object.assign(new Error('not a picture'), { notPicture: true }); });
      const readParts = ['Read this image.', photo];
      // The built-in model can fail on a photo it can't take; Gemini in the cloud reads it instead, as on Android.
      const { answer, source } = await hybridJson({ system: READ_SYSTEM, schema: READ_SCHEMA, parts: readParts })
        .catch(async e => {
          if (/app ?check|attestation|40[13]|permission/i.test(String(e))) throw e;
          return { ...(await cloudJson({ system: READ_SYSTEM, schema: READ_SCHEMA, parts: readParts })), source: 'in_cloud' };
        });
      readSource = source;
      if (answer.found === 'nothing') { showError('No product in this image. Try a screenshot that shows the listing\'s title and photo, or type what it is.'); return; }
      listing = listingFromRead(answer, imageUrl);
      setStep('read', 'done', `${source === 'on_device' ? 'Read on this device' : 'Read in the cloud'}: “${listing.title}”`);
    } else {
      listing = listingFromText(text);
      setStep('read', 'skipped', 'Typed, nothing to read');
    }

    setStep('words', 'active', `${noticeCount().toLocaleString('en-US')} notices since ${monthYear(meta.since)}`);
    const t = await triageListing(listing);
    setStep('words', 'done', t.partOrToy ? 'Looks like a part or a toy version'
      : t.candidate ? `Possible match: ${productName(t.candidate.card.product)}`
      : t.hints.length ? `Wording points to ${withArticle((t.hints[0].label || 'risky sleep product').toLowerCase())}`
      : 'No recall names this brand and product');

    setStep('look', 'active', model === 'available' ? 'On this device, then in the cloud if anything matches' : 'In the cloud');
    const r = await checkListing(listing, { modelReady: true, cloud: true, secondOpinion: true, judge: judge ||= hybridModel({ system: SYSTEM, schema: SCHEMA }) });
    if (r.level === 'error') throw new Error(r.error);
    setStep('look', 'done', r.how.cloudModel ? 'Compared with the full recall notice' : r.how.device ? 'Looked at on this device' : r.how.judgedInCloud ? 'Looked at in the cloud' : 'Checked by its words');
    showResult(r, listing, { readSource, example });
  } catch (e) {
    console.error(e);
    // The step that was running stops where it failed, and stays on screen above the message.
    const at = document.querySelector('.step[data-state="active"]');
    if (at) setStep(at.dataset.step, 'skipped', 'Stopped here');
    const said = String(e);
    // A refused App Check token holds off further tries until the page reloads, so offer a reload, not a retry.
    if (e.notPicture) showError(NOT_A_PICTURE, { type: true, keep: true });
    else if (/app ?check|attestation|40[13]|permission/i.test(said)) showError('The cloud check could not verify this browser, so this listing could not be checked. Reload the page and try again.', { reload: true, keep: true });
    else if (!navigator.onLine || /Failed to fetch|NetworkError|network/i.test(said)) showError("You're offline, so the cloud couldn't be reached. Typing the brand and product still works: matching against every recall runs on this page.", { type: true, keep: true });
    else if (/\b(429|503)\b|quota|overloaded|RESOURCE_EXHAUSTED|timed? ?out|timeout|abort/i.test(said)) showError('The cloud is busy right now. Try again in a minute, or type the brand and product instead.', { retry: true, type: true, keep: true });
    else showError('Something went wrong while checking. Try again, or type the brand and product instead.', { retry: true, type: true, keep: true });
  } finally {
    running = false;
  }
}

function showResult(r, listing, { example }) {
  const again = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Check another');
  again.addEventListener('click', reset);
  const head = h('div', { class: 'result-head' },
    listing.image ? h('img', { class: 'thumb', src: listing.image, alt: '' }) : null,
    h('div', { class: 'result-title' },
      h('p', { class: 'muted small' }, example ? 'Example photo' : audience === 'owner' ? 'Your item' : 'You checked'),
      h('p', { class: 'strong clamp2' }, listing.title)),
  );
  let body;
  if (r.level === 'possible' || r.level === 'likely') {
    body = detailView(r, { compact: false, onLabel: readLabel, audience });
  } else {
    // Shared with the Android app (shared/present.mjs noMatchView), so the two say the same thing.
    const v = noMatchView(r, listing, { input: listing.image ? 'listing' : 'typed', audience, count: noticeCount(), since: meta.since });
    body = h('div', { class: 'detail' },
      h('div', { class: 'verdict' },
        h('span', { class: 'pill is-none' }, v.pill),
        h('p', { class: 'verdict-line' }, v.line)),
      h('section', { class: 'check' }, h('h2', {}, v.heading), ...v.lines.map(l => h('p', {}, l))),
      v.vague ? null : h('div', { class: 'links' },
        h('a', { class: 'link', href: 'https://www.saferproducts.gov/', target: '_blank', rel: 'noopener' }, 'Search SaferProducts.gov', icon('external', { size: 14 })),
        v.safeSleep ? h('a', { class: 'link', href: 'https://www.cpsc.gov/SafeSleep', target: '_blank', rel: 'noopener' }, 'CPSC safe sleep guidance', icon('external', { size: 14 })) : null),
    );
  }
  $('side').replaceChildren(h('div', { class: 'card result' }, head, body, h('div', { class: 'result-foot' }, again)));
  say(r.level === 'likely' || r.level === 'possible' ? `Result: ${r.badge}. ${r.verdict || ''}` : `Result: ${noMatchView(r, listing, { input: listing.image ? 'listing' : 'typed' }).vague ? "we couldn't tell what the product is" : 'no match found'}. Details below.`);
}

/**
 * What went wrong, and what to do next. `retry` runs the same check again; `type` moves to the typing field, which
 * works offline; `keep` leaves the steps on screen, with the one that failed marked, above the message.
 */
function showError(message, { reload = false, retry = false, type = false, keep = false } = {}) {
  running = false;
  const actions = [];
  if (reload) actions.push(button('Reload the page', () => location.reload(), true));
  if (retry && last) actions.push(button('Try again', () => run(last), true));
  if (type) actions.push(button('Type it instead', () => { reset(); setTimeout(() => $('text') && $('text').focus(), 0); }, !reload && !retry));
  if (!actions.length) actions.push(button('Start over', reset, true));
  const box = h('div', { class: 'error-box' }, h('div', { class: 'error' }, icon('alert', { size: 18 }), h('p', {}, message)), h('div', { class: 'error-actions' }, ...actions));
  const working = keep ? $('side').querySelector('.working') : null;
  $('side').replaceChildren(h('div', { class: 'card' }, ...(working ? [working] : []), box));
  say(message);
}
function button(label, onClick, primary) {
  const b = h('button', { class: `btn ${primary ? 'btn-primary' : 'btn-secondary'}`, type: 'button' }, label);
  b.addEventListener('click', onClick);
  return b;
}

function reset() {
  recentView().then(v => $('side').replaceChildren(v));
  $('text') && ($('text').value = '');
  $('title').scrollIntoView({ block: 'start' });
}

// ---- The side column before a check: what a match looks like, then real recent recalls of baby products ----------
// The sample is a result the Chrome extension really produced on the practice page (tools/e2e.mjs records it in
// try/recorded.json), shown as it was, with its date: no model call, nothing invented.
let sampleCache;
async function sampleView() {
  if (sampleCache === undefined) {
    const rec = await fetch('try/recorded.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null), () => null);
    const rs = (rec && Array.isArray(rec.results)) ? rec.results : [];
    const r = rs.find(x => x.level === 'likely' && x.kind === 'recall' && x.recall && x.recall.all) || rs.find(x => x.level === 'likely');
    sampleCache = r ? { r, at: rec.at, version: rec.version } : null;
  }
  if (!sampleCache) return null;
  const { r, at } = sampleCache;
  const img = safeUrl(r.listing.image);
  return h('figure', { class: 'sample' },
    h('p', { class: 'sample-label' }, 'What a match looks like'),
    h('div', { class: 'sample-card' },
      h('div', { class: 'result-head' },
        img ? h('img', { class: 'thumb', src: img, alt: '', loading: 'lazy' }) : null,
        h('div', { class: 'result-title' }, h('p', { class: 'muted small' }, 'A practice listing'), h('p', { class: 'strong clamp2' }, r.listing.title))),
      h('span', { class: `pill is-${r.level}` }, r.badge),
      h('p', { class: 'verdict-line' }, r.verdict),
      r.action ? h('p', { class: 'sample-action' }, r.action) : null),
    h('figcaption', { class: 'muted small' },
      `Recorded from the Chrome extension on the `, h('a', { class: 'link', href: 'try/' }, 'practice page'),
      `, ${new Date(at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Every result links to the CPSC notice it came from.`));
}

let recentCache = null;
async function recentView() {
  const sample = await sampleView();
  const recent = await recentList();
  return sample ? h('div', { class: 'idle' }, sample, recent) : recent;
}

async function recentList() {
  if (!recentCache) {
    const res = await fetch('data/cards.json').catch(() => null);
    if (!res || !res.ok) {
      return h('div', { class: 'recent' }, h('h2', {}, 'Recently recalled baby products'),
        h('p', { class: 'muted' }, "The recall list couldn't be loaded, so this page may be offline. Reload to try again."));
    }
    const { cards: built } = await res.json();
    const cards = [...liveCards, ...built];
    recentCache = cards.filter(c => INFANT.test(`${c.product} ${c.title}`) && safeUrl(c.image)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }
  return h('div', { class: 'recent' },
    h('h2', {}, 'Recently recalled baby products'),
    h('ul', { class: 'rows' }, recentCache.map(c => h('li', {},
      h('a', { class: 'row', href: safeUrl(c.url), target: '_blank', rel: 'noopener' },
        h('img', { class: 'thumb', src: c.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        h('span', { class: 'row-text' },
          h('span', { class: 'row-title' }, productName(c.product)),
          h('span', { class: 'row-line2' }, `Recalled ${longDate(c.date)}`)))))),
    h('p', { class: 'muted small' }, 'From the U.S. Consumer Product Safety Commission. Selling a recalled product is against federal law, yet many stay in homes and get resold.'),
  );
}

// ---- Start ---------------------------------------------------------------------------------------------------------
function howList() {
  const row = (ic, text) => h('li', {}, icon(ic, { size: 16 }), h('span', {}, text));
  return [
    row('device', model === 'available'
      ? 'Your screenshot is read on this device by Chrome\'s built-in model.'
      : 'Your screenshot is read on your device when the browser has a built-in model (Chrome on a computer). On this browser, it\'s read by Gemini in the cloud.'),
    row('search', `It's compared with ${noticeCount().toLocaleString('en-US')} CPSC recall notices and safety warnings, on this page. Nothing is sent for this step.`),
    row('cloud', 'A baby product, or a possible match, then goes to Gemini in the cloud for a closer look, with the full recall notice and its photo. Anything else stays here.'),
  ];
}

function dataLine() {
  $('data-line').textContent = `Recall data: U.S. Consumer Product Safety Commission, ${(meta.count + liveCards.length).toLocaleString('en-US')} recall notices since ${monthYear(meta.since)}${meta.warnings ? ` and ${meta.warnings} safety warnings` : ''}${liveCards.length ? `, with ${liveCards.length} published since this page was built, checked with CPSC today` : meta.built ? `, updated ${longDate(meta.built.slice(0, 10))}` : ''}.`;
}

async function start() {
  $('mark').replaceWith(mark(20));
  $('input').replaceChildren(inputView());
  recentView().then(v => { if (!running && !$('side').firstChild) $('side').replaceChildren(v); });
  $('how').replaceChildren(...howList());
  meta = await fetch('data/meta.json').then(r => r.json()).catch(() => meta);
  // Some browsers take a while to answer, or never do; the page doesn't wait on it.
  model = await Promise.race([deviceStatus(), new Promise(r => setTimeout(() => r('unknown'), 2500))]);
  $('how').replaceChildren(...howList());
  dataLine();
  await catchUp();
  if (liveCards.length) {
    recentCache = null;
    recentView().then(v => { if (!running && $('side').querySelector('.recent')) $('side').replaceChildren(v); });
    $('how').replaceChildren(...howList());
    dataLine();
  }

  if (!hasCloudAccess) $('lede').after(h('p', { class: 'notice' }, model === 'available'
    ? 'This copy of the page has no cloud access, so it checks only on this device.'
    : 'This copy of the page has no cloud access, and this browser has no built-in model, so screenshots can\'t be read here. Type the brand and product instead.'));
}
start();
