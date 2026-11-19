// A recall card is the short form of one government recall notice: enough to match a listing and to show a warning.
//
// Each card joins two sources:
//   the CPSC record   its number, date, product, hazard, remedy, link and photo, and model codes found by plain code;
//   a spotter card    written once, at build time, by Gemini reading the notice (scripts/build-spotter.mjs): the brand
//                     a seller would type, the product line, the kind of product, the years sold, and one sentence on
//                     how to tell a recalled unit from one that is not.
// Matching itself stays in plain code (shortlist.mjs). Where a notice has no spotter card, the older heuristics below
// fill in the brand and kind.
import { tokenize, uniqueTokens, modelCodes, clip } from './text.mjs';

const first = (list, key = 'Name') => (Array.isArray(list) && list[0] && list[0][key]) || '';

// Words that are part of a company's legal name or a shop's name, not the brand a seller would type.
const NOT_BRAND = new Set(
  ('inc llc ltd co corp corporation company group international intl usa us america american store shop shops ' +
   'trading technology technologies tech limited appliances products product industries industrial enterprises ' +
   'holdings global brands brand direct official home kids baby toys outdoor sports electronics electric ' +
   'amazon amazoncom walmart walmartcom target targetcom costco ebay temu shein wayfair tiktok etsy ' +
   'china hong kong shenzhen guangzhou thailand vietnam taiwan mexico canada india').split(' '));

// Company-form words, dropped from a brand name: "Graco Children's Products Inc." is "Graco" in a listing.
const COMPANY_FORM = new Set('inc llc ltd co corp corporation company limited group international intl products product industries enterprises holdings'.split(' '));

// Everyday listing words. A product line made only of these (and of the kind of product) is not distinctive: it
// counts only together with the brand. A Craigslist "Bedside Sleeper/Bassinet" once matched "Papablic Bedside
// Sleepers" as the same line (end-to-end test, 2026-11-15).
export const EVERYDAY = new Set(('bedside lovely mommy mommys daddy deluxe portable foldable folding convertible organic premium ' +
  'classic original vintage adjustable compact travel sensory montessori cozy comfy plush luxury modern wooden ' +
  'electric smart outdoor indoor kitchen bedroom rocking rocker cradle bundle combo hybrid ultra super mega ' +
  'baby infant newborn toddler kid children child girl boy mini max plus pro lite light standard basic series ' +
  'collection edition model style set kit pack large small medium big little black white blue pink gray grey red green').split(' '));

/** The firm named in a notice, as the words a listing would use. Heuristic, used when there is no spotter card. */
function brandTokens(r, productTokens) {
  const title = String(r.Title || '');
  const sources = [];
  const lead = title.match(/^(.+?)\s+(?:Re-?announces?|Recalls?|Expands?)\b/i);          // "Costway Recalls ..."
  if (lead) sources.push(lead[1]);
  // "...; Sold on Amazon by Belivium" and "... Recalled by Atekcity Due to Fire Hazards"
  const tail = title.match(/\bby\s+([^;,]+?)(?:\s+Due\s+to\b[^;]*)?\s*(?:;|$)/i);
  if (tail) sources.push(tail[1]);
  for (const key of ['Manufacturers', 'Importers', 'Distributors']) {
    const name = first(r[key]);
    if (name) sources.push(name.split(/,\s*of\s+/i)[0]);                                  // drop ", of City, State"
  }
  const product = new Set(productTokens);
  for (const s of sources) {
    const toks = tokenize(s).filter(t => !NOT_BRAND.has(t) && !/^\d+$/.test(t) && t.length >= 3);
    // A firm name that also appears in the product name is the brand buyers see ("Costway Convertible High Chairs").
    const inProduct = toks.filter(t => product.has(t));
    if (inProduct.length) return inProduct.slice(0, 3);
    if (toks.length && toks.length <= 3) return toks;
  }
  return [];
}

const phrase = text => uniqueTokens(text).filter(t => t.length >= 2);
const phrases = (list, max) => {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(list) ? list : []) {
    const p = phrase(x);
    const k = p.join(' ');
    if (p.length && p.length <= 5 && !seen.has(k)) { seen.add(k); out.push(p); }
    if (out.length >= max) break;
  }
  return out;
};
const year = y => (Number.isInteger(y) && y >= 1960 && y <= 2035 ? y : 0);

