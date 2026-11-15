// A recall card is the short form of one government recall notice: enough to match a listing and to show a warning.
import { tokenize, uniqueTokens, modelCodes, clip } from './text.mjs';

const first = (list, key = 'Name') => (Array.isArray(list) && list[0] && list[0][key]) || '';

// Words that are part of a company's legal name or a shop's name, not the brand a seller would type.
const NOT_BRAND = new Set(
  ('inc llc ltd co corp corporation company group international intl usa us america american store shop shops ' +
   'trading technology technologies tech limited appliances products product industries industrial enterprises ' +
   'holdings global brands brand direct official home kids baby toys outdoor sports electronics electric ' +
   'amazon amazoncom walmart walmartcom target targetcom costco ebay temu shein wayfair tiktok etsy ' +
   'china hong kong shenzhen guangzhou thailand vietnam taiwan mexico canada india').split(' '));

/** The firm named in a notice, as the words a listing would use. Heuristic; the cloud model will replace it. */
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

/** Turn one record from the CPSC recall API into a card. Returns null for records that cannot be matched or shown. */
export function cardFromCpsc(r) {
  const id = String(r.RecallNumber || '').trim();
  const product = clip(first(r.Products), 120);
  const title = clip(r.Title, 200);
  if (!id || !(product || title) || !r.URL) return null;

  const captions = (r.Images || []).map(i => i.Caption || '').join(' ');
  const codes = [...new Set([...modelCodes(product), ...modelCodes(captions), ...modelCodes(r.Description)])]
    .filter(c => !/^(19|20)\d{2}$/.test(c))       // years are not model numbers
    .slice(0, 12);
  const productTokens = uniqueTokens(product || title);

  return {
    id,
    date: String(r.RecallDate || '').slice(0, 10),
    product: product || title,
    title,
    hazard: clip(first(r.Hazards), 220),
    remedy: clip(first(r.Remedies), 160),
    url: r.URL,
    image: first(r.Images, 'URL'),
    codes,
    brand: brandTokens(r, productTokens),
    productTokens,
    // Words used for the first rough lookup: product name and title carry the brand; captions add model names.
    tokens: uniqueTokens(`${product} ${title} ${captions} ${codes.join(' ')}`),
  };
}

export function cardsFromCpsc(records) {
  const seen = new Set();
  const cards = [], described = [];
  for (const r of records) {
    const c = cardFromCpsc(r);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    cards.push(c);
    described.push(new Set(uniqueTokens(`${r.Title} ${r.Description}`)));
  }
  // A product-name word that almost no other notice uses is a model or line name ("snuga", "ypsi", "mamaroo").
  // Everyday words ("canopy", "mirror") appear across many notices and are left out.
  const used = new Map();
  for (const set of described) for (const t of set) used.set(t, (used.get(t) || 0) + 1);
  cards.forEach(c => {
    const brand = new Set(c.brand);
    c.line = c.productTokens.filter(t => !brand.has(t) && t.length >= 4 && !/^\d+$/.test(t) && (used.get(t) || 0) <= 3);
  });
  const order = cards.map((c, i) => i).sort((a, b) => (cards[a].date < cards[b].date ? 1 : -1));
  return order.map(i => cards[i]);
}

/** The few lines of a card that go into a model prompt. */
export function cardForPrompt(c) {
  return `${c.product}. Hazard: ${clip(c.hazard, 90)}`;
}
