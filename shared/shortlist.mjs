// Shortlist: plain code decides which recalls a listing could be, and how strongly.
// The brand and model checks live here, in code, because a live test on 30 real listings showed the on-device model
// answers "same brand: yes" to almost anything. Code can check a word is present; the model cannot be trusted to.
import { uniqueTokens, modelCodes } from './text.mjs';

// Line names are found as product-name words that few recall notices use ("snuga", "mamaroo"). Some everyday listing
// words are rare in notices too, and must not count as a line on their own: a Craigslist "Bedside Sleeper/Bassinet"
// matched "Papablic Bedside Sleepers" as the same line (found in the end-to-end test, 2026-11-15).
const EVERYDAY = new Set(('bedside lovely mommy mommys daddy deluxe portable foldable folding convertible organic premium ' +
  'classic original vintage adjustable compact travel sensory montessori cozy comfy plush luxury modern wooden ' +
  'electric smart outdoor indoor kitchen bedroom rocking rocker cradle bundle combo hybrid ultra super mega').split(' '));

/** Build the lookup once per card set. */
export function buildIndex(cards) {
  const byToken = new Map();
  cards.forEach((c, i) => {
    for (const t of new Set([...c.tokens, ...c.brand])) {
      if (!byToken.has(t)) byToken.set(t, []);
      byToken.get(t).push(i);
    }
  });
  return { cards, byToken };
}

/**
 * Candidates for a listing, strongest first. Each has `strength`:
 *   "code":  the listing gives a model number that the recall lists.
 *   "line":  the listing names the recall's product line ("Snuga", "MamaRoo").
 *   "brand": the listing names the recall's brand and the same kind of product, but no model.
 * Listings that share only everyday words with a recall are not candidates at all.
 */
export function shortlist(index, listingText, limit = 3) {
  const tokens = new Set(uniqueTokens(listingText));
  const listingCodes = new Set(modelCodes(listingText).map(c => c.replace(/-/g, '')));
  const seen = new Set();
  for (const t of tokens) for (const i of index.byToken.get(t) || []) seen.add(i);

  const out = [];
  for (const i of seen) {
    const card = index.cards[i];
    const brandHit = card.brand.length > 0 && card.brand.every(b => tokens.has(b));
    const special = new Set([...card.brand, ...card.line]);
    const lineHits = card.line.filter(t => tokens.has(t) && (brandHit || !EVERYDAY.has(t)));
    const kindHits = card.productTokens.filter(t => tokens.has(t) && !special.has(t));
    const codeHits = card.codes.filter(c => listingCodes.has(c.replace(/-/g, '')));

    let strength = null;
    if (codeHits.length && (brandHit || kindHits.length)) strength = 'code';
    else if (lineHits.length && (brandHit || kindHits.length)) strength = 'line';
    else if (brandHit && kindHits.length) strength = 'brand';
    if (!strength) continue;

    const score = { code: 300, line: 200, brand: 100 }[strength] + codeHits.length * 10 + lineHits.length * 5 + kindHits.length + (brandHit ? 3 : 0);
    out.push({ card, strength, score, matched: { brand: brandHit, line: lineHits, kind: kindHits, codes: codeHits } });
  }
  // Strongest first; among equals, the newest recall.
  out.sort((a, b) => b.score - a.score || (a.card.date < b.card.date ? 1 : -1));
  return out.slice(0, limit);
}