/**
 * Turn one record from the CPSC recall API into a card. `spot` is its spotter card, when there is one.
 * Returns null for records that cannot be matched or shown.
 */
export function cardFromCpsc(r, spot = null) {
  const id = String(r.RecallNumber || '').trim();
  const product = clip(first(r.Products), 120);
  const title = clip(r.Title, 160);
  if (!id || !(product || title) || !r.URL) return null;

  const captions = (r.Images || []).map(i => i.Caption || '').join(' ');
  const codes = [...new Set([
    ...((spot && spot.models) || []).map(m => String(m).toUpperCase().trim()).filter(m => /\d/.test(m) && m.length >= 3 && m.length <= 24),
    ...modelCodes(product), ...modelCodes(captions), ...modelCodes(r.Description),
  ])].filter(c => !/^(19|20)\d{2}$/.test(c)).slice(0, 14);       // years are not model numbers
  const productTokens = uniqueTokens(product || title);

  // Brand names, each as the words a listing must contain. A brand made only of shop or everyday words is dropped.
  // A brand that loses a word to the tokenizer ("L.L. Bean" keeps only "bean") would match other brands' listings
  // ("Nested Bean"), so it is dropped rather than shortened.
  const whole = b => String(b || '').replace(/['’]s\b/gi, 's').split(/[^A-Za-z0-9]+/).filter(Boolean).every(w => w.length >= 2);
  let brands = spot
    ? phrases((spot.brands || []).filter(whole), 3).map(b => b.filter(t => !COMPANY_FORM.has(t))).filter(b => b.length && !b.every(t => NOT_BRAND.has(t) || EVERYDAY.has(t) || t.length < 3))
    : [];
  if (!brands.length) { const b = brandTokens(r, productTokens).filter(t => !EVERYDAY.has(t)); if (b.length) brands = [b]; }

  const kinds = spot ? phrases([spot.kind, ...(spot.other_names || [])], 5) : [];
  const kindWords = new Set(kinds.flat());
  const brandWords = new Set(brands.flat());
  // A line that only repeats the brand or the kind of product is not a line.
  const lines = spot ? phrases(spot.lines, 4).map(l => l.filter(t => !brandWords.has(t))).filter(l => l.length && !l.every(t => kindWords.has(t))) : [];

  return {
    id,
    date: String(r.RecallDate || '').slice(0, 10),
    product: product || title,
    title,
    hazard: clip(first(r.Hazards), 200),
    remedy: clip(first(r.Remedies), 140),
    url: r.URL,
    image: first(r.Images, 'URL'),
    codes,
    brands,
    lines,           // sorted into `lines` (distinctive) and `linesWithBrand` in cardsFromCpsc
    linesWithBrand: [],
    kinds,
    // Without a spotter card: the product name's words stand in for the kind.
    productTokens: spot ? [] : productTokens,
    tell: spot ? clip(spot.tell, 220) : '',
    from: spot ? year(spot.sold_from) : 0,
    to: spot ? year(spot.sold_to) : 0,
    all: !!(spot && spot.all_units),
  };
}

/** Cards for every record, newest first. `spots`: Map of recall number -> spotter card. */
export function cardsFromCpsc(records, spots = new Map()) {
  const seen = new Set();
  const cards = [], described = [];
  for (const r of records) {
    const c = cardFromCpsc(r, spots.get(String(r.RecallNumber || '').trim()) || null);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    cards.push(c);
    described.push(new Set(uniqueTokens(`${r.Title} ${first(r.Products)} ${r.Description}`)));
  }
  // How many notices use each word. A line name is distinctive when few notices use it ("snuga", "mamaroo"), or few
  // use all its words together ("rock" + "play").
  const used = new Map();
  described.forEach((set, i) => { for (const t of set) { if (!used.has(t)) used.set(t, []); used.get(t).push(i); } });
  const count = t => (used.get(t) || []).length;
  const together = words => {
    const lists = words.map(t => used.get(t) || []).sort((a, b) => a.length - b.length);
    if (!lists.length || !lists[0].length) return 0;
    const rest = lists.slice(1).map(l => new Set(l));
    return lists[0].filter(i => rest.every(s => s.has(i))).length;
  };
  const scale = Math.max(1, cards.length / 2000);
  const FEW = Math.round(8 * scale), FEW_TOGETHER = Math.round(3 * scale);
  // Words that name a kind of product in several notices ("bedding", "nest", "pad"). A line made of those is a
  // description, not a name: "Crib Bedding Set" must not match every crib bedding set.
  const kindUse = new Map();
  // A brand's own name in its kinds ("Boppy pillow") doesn't count: the brand is not a kind of product.
  for (const c of cards) {
    const own = new Set(c.brands.flat());
    for (const t of new Set(c.kinds.flat())) if (!own.has(t)) kindUse.set(t, (kindUse.get(t) || 0) + 1);
  }
  const namesAKind = t => (kindUse.get(t) || 0) > 2;
  for (const c of cards) {
    // A one-word brand that is also a kind of product elsewhere ("Stand", "Toy", "Mattress") would match any listing
    // for that kind.
    // Kept when the recall's own product name carries it as a name, not as its kind: other notices call nursing
    // pillows "boppy pillows", but "Boppy Original Newborn Loungers" is the brand.
    const named = new Set(uniqueTokens(c.product));
    c.brands = c.brands.filter(b => b.length > 1 || !namesAKind(b[0]) || (named.has(b[0]) && !c.kinds.some(k => k.includes(b[0]))));
    const kindWords = new Set(c.kinds.flat());
    const own = c.lines.map(l => {
      const candidates = l.filter(t => !EVERYDAY.has(t) && !kindWords.has(t) && !namesAKind(t) && t.length >= 3 && !/^\d+$/.test(t));
      return candidates.some(t => count(t) <= FEW) || (l.length >= 2 && candidates.length > 0 && together(l) <= FEW_TOGETHER);
    });
    c.linesWithBrand = c.lines.filter((l, i) => !own[i]);
    c.lines = c.lines.filter((l, i) => own[i]);
    // Without a spotter card: a product-name word that almost no other notice uses is a line name.
    if (!c.kinds.length) {
      const brand = new Set(c.brands.flat());
      c.lines = c.productTokens.filter(t => !brand.has(t) && t.length >= 4 && !/^\d+$/.test(t) && !EVERYDAY.has(t) && count(t) <= Math.round(3 * scale)).map(t => [t]);
    }
  }
  const order = cards.map((c, i) => i).sort((a, b) => (cards[a].date < cards[b].date ? 1 : -1));
  return order.map(i => cards[i]);
}

/** The few lines of a card that go into a model prompt: the product, when it was sold, and how to tell a recalled unit. */
export function cardForPrompt(c) {
  const sold = c.from && c.to ? ` Sold ${c.from === c.to ? `in ${c.from}` : `${c.from} to ${c.to}`}.` : '';
  return `${c.product}.${sold} Hazard: ${clip(c.hazard, 90)}${c.tell ? `\nWhich units: ${c.tell}` : ''}`;
}

/**
 * Cards for notices CPSC published after the build, made on the shopper's computer (engine.js, refreshRecalls).
 * `baseCards` are the bundled cards. A handful of new notices is too few to tell a distinctive product line from an
 * everyday one (cardsFromCpsc counts how many of 10,000 notices use each word), so here every line counts only
 * together with the brand, and a one-word brand that names a kind of product in the bundled cards is dropped.
 * That misses a listing that names only the line, never matches a listing on an everyday word.
 */
export function liveCardsFromCpsc(records, spots = new Map(), baseCards = []) {
  const kindUse = new Map();
  for (const c of baseCards) {
    const own = new Set(c.brands.flat());
    for (const t of new Set(c.kinds.flat())) if (!own.has(t)) kindUse.set(t, (kindUse.get(t) || 0) + 1);
  }
  const namesAKind = t => (kindUse.get(t) || 0) > 2;
  const known = new Set(baseCards.map(c => c.id));
  const out = [];
  for (const r of records) {
    const id = String(r.RecallNumber || '').trim();
    if (known.has(id)) continue;
    const c = cardFromCpsc(r, spots.get(id) || null);
    if (!c) continue;
    known.add(id);
    const named = new Set(uniqueTokens(c.product));
    c.brands = c.brands.filter(b => b.length > 1 || !namesAKind(b[0]) || (named.has(b[0]) && !c.kinds.some(k => k.includes(b[0]))));
    c.linesWithBrand = c.lines;
    c.lines = [];
    c.live = true;
    out.push(c);
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
