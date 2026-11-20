// Still Recalled on the web: one screenshot in, the extension's own check out.
//   1. read the screenshot   hybrid inference: Chrome's built-in model when this device has it, Gemini otherwise
//   2. words                 the extension's shortlist of every CPSC recall since 1973 and its risky-type rules, here
//   3. look and confirm      the extension's judge (hybrid) and its cloud double-check against the full notice
import { useCards, triageListing, checkListing, readLabel, refreshRecalls, setLiveCards } from '../../extension/src/engine.js';
import { hybridJson, hybridModel, imagePart, deviceStatus, hasCloudAccess } from '../../extension/src/ai.js';
import { SYSTEM, SCHEMA } from '../../shared/judge.mjs';
import { READ_SYSTEM, READ_SCHEMA, listingFromRead, listingFromText } from '../../shared/read.mjs';
import { productName, noMatchLine } from '../../shared/present.mjs';
import { detailView } from '../../extension/src/ui/detail.js';
import { h, safeUrl } from '../../extension/src/ui/dom.js';
import { icon, mark } from '../../extension/src/ui/icons.js';

useCards('data/cards.json');
// Phone visitors on Android get the app, which takes shared listings from any app.
if (/Android/i.test(navigator.userAgent)) document.getElementById('android-cta').hidden = false;
const $ = id => document.getElementById(id);
const INFANT = /\b(bab(y|ies)|infants?|newborns?|toddlers?|cribs?|bassinets?|cradles?|nursery|high\s*chairs?|strollers?|car\s*seats?|loungers?|bedside\s*sleepers?|play\s*yards?|pacifiers?|teethers?)\b/i;
let meta = { count: 10089, since: '1973-01-01', built: '' };
// Recalls CPSC published after this page's data was built: fetched from CPSC in the visitor's browser (the field-guide
// entry for each written by Gemini through Firebase AI Logic), kept for six hours.
let liveCards = [];
const noticeCount = () => meta.count + liveCards.length;
async function catchUp() {
  try {
    const saved = JSON.parse(localStorage.getItem('sr-live') || 'null');
    if (saved && Date.now() - saved.at < 6 * 3600e3 && saved.built === meta.built) { liveCards = saved.cards; setLiveCards(liveCards); return; }
  } catch { /* no storage: fetch again */ }
  try {
    liveCards = (await refreshRecalls({ cloud: true })).cards;
    try { localStorage.setItem('sr-live', JSON.stringify({ at: Date.now(), built: meta.built, cards: liveCards })); } catch { /* fine */ }
  } catch { /* CPSC unreachable: the built data stands */ }
}
let model = 'absent';
let judge = null;
let running = false;

const monthYear = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const longDate = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ---- Input ---------------------------------------------------------------------------------------------------------
function inputView() {
  const file = h('input', { type: 'file', accept: 'image/*', id: 'file', class: 'visually-hidden' });
  file.addEventListener('change', () => { if (file.files[0]) run({ file: file.files[0] }); file.value = ''; });

  const drop = h('label', { class: 'drop', for: 'file' },
    icon('image', { size: 24 }),
    h('span', { class: 'btn btn-primary drop-btn' }, 'Add a screenshot'),
    h('span', { class: 'drop-hint' }, 'or drop or paste an image here'),
  );
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, e => { e.preventDefault(); drop.dataset.over = ''; });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => delete drop.dataset.over);
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
    if (f) run({ file: f });
  });

  const text = h('input', { type: 'text', id: 'text', class: 'field', autocomplete: 'off', enterkeyhint: 'search',
    placeholder: 'Brand, product and model number' });
  const form = h('form', { class: 'type-form' },
    h('label', { for: 'text', class: 'field-label' }, 'Or type what it is'),
    h('div', { class: 'field-row' }, text, h('button', { class: 'btn btn-secondary', type: 'submit' }, 'Check')),
  );
  form.addEventListener('submit', e => { e.preventDefault(); if (text.value.trim()) run({ text: text.value }); });

  const example = h('button', { class: 'link', type: 'button' }, 'Try it with an example photo');
  example.addEventListener('click', runExample);

  return h('div', { class: 'input' }, file, drop, form, h('p', { class: 'example' }, example, h('span', { class: 'muted' }, ' (from a CPSC recall notice)')));
}

addEventListener('paste', e => {
  if (running) return;
  const item = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); run({ file: item.getAsFile() }); }
});

