// Step 1 of the pipeline, for one listing: plain code decides whether the listing could be a recall or a banned
// product type, and whether a model should look at it. Shared by the extension, the web page and the Android app.
import { shortlist } from './shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from './banned.mjs';
import { uniqueTokens } from './text.mjs';

// Infant products get a photo check even without a recall candidate: a lounger listed as "baby bed" has no telling words.
export const INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;

// Kinds of baby product a seller can list with no brand and no telling word, where the shape is the hazard: an
// inclined sleeper sold as "baby rocker", a lounger sold as "baby pillow". Measured on the fifth blind test: both
// listings the extension missed were these, and Gemini Nano saw nothing to flag in either photo.
export const SLEEPISH = /\b(rockers?|sleepers?|nappers?|loungers?|nests?|pods?|pillows?|cushions?|positioners?|bassinets?|cradles?|swings?|bouncers?|hammocks?|docks?)\b/i;

// Every brand any recall or warning card names (one-word brands, and longer ones whole).
const brandSets = new WeakMap();
function brands(idx) {
  let b = brandSets.get(idx);
  if (!b) {
    b = { one: new Set(), many: [] };
    for (const c of idx.cards) for (const br of c.brands || []) { if (br.length === 1) b.one.add(br[0]); else b.many.push(br); }
    brandSets.set(idx, b);
  }
  return b;
}
/** Whether a title names any brand the field guide knows, recalled or not. */
export function namesKnownBrand(idx, title) {
  const toks = uniqueTokens(title);
  const { one, many } = brands(idx);
  if (toks.some(t => one.has(t))) return true;
  const have = new Set(toks);
  return many.some(br => br.every(t => have.has(t)));
}

/**
 * `needsEyes` says whether the on-device model should look at it. `unnamedSleep`: no recall, no risky word, no brand
 * the field guide knows, and a sleep-type kind of product; the extension sends these to the cloud even when the
 * built-in model sees nothing (the cloud can read a brand off the photo and call lookup_recalls).
 */
export function triage(idx, listing) {
  const text = `${listing.title} ${listing.description || ''}`;
  const partOrToy = notTheProduct(listing.title);
  const candidate = partOrToy ? null : shortlist(idx, text)[0] || null;
  const hints = partOrToy ? [] : bannedHints(text);
  const maybe = partOrToy ? [] : mayContain(listing.title);
  const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title));
  const unnamedSleep = needsEyes && !candidate && !hints.length && !maybe.length && SLEEPISH.test(listing.title) && !namesKnownBrand(idx, listing.title);
  return { partOrToy, candidate, hints, maybe, needsEyes, unnamedSleep };
}

/** The decision when no model answered (no built-in model, or it failed): the words alone decide. */
export function wordsOnlyAnswer(candidate) {
  return { what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!candidate, banned_type: 'none' };
}
