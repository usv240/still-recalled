// Still Recalled on the web: one screenshot in, the extension's own check out.
//   1. read the screenshot   hybrid inference: Chrome's built-in model when this device has it, Gemini otherwise
//   2. words                 the extension's shortlist of every CPSC recall since 1973 and its risky-type rules, here
//   3. look and confirm      the extension's judge (hybrid) and its cloud double-check against the full notice
// 0.16.0, from five AI persona walkthroughs: every check is saved on this device (web/src/log.js), so a result can be
// opened again when the seller's label photo arrives, and a shop keeps an intake log (several photos at once, a batch
// name, CSV and print); and the page reads in English or Spanish (shared/i18n.mjs).
import { useCards, triageListing, checkListing, readLabel, refreshRecalls, setLiveCards } from '../../extension/src/engine.js';
import { hybridJson, cloudJson, hybridModel, imagePart, deviceStatus, hasCloudAccess } from '../../extension/src/ai.js';
import { SYSTEM, SCHEMA } from '../../shared/judge.mjs';
import { READ_SYSTEM, READ_SCHEMA, listingFromRead, listingFromText } from '../../shared/read.mjs';
import { productName, noMatchView, ownerView } from '../../shared/present.mjs';
import { setLang, getLang, tr, monthYearOf, shortDateOf } from '../../shared/i18n.mjs';
import { detailView } from '../../extension/src/ui/detail.js';
import { h, safeUrl } from '../../extension/src/ui/dom.js';
import { icon, mark } from '../../extension/src/ui/icons.js';
import { allChecks, saveCheck, updateCheck, clearChecks, thumbOf, batch, toCsv } from './log.js';

// The language: ?lang=es (the Spanish card's QR code), then the visitor's last choice, then the browser's.
{
  const asked = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem('sr-lang'); } catch { /* no storage */ }
  if (asked === 'es' || asked === 'en') { setLang(asked); try { localStorage.setItem('sr-lang', asked); } catch { /* fine */ } }
  else if (saved) setLang(saved);
  document.documentElement.lang = getLang();
}
const es = () => getLang() === 'es';

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
const num = n => n.toLocaleString('en-US');
async function catchUp() {
  try {
    const saved = JSON.parse(localStorage.getItem('sr-live') || 'null');
    if (saved && Date.now() - saved.at < 6 * 3600e3 && saved.built === meta.built) { liveCards = saved.cards; setLiveCards(liveCards); return; }
  } catch { /* no storage: fetch again */ }
  try {
    // The page writes no field-guide entries (cloud: false), but reads the ones other devices shared.
    liveCards = (await refreshRecalls({ cloud: false, shared: true })).cards;
    try { localStorage.setItem('sr-live', JSON.stringify({ at: Date.now(), built: meta.built, cards: liveCards })); } catch { /* fine */ }
  } catch { /* CPSC unreachable: the built data stands */ }
}
// Who is asking: someone about to buy a listing, or someone who owns the item (selling it, giving it away, or using
// a hand-me-down). The check is the same; the words that follow it are not.
let audience = 'buyer';
try { if (localStorage.getItem('sr-audience') === 'owner') audience = 'owner'; } catch { /* no storage */ }
const WHO = {
  buyer: { title: tr('Check a secondhand listing before you buy', 'Revise un anuncio de segunda mano antes de comprar'), add: tr('Add a screenshot', 'Agregar captura de pantalla'),
    hint: tr('or drop or paste an image here', 'o suelte o pegue una imagen aquí'),
    lede: tr('Add a screenshot of the listing. Still Recalled compares it with every CPSC recall notice and flags recalled baby gear and the infant sleep products linked to deaths.',
      'Agregue una captura de pantalla del anuncio. Still Recalled la compara con cada aviso de retiro de la CPSC y marca los artículos para bebé retirados del mercado y los productos para dormir relacionados con muertes de bebés.') },
  owner: { title: tr('Check what you own before you sell it or pass it on', 'Revise lo que tiene antes de venderlo o regalarlo'), add: tr('Add a photo of it', 'Agregar una foto'),
    hint: tr('the item, its label, or your draft listing. Several photos at once work too.', 'el artículo, su etiqueta o su anuncio. También puede agregar varias fotos a la vez.'),
    lede: tr('Selling it, giving it away, or using a hand-me-down? Add a photo. Still Recalled compares it with U.S. recall notices and safety warnings, and says what to do with it.',
      '¿Lo va a vender, regalar o usar de segunda mano? Agregue una foto. Still Recalled la compara con los avisos de retiro y las advertencias de EE. UU., y le dice qué hacer.') },
};
let model = 'absent';
let judge = null;
let running = false;