// The example is the photo from a CPSC recall notice (26591, VEVOR baby loungers, July 2026), kept with the page
// because cpsc.gov images can't be read from another site. It shows what a match looks like without a real listing.
async function runExample() {
  const blob = await fetch('example/recall-26591.jpg').then(r => (r.ok ? r.blob() : null), () => null);
  if (!blob) { showError('The example photo could not be loaded. Add your own screenshot instead.'); return; }
  run({ file: new File([blob], 'example.jpg', { type: 'image/jpeg' }), example: true });
}

// ---- The check -----------------------------------------------------------------------------------------------------
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

async function run({ file, text, example = null }) {
  if (running) return;
  running = true;
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
      const photo = await imagePart(imageUrl, 1024);
      const { answer, source } = await hybridJson({ system: READ_SYSTEM, schema: READ_SCHEMA, parts: ['Read this image.', photo] });
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
    // A refused App Check token holds off further tries until the page reloads, so offer a reload, not a retry.
    if (/app ?check|attestation|40[13]|permission/i.test(String(e))) showError('The cloud check could not verify this browser, so this listing could not be checked. Reload the page and try again.', { reload: true });
    else showError('Something went wrong while checking. Try again in a moment.');
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
      h('p', { class: 'muted small' }, example ? 'Example photo' : 'You checked'),
      h('p', { class: 'strong clamp2' }, listing.title)),
  );
  let body;
  if (r.level === 'possible' || r.level === 'likely') {
    body = detailView(r, { compact: false, onLabel: readLabel });
  } else {
    body = h('div', { class: 'detail' },
      h('div', { class: 'verdict' },
        h('span', { class: 'pill is-none' }, 'No match found'),
        h('p', { class: 'verdict-line' }, r.why === 'part or toy' || /part or a toy/.test(r.why)
          ? 'This looks like a part or a toy version, not the product itself.'
          : noMatchLine(noticeCount().toLocaleString('en-US'), monthYear(meta.since)))),
      h('section', { class: 'check' },
        h('h3', {}, 'Before you buy'),
        h('p', {}, 'No match isn\'t the same as safe. A listing rarely shows the model number, and many recalls cover only some models. Ask the seller for a photo of the label, then search the model number on SaferProducts.gov.'),
        INFANT.test(listing.title) ? h('p', {}, 'For anything a baby sleeps in: a firm, flat surface with nothing else in it.') : null),
      h('div', { class: 'links' },
        h('a', { class: 'link', href: 'https://www.saferproducts.gov/', target: '_blank', rel: 'noopener' }, 'Search SaferProducts.gov', icon('external', { size: 14 })),
        h('a', { class: 'link', href: 'https://www.cpsc.gov/SafeSleep', target: '_blank', rel: 'noopener' }, 'CPSC safe sleep guidance', icon('external', { size: 14 }))),
    );
  }
  $('side').replaceChildren(h('div', { class: 'card result' }, head, body, h('div', { class: 'result-foot' }, again)));
}

function showError(message, { reload = false } = {}) {
  running = false;
  const again = h('button', { class: 'btn btn-secondary', type: 'button' }, reload ? 'Reload the page' : 'Try again');
  again.addEventListener('click', reload ? () => location.reload() : reset);
  $('side').replaceChildren(h('div', { class: 'card' }, h('div', { class: 'error' }, icon('alert', { size: 18 }), h('p', {}, message)), again));
}

function reset() {
  recentView().then(v => $('side').replaceChildren(v));
  $('text') && ($('text').value = '');
  $('title').scrollIntoView({ block: 'start' });
}

// ---- The side column before a check: real recent recalls of baby products ----------------------------------------
let recentCache = null;
async function recentView() {
  if (!recentCache) {
    const { cards: built } = await (await fetch('data/cards.json')).json();
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
    row('search', `It's compared with ${noticeCount().toLocaleString('en-US')} recall notices in this page. Nothing is sent for this step.`),
    row('cloud', 'Only a possible match goes to Gemini in the cloud, with the full recall notice and its photo, for a closer look.'),
  ];
}

function dataLine() {
  $('data-line').textContent = `Recall data: U.S. Consumer Product Safety Commission, ${noticeCount().toLocaleString('en-US')} notices since ${monthYear(meta.since)}${liveCards.length ? `, with ${liveCards.length} published since this page was built, checked with CPSC today` : meta.built ? `, updated ${longDate(meta.built.slice(0, 10))}` : ''}.`;
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

  if (!hasCloudAccess) $('lede').after(h('p', { class: 'notice' }, 'This copy of the page has no cloud access, so it can only check what it can read on this device.'));
}
start();
