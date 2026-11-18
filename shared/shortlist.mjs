// Shortlist: plain code decides which recalls a listing could be, and how strongly.
// The brand and model checks live here, in code, because a live test on 30 real listings showed the on-device model
// answers "same brand: yes" to almost anything. Code can check a word is present; the model cannot be trusted to.
// The words it checks come from the recall cards (cards.mjs): brand, product line and kind of product.
import { uniqueTokens, modelCodes } from './text.mjs';

/** Build the lookup once per card set: every card by the words that could bring it up (brand, line, model code). */
export function buildIndex(cards) {
  const byToken = new Map();
  const add = (t, i) => { if (!byToken.has(t)) byToken.set(t, []); byToken.get(t).push(i); };
  cards.forEach((c, i) => {
    const words = new Set([...c.brands.map(b => b[0]), ...c.lines.map(l => l[0]), ...c.linesWithBrand.map(l => l[0])]);
    for (const t of words) add(t, i);
    for (const code of c.codes) add(`#${code.replace(/-/g, '')}`, i);
  });
  return { cards, byToken };
}

// A year a listing states about the product: "2015 UPPAbaby Vista". Not prices, sizes or model codes.
const statedYears = text => [...String(text || '').matchAll(/(?<![\w$.-])(19[6-9]\d|20[0-3]\d)(?![\w-])/g)].map(m => Number(m[1]));

/**
 * Candidates for a listing, strongest first. Each has `strength`:
 *   "code":  the listing gives a model number that the recall lists.
 *   "line":  the listing names the recall's product line ("Snuga", "MamaRoo").
 *   "brand": the listing names the recall's brand and the same kind of product, but no model.
 * Listings that share only everyday words with a recall are not candidates at all. A listing that states a year
 * outside the years the recalled units were sold is not a candidate for that recall on brand alone.
 */
export function shortlist(index, listingText, limit = 3) {
  const tokens = new Set(uniqueTokens(listingText));
  const listingCodes = new Set(modelCodes(listingText).map(c => c.replace(/-/g, '')));
  const years = statedYears(listingText);
  const seen = new Set();
  for (const t of tokens) for (const i of index.byToken.get(t) || []) seen.add(i);
  for (const c of listingCodes) for (const i of index.byToken.get(`#${c}`) || []) seen.add(i);
  const has = words => words.every(t => tokens.has(t));

  const out = [];
  for (const i of seen) {
    const card = index.cards[i];
    const brandHit = card.brands.some(has);
    const lineHits = [...card.lines.filter(has), ...(brandHit ? card.linesWithBrand.filter(has) : [])];
    const kindHit = card.kinds.length
      ? card.kinds.some(has)
      : card.productTokens.some(t => tokens.has(t) && !card.brands.some(b => b.includes(t)) && !card.lines.some(l => l.includes(t)));
    const codeHits = card.codes.filter(c => listingCodes.has(c.replace(/-/g, '')));

    let strength = null;
    if (codeHits.length && (brandHit || kindHit)) strength = 'code';
    else if (lineHits.length && (brandHit || kindHit)) strength = 'line';
    // Brand and kind alone, only when the notice doesn't narrow the recall to models or lines the listing could have
    // named: with every recall since 1973, a brand's old recall of a few models would otherwise flag everything the
    // brand makes of that kind ("Graco Pack 'n Play" and a 2003 recall of models with raised changing tables).
    else if (brandHit && kindHit && (card.all || (!card.codes.length && !card.lines.length && !card.linesWithBrand.length))) strength = 'brand';
    if (!strength) continue;

    // The year the listing states against the years the recalled units were sold (one year's slack either side).
    let yearFit = 0;
    if (years.length && card.from && card.to) yearFit = years.some(y => y >= card.from - 1 && y <= card.to + 1) ? 1 : -1;
    if (yearFit < 0 && strength === 'brand') continue;

    const score = { code: 300, line: 200, brand: 100 }[strength] + codeHits.length * 10 + lineHits.length * 5 +
      (kindHit ? 4 : 0) + (brandHit ? 3 : 0) + yearFit * 8 + (card.all ? 2 : 0);
    out.push({ card, strength, score, matched: { brand: brandHit, line: lineHits.map(l => l.join(' ')), kind: kindHit, codes: codeHits, year: yearFit } });
  }
  // Strongest first; among equals, the newest recall.
  out.sort((a, b) => b.score - a.score || (a.card.date < b.card.date ? 1 : -1));
  return out.slice(0, limit);
}