const monthYear = d => monthYearOf(d);
const longDate = d => shortDateOf(d);

// ---- Input ---------------------------------------------------------------------------------------------------------
function inputView() {
  const file = h('input', { type: 'file', accept: 'image/*', id: 'file', class: 'visually-hidden', multiple: '' });
  file.addEventListener('change', () => { takeAll([...file.files]); file.value = ''; });
  const takeAll = files => {
    const pics = files.filter(isPicture);
    if (!pics.length) { if (files.length) showError(NOT_A_PICTURE, { type: true }); return; }
    if (pics.length === 1) run({ file: pics[0] });
    else runBatch(pics);
  };

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
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': tr('Who is checking', 'Quién revisa') },
    ...[['buyer', tr("I'm buying it", 'Lo voy a comprar')], ['owner', tr('I own it', 'Es mío')]].map(([who, label]) => {
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
    takeAll([...e.dataTransfer.files]);
  });

  const text = h('input', { type: 'text', id: 'text', class: 'field', autocomplete: 'off', enterkeyhint: 'search',
    placeholder: tr("Like: Boppy lounger, or Graco Pack 'n Play", "Por ejemplo: Boppy lounger, o Graco Pack 'n Play") });
  const form = h('form', { class: 'type-form' },
    h('label', { for: 'text', class: 'field-label' }, tr('Or type what it is', 'O escriba qué es')),
    h('div', { class: 'field-row' }, text, h('button', { class: 'btn btn-secondary', type: 'submit' }, tr('Check', 'Revisar'))),
  );
  form.addEventListener('submit', e => { e.preventDefault(); if (text.value.trim()) run({ text: text.value }); });

  // What a match looks like, one press away: the product's signature should not hide in a small link.
  const example = h('button', { class: 'btn btn-secondary', type: 'button' }, tr('See an example match', 'Ver un ejemplo de coincidencia'));
  example.addEventListener('click', runExample);

  return h('div', { class: 'input' }, seg, file, drop, form,
    h('div', { class: 'example' }, example, h('span', { class: 'muted' }, tr('A made-up listing with the photo from a real CPSC recall notice.', 'Un anuncio inventado con la foto de un aviso de retiro real de la CPSC.'))));
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
  if (!blob) { showError(tr('The example photo could not be loaded. Add your own screenshot instead.', 'No se pudo cargar la foto de ejemplo. Agregue su propia captura de pantalla.')); return; }
  run({ file: new File([blob], 'example.jpg', { type: 'image/jpeg' }), example: true });
}

// ---- The check -----------------------------------------------------------------------------------------------------
// Chrome opens PNG, JPEG, WebP, GIF, BMP and AVIF. An iPhone's HEIC photo, a PDF or a text file can't be read here.
const isPicture = f => /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.type || '') || (!f.type && /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name || ''));
const NOT_A_PICTURE = tr("That file isn't a picture this page can open. Add a PNG or JPG screenshot of the listing. On an iPhone, a screenshot works; a HEIC photo doesn't.",
  'Ese archivo no es una imagen que esta página pueda abrir. Agregue una captura de pantalla PNG o JPG del anuncio. En un iPhone, una captura de pantalla funciona; una foto HEIC no.');
// Read by screen readers once per change: the start of a check, its result, or what went wrong. The cards themselves
// are not live regions, so the long result is not read out in full each time it appears.
const say = text => { const s = $('status'); if (s) { s.textContent = ''; setTimeout(() => { s.textContent = text; }, 50); } };
const STEPS = [
  { key: 'read', label: tr('Reading the screenshot', 'Leyendo la imagen') },
  { key: 'words', label: tr('Searching recall notices', 'Buscando en los avisos de retiro') },
  { key: 'look', label: tr('Looking closer', 'Revisando más de cerca') },
];

let inBatch = null;   // { i, n } while several photos are checked one after another
function stepsView(imageUrl, title) {
  const list = h('ol', { class: 'steps' }, STEPS.map(s =>
    h('li', { class: 'step', 'data-step': s.key, 'data-state': 'waiting' },
      h('span', { class: 'step-mark' }),
      h('span', { class: 'step-text' }, h('span', { class: 'step-label' }, s.label), h('span', { class: 'step-detail' })),
    )));
  return h('div', { class: 'working' },
    inBatch ? h('p', { class: 'muted small' }, tr(`Item ${inBatch.i} of ${inBatch.n}`, `Artículo ${inBatch.i} de ${inBatch.n}`)) : null,
    imageUrl ? h('img', { class: 'shot', src: imageUrl, alt: tr('Your screenshot', 'Su imagen') }) : h('p', { class: 'typed' }, `“${title}”`),
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
  say(tr('Checking. This takes a few seconds.', 'Revisando. Tarda unos segundos.'));
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
      setStep('read', 'active', model === 'available' ? tr('On this device', 'En este dispositivo') : tr('In the cloud', 'En la nube'));
      const photo = await imagePart(imageUrl, 1024).catch(() => { throw Object.assign(new Error('not a picture'), { notPicture: true }); });
      const readParts = ['Read this image.', photo];
      // The built-in model can fail on a photo it can't take; Gemini in the cloud reads it instead, as on Android.
      const { answer, source } = await hybridJson({ system: READ_SYSTEM, schema: READ_SCHEMA, parts: readParts })
        .catch(async e => {
          if (/app ?check|attestation|40[13]|permission/i.test(String(e))) throw e;
          return { ...(await cloudJson({ system: READ_SYSTEM, schema: READ_SCHEMA, parts: readParts })), source: 'in_cloud' };
        });
      readSource = source;
      if (answer.found === 'nothing') { showError(tr('No product in this image. Try a screenshot that shows the listing\'s title and photo, or type what it is.', 'No hay un producto en esta imagen. Pruebe con una captura que muestre el título y la foto del anuncio, o escriba qué es.')); return; }
      listing = listingFromRead(answer, imageUrl);
      setStep('read', 'done', `${source === 'on_device' ? tr('Read on this device', 'Leída en este dispositivo') : tr('Read in the cloud', 'Leída en la nube')}: “${listing.title}”`);
    } else {
      listing = listingFromText(text);
      setStep('read', 'skipped', tr('Typed, nothing to read', 'Escrito, nada que leer'));
    }

    setStep('words', 'active', tr(`${num(noticeCount())} notices since ${monthYear(meta.since)}`, `${num(noticeCount())} avisos desde ${monthYear(meta.since)}`));
    const t = await triageListing(listing);
    setStep('words', 'done', t.partOrToy ? tr('Looks like a part or a toy version', 'Parece una pieza o una versión de juguete')
      : t.candidate ? tr(`Possible match: ${productName(t.candidate.card.product)}`, `Posible coincidencia: ${productName(t.candidate.card.product)}`)
      : t.hints.length ? tr(`Wording points to ${withArticle((t.hints[0].label || 'risky sleep product').toLowerCase())}`, 'Las palabras apuntan a un producto de riesgo para dormir')
      : tr('No recall names this brand and product', 'Ningún retiro nombra esta marca y producto'));

    setStep('look', 'active', model === 'available' ? tr('On this device, then in the cloud if anything matches', 'En este dispositivo, y luego en la nube si algo coincide') : tr('In the cloud', 'En la nube'));
    const r = await checkListing(listing, { modelReady: true, cloud: true, secondOpinion: true, judge: judge ||= hybridModel({ system: SYSTEM, schema: SCHEMA }) });
    if (r.level === 'error') throw new Error(r.error);
    setStep('look', 'done', r.how.cloudModel ? tr('Compared with the full recall notice', 'Comparado con el aviso de retiro completo') : r.how.device ? tr('Looked at on this device', 'Revisado en este dispositivo') : r.how.judgedInCloud ? tr('Looked at in the cloud', 'Revisado en la nube') : tr('Checked by its words', 'Revisado por sus palabras'));
    // Saved on this device first, so the label check on the result is recorded with it.
    const id = example ? '' : await saveCheck(await entryFor(r, listing, imageUrl));
    showResult(r, listing, { readSource, example, id });
  } catch (e) {
    console.error(e);
    // The step that was running stops where it failed, and stays on screen above the message.
    const at = document.querySelector('.step[data-state="active"]');
    if (at) setStep(at.dataset.step, 'skipped', tr('Stopped here', 'Se detuvo aquí'));
    const said = String(e);
    // A refused App Check token holds off further tries until the page reloads, so offer a reload, not a retry.
    if (e.notPicture) showError(NOT_A_PICTURE, { type: true, keep: true });
    else if (/app ?check|attestation|40[13]|permission/i.test(said)) showError(tr('The cloud check could not verify this browser, so this listing could not be checked. Reload the page and try again, or type the brand and product: that part runs on this page.', 'La revisión en la nube no pudo verificar este navegador, así que no se pudo revisar este anuncio. Vuelva a cargar la página e inténtelo otra vez, o escriba la marca y el producto: esa parte funciona en esta página.'), { reload: true, type: true, keep: true });
    else if (!navigator.onLine || /Failed to fetch|NetworkError|network/i.test(said)) showError(tr("You're offline, so the cloud couldn't be reached. Typing the brand and product still works: matching against every recall runs on this page.", 'No tiene conexión, así que no se pudo llegar a la nube. Escribir la marca y el producto sigue funcionando: la comparación con cada retiro se hace en esta página.'), { type: true, keep: true });
    else if (/\b(429|503)\b|quota|overloaded|RESOURCE_EXHAUSTED|timed? ?out|timeout|abort/i.test(said)) showError(tr('The cloud is busy right now. Try again in a minute, or type the brand and product instead.', 'La nube está ocupada ahora. Inténtelo en un minuto, o escriba la marca y el producto.'), { retry: true, type: true, keep: true });
    else showError(tr('Something went wrong while checking. Try again, or type the brand and product instead.', 'Algo salió mal al revisar. Inténtelo otra vez, o escriba la marca y el producto.'), { retry: true, type: true, keep: true });
  } finally {
    running = false;
  }
}

/** Several photos in a row (a shop's intake): each is checked and saved, then the log shows them all. */
async function runBatch(files) {
  for (let i = 0; i < files.length; i++) {
    inBatch = { i: i + 1, n: files.length };
    await run({ file: files[i] });
  }
  inBatch = null;
  showLog(tr(`Checked ${files.length} items. Each one is below, newest first.`, `Se revisaron ${files.length} artículos. Cada uno está abajo, del más reciente al más antiguo.`));
}

/** What the log keeps for one check: enough to show the result again, and the row of a shop's record. */
async function entryFor(r, listing, imageUrl) {
  const thumb = await thumbOf(imageUrl);
  const flagged = r.level === 'likely' || r.level === 'possible';
  const typed = !listing.image;
  const nm = flagged ? null : noMatchView(r, listing, { input: typed ? 'typed' : 'listing', audience, count: noticeCount(), since: meta.since });
  const what = flagged ? (audience === 'owner' ? ownerView(r).action : r.action) : nm.line;
  return {
    audience, batch: batch.get(), lang: getLang(), typed,
    title: listing.title, thumb,
    r: JSON.parse(JSON.stringify({ ...r, listing: { ...(r.listing || {}), image: thumb } })),
    resultText: flagged ? r.badge : nm.pill,
    recall: r.recall ? `${r.recall.warning ? tr('warning', 'advertencia') : tr('recall', 'retiro')} ${r.recall.number || r.recall.id}` : r.banned ? r.banned.name : '',
    noticeUrl: (r.recall && r.recall.url) || '',
    action: what || '',
    label: '',
    data: `${num(noticeCount())} CPSC notices, ${meta.built ? meta.built.slice(0, 10) : ''}${liveCards.length ? ` + ${liveCards.length} since` : ''}`,
  };
}

function showResult(r, listing, { example, id = '', reopened = null }) {
  const again = h('button', { class: 'btn btn-secondary', type: 'button' }, tr('Check another', 'Revisar otro'));
  again.addEventListener('click', reset);
  const head = h('div', { class: 'result-head' },
    listing.image ? h('img', { class: 'thumb', src: listing.image, alt: '' }) : null,
    h('div', { class: 'result-title' },
      h('p', { class: 'muted small' }, reopened ? tr(`Checked ${when(reopened.at)}`, `Revisado ${when(reopened.at)}`)
        : example ? tr('Example photo', 'Foto de ejemplo') : audience === 'owner' ? tr('Your item', 'Su artículo') : tr('You checked', 'Usted revisó')),
      h('p', { class: 'strong clamp2' }, listing.title)),
  );
  let body;
  if (r.level === 'possible' || r.level === 'likely') {
    body = detailView(r, { compact: false, onLabel: readLabel, audience: reopened ? reopened.audience : audience });
    // A label checked on this result goes into the log beside it.
    body.addEventListener('sr-label', e => updateCheck(id, { label: `${e.detail.title}${e.detail.read ? ` (${e.detail.read})` : ''}` }));
  } else {
    // Shared with the Android app (shared/present.mjs noMatchView), so the two say the same thing.
    const v = noMatchView(r, listing, { input: listing.image && !(reopened && reopened.typed) ? 'listing' : 'typed', audience: reopened ? reopened.audience : audience, count: noticeCount(), since: meta.since });
    body = h('div', { class: 'detail' },
      h('div', { class: 'verdict' },
        h('span', { class: 'pill is-none' }, v.pill),
        h('p', { class: 'verdict-line' }, v.line)),
      h('section', { class: 'check' }, h('h2', {}, v.heading), ...v.lines.map(l => h('p', {}, l))),
      v.vague ? null : h('div', { class: 'links' },
        h('a', { class: 'link', href: 'https://www.saferproducts.gov/', target: '_blank', rel: 'noopener' }, tr('Search SaferProducts.gov', 'Buscar en SaferProducts.gov'), icon('external', { size: 14 })),
        v.safeSleep ? h('a', { class: 'link', href: es() ? 'https://www.cpsc.gov/es/SafeSleep' : 'https://www.cpsc.gov/SafeSleep', target: '_blank', rel: 'noopener' }, tr('CPSC safe sleep guidance', 'Guía de sueño seguro de la CPSC'), icon('external', { size: 14 })) : null),
    );
  }
  const saved = id || reopened ? h('p', { class: 'muted small' }, tr('Saved on this device, in ', 'Guardado en este dispositivo, en '), linkButton(tr('your checks', 'sus revisiones'), () => showLog()),
    tr('. Come back when the seller sends the label photo.', '. Vuelva cuando el vendedor le mande la foto de la etiqueta.')) : null;
  $('side').replaceChildren(h('div', { class: 'card result' }, head, body, h('div', { class: 'result-foot' }, again, saved)));
  say(r.level === 'likely' || r.level === 'possible' ? `${tr('Result', 'Resultado')}: ${r.badge}. ${r.verdict || ''}` : `${tr('Result', 'Resultado')}: ${noMatchView(r, listing, { input: listing.image ? 'listing' : 'typed' }).vague ? tr("we couldn't tell what the product is", 'no pudimos saber qué producto es') : tr('no match found', 'sin coincidencias')}. ${tr('Details below.', 'Detalles abajo.')}`);
}

const when = iso => {
  const d = new Date(iso);
  const day = d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10) ? tr('today', 'hoy') : longDate(d.toISOString().slice(0, 10));
  return `${day}, ${d.toLocaleTimeString(es() ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit' })}`;
};
function linkButton(label, onClick) {
  const b = h('button', { class: 'link', type: 'button' }, label);
  b.addEventListener('click', onClick);
  return b;
}
function openCheck(c) {
  showResult(c.r, { title: c.title, image: c.thumb }, { id: c.id, reopened: c });
  $('side').scrollIntoView({ block: 'start' });
}
const pillClass = c => (c.r && (c.r.level === 'likely' || c.r.level === 'possible') ? `is-${c.r.level}` : 'is-none');
function checkRow(c) {
  const row = h('button', { class: 'row', type: 'button' },
    c.thumb ? h('img', { class: 'thumb', src: c.thumb, alt: '' }) : h('span', { class: 'thumb thumb-typed' }, icon('search', { size: 16 })),
    h('span', { class: 'row-text' },
      h('span', { class: 'row-title' }, c.title),
      h('span', { class: 'row-line2' }, h('span', { class: `pill pill-sm ${pillClass(c)}` }, c.resultText), ` ${when(c.at)}${c.label ? ` · ${tr('label checked', 'etiqueta revisada')}` : ''}`)));
  row.addEventListener('click', () => openCheck(c));
  return h('li', {}, row);
}

/** The newest checks, above the recent recalls: a result to reopen when the seller's label photo arrives. */
async function myChecksBlock() {
  const all = await allChecks();
  if (!all.length) return null;
  return h('div', { class: 'recent mychecks' },
    h('h2', {}, tr('Your checks', 'Sus revisiones')),
    h('p', { class: 'muted small' }, tr("Saved on this device only. Waiting on a seller's label photo? Open the check and add it.", 'Guardadas solo en este dispositivo. ¿Espera la foto de la etiqueta del vendedor? Abra la revisión y agréguela.')),
    h('ul', { class: 'rows' }, all.slice(0, 3).map(checkRow)),
    linkButton(tr(`All checks (${all.length}), with download and print`, `Todas las revisiones (${all.length}), para descargar e imprimir`), () => showLog()));
}

/** Every saved check: a shop's intake record, with a batch name, CSV download and print. */
async function showLog(note = '') {
  const all = await allChecks();
  const batchField = h('input', { type: 'text', class: 'field', id: 'batch', value: batch.get(), maxlength: '60', autocomplete: 'off',
    placeholder: tr('Like: Consignor 482, or Nov 25 intake', 'Por ejemplo: Consignador 482, o entrada del 25 nov') });
  batchField.addEventListener('input', () => batch.set(batchField.value));
  const csv = h('button', { class: 'btn btn-secondary', type: 'button' }, icon('download', { size: 16 }), tr('Download CSV', 'Descargar CSV'));
  csv.addEventListener('click', () => {
    const cols = es() ? ['Fecha', 'Hora', 'Lote', 'Quién', 'Artículo', 'Resultado', 'Retiro o tipo', 'Aviso', 'Qué hacer', 'Etiqueta', 'Lista de retiros']
      : ['Date', 'Time', 'Batch', 'Who', 'Item', 'Result', 'Recall or type', 'Notice', 'What to do', 'Label check', 'Recall list'];
    const blob = new Blob(['﻿', toCsv(all, cols)], { type: 'text/csv;charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `still-recalled-checks-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
  });
  const print = h('button', { class: 'btn btn-secondary', type: 'button' }, tr('Print', 'Imprimir'));
  print.addEventListener('click', () => { document.body.classList.add('printing-log'); window.print(); });
  addEventListener('afterprint', () => document.body.classList.remove('printing-log'), { once: true });
  let armed = false;
  const clear = h('button', { class: 'btn btn-secondary', type: 'button' }, tr('Clear all', 'Borrar todo'));
  clear.addEventListener('click', async () => {
    // Two presses, no dialog: the first says what will happen.
    if (!armed) { armed = true; clear.textContent = tr(`Press again to delete ${all.length} checks from this device`, `Presione otra vez para borrar ${all.length} revisiones de este dispositivo`); return; }
    await clearChecks(); reset();
  });
  const back = h('button', { class: 'btn btn-secondary', type: 'button' }, tr('Back', 'Volver'));
  back.addEventListener('click', reset);
  const table = all.length ? h('table', { class: 'log' },
    h('thead', {}, h('tr', {}, ...[tr('When', 'Cuándo'), tr('Item', 'Artículo'), tr('Result', 'Resultado'), tr('Recall or type', 'Retiro o tipo'), tr('Label', 'Etiqueta')].map(t => h('th', {}, t)))),
    h('tbody', {}, ...all.map(c => {
      const open = linkButton(c.title, () => openCheck(c));
      return h('tr', {},
        h('td', { class: 'num' }, when(c.at), c.batch ? h('div', { class: 'muted small' }, c.batch) : null),
        h('td', {}, open),
        h('td', {}, h('span', { class: `pill pill-sm ${pillClass(c)}` }, c.resultText)),
        h('td', {}, c.noticeUrl && safeUrl(c.noticeUrl) ? h('a', { class: 'link', href: safeUrl(c.noticeUrl), target: '_blank', rel: 'noopener' }, c.recall) : c.recall),
        h('td', {}, c.label || ''));
    })))
    : h('p', { class: 'muted' }, tr('No checks yet. Each check you make is saved here, on this device.', 'Todavía no hay revisiones. Cada revisión que haga se guarda aquí, en este dispositivo.'));
  $('side').replaceChildren(h('div', { class: 'card log-card' },
    h('h2', {}, tr('Your checks', 'Sus revisiones')),
    note ? h('p', {}, note) : null,
    h('p', { class: 'muted small' }, tr('Kept in this browser only, never sent anywhere. A shop can name each intake batch; new checks get the name.', 'Se guardan solo en este navegador y nunca se envían. Una tienda puede nombrar cada lote de entrada; las revisiones nuevas llevan ese nombre.')),
    h('label', { for: 'batch', class: 'field-label' }, tr('Batch or consignor (optional)', 'Lote o consignador (opcional)')), batchField,
    h('div', { class: 'log-actions' }, csv, print, back, clear),
    table,
    h('p', { class: 'muted small print-only' }, tr(`Printed ${new Date().toLocaleString('en-US')}. Checked with Still Recalled against U.S. CPSC recall notices; a check never says an item is safe.`, `Impreso ${new Date().toLocaleString('es-US')}. Revisado con Still Recalled contra los avisos de retiro de la CPSC de EE. UU.; una revisión nunca dice que un artículo sea seguro.`))));
  $('side').scrollIntoView({ block: 'start' });
}

/**
 * What went wrong, and what to do next. `retry` runs the same check again; `type` moves to the typing field, which
 * works offline; `keep` leaves the steps on screen, with the one that failed marked, above the message.
 */
function showError(message, { reload = false, retry = false, type = false, keep = false } = {}) {
  running = false;
  const actions = [];
  if (reload) actions.push(button(tr('Reload the page', 'Volver a cargar la página'), () => location.reload(), true));
  if (retry && last) actions.push(button(tr('Try again', 'Intentar otra vez'), () => run(last), true));
  if (type) actions.push(button(tr('Type it instead', 'Escribirlo'), () => { reset(); setTimeout(() => $('text') && $('text').focus(), 0); }, !reload && !retry));
  if (!actions.length) actions.push(button(tr('Start over', 'Empezar de nuevo'), reset, true));
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

// ---- The side column before a check: your checks, what a match looks like, then recent recalls of baby products ---
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
  // The recorded sample is in English; the Spanish page shows the recent recalls only.
  if (!sampleCache || es()) return null;
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
  const [mine, sample, recent] = await Promise.all([myChecksBlock(), sampleView(), recentList()]);
  const parts = [mine, sample, recent].filter(Boolean);
  return parts.length > 1 ? h('div', { class: 'idle' }, ...parts) : recent;
}

async function recentList() {
  if (!recentCache) {
    const res = await fetch('data/cards.json').catch(() => null);
    if (!res || !res.ok) {
      return h('div', { class: 'recent' }, h('h2', {}, tr('Recently recalled baby products', 'Productos para bebé retirados recientemente')),
        h('p', { class: 'muted' }, tr("The recall list couldn't be loaded, so this page may be offline. Reload to try again.", 'No se pudo cargar la lista de retiros; puede que esta página no tenga conexión. Vuelva a cargarla para intentarlo otra vez.')));
    }
    const { cards: built } = await res.json();
    const cards = [...liveCards, ...built];
    recentCache = cards.filter(c => INFANT.test(`${c.product} ${c.title}`) && safeUrl(c.image)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }
  return h('div', { class: 'recent' },
    h('h2', {}, tr('Recently recalled baby products', 'Productos para bebé retirados recientemente')),
    h('ul', { class: 'rows' }, recentCache.map(c => h('li', {},
      h('a', { class: 'row', href: safeUrl(c.url), target: '_blank', rel: 'noopener' },
        h('img', { class: 'thumb', src: c.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
        h('span', { class: 'row-text' },
          h('span', { class: 'row-title' }, productName(c.product)),
          h('span', { class: 'row-line2' }, tr(`Recalled ${longDate(c.date)}`, `Retirado el ${longDate(c.date)}`))))))),
    h('p', { class: 'muted small' }, tr('From the U.S. Consumer Product Safety Commission. Selling a recalled product is against federal law, yet many stay in homes and get resold.',
      'De la Comisión para la Seguridad de los Productos de Consumo de EE. UU. (CPSC). Vender un producto retirado del mercado es ilegal, pero muchos siguen en las casas y se vuelven a vender.')),
  );
}

// ---- Start ---------------------------------------------------------------------------------------------------------
function howList() {
  const row = (ic, text) => h('li', {}, icon(ic, { size: 16 }), h('span', {}, text));
  return [
    row('device', model === 'available'
      ? tr('Your screenshot is read on this device by Chrome\'s built-in model.', 'Su imagen se lee en este dispositivo con el modelo integrado de Chrome.')
      : tr('Your screenshot is read by Google\'s Gemini and not kept. No account.', 'Su imagen la lee Gemini, de Google, y no se guarda. Sin cuenta.')),
    row('search', tr(`It's compared with ${num(noticeCount())} CPSC recall notices and safety warnings, on this page. Nothing is sent for this step.`,
      `Se compara con ${num(noticeCount())} avisos de retiro y advertencias de la CPSC, en esta página. En este paso no se envía nada.`)),
    row('cloud', tr('A baby product, or a possible match, then goes to Gemini in the cloud for a closer look, with the full recall notice and its photo. Anything else stays here.',
      'Un producto para bebé, o una posible coincidencia, pasa luego a Gemini en la nube para una revisión más de cerca, con el aviso de retiro completo y su foto. Lo demás se queda aquí.')),
  ];
}

function dataLine() {
  const total = num(meta.count + liveCards.length);
  $('data-line').textContent = es()
    ? `Datos de retiros: Comisión para la Seguridad de los Productos de Consumo de EE. UU., ${total} avisos de retiro desde ${monthYear(meta.since)}${meta.warnings ? ` y ${meta.warnings} advertencias` : ''}${liveCards.length ? `, con ${liveCards.length} publicados desde que se creó esta página, revisados hoy con la CPSC` : meta.built ? `, actualizados el ${longDate(meta.built.slice(0, 10))}` : ''}.`
    : `Recall data: U.S. Consumer Product Safety Commission, ${total} recall notices since ${monthYear(meta.since)}${meta.warnings ? ` and ${meta.warnings} safety warnings` : ''}${liveCards.length ? `, with ${liveCards.length} published since this page was built, checked with CPSC today` : meta.built ? `, updated ${longDate(meta.built.slice(0, 10))}` : ''}.`;
}

/** The page's fixed text in the chosen language (data-es in index.html), and the switch to the other. */
function staticText() {
  for (const el of document.querySelectorAll('[data-es]')) {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    el.innerHTML = es() ? el.dataset.es : el.dataset.en;
  }
  const link = $('lang-link');
  if (link) { link.textContent = es() ? 'English' : 'Español'; link.href = es() ? '?lang=en' : '?lang=es'; link.lang = es() ? 'en' : 'es'; link.hreflang = link.lang; }
  const note = $('es-note');
  if (note) note.hidden = !es();
  $('how').setAttribute('aria-label', tr('How it checks', 'Cómo revisa'));
  $('side').setAttribute('aria-label', tr('Result', 'Resultado'));
}

async function start() {
  staticText();
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
    ? tr('This copy of the page has no cloud access, so it checks only on this device.', 'Esta copia de la página no tiene acceso a la nube, así que solo revisa en este dispositivo.')
    : tr('This copy of the page has no cloud access, and this browser has no built-in model, so screenshots can\'t be read here. Type the brand and product instead.', 'Esta copia de la página no tiene acceso a la nube y este navegador no tiene un modelo integrado, así que aquí no se pueden leer imágenes. Escriba la marca y el producto.')));
}
start();
