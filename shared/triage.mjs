// Step 1 of the pipeline, for one listing: plain code decides whether the listing could be a recall or a banned
// product type, and whether a model should look at it. Shared by the extension, the web page and the Android app.
import { shortlist } from './shortlist.mjs';
import { bannedHints, notTheProduct, mayContain } from './banned.mjs';

// Infant products get a photo check even without a recall candidate: a lounger listed as "baby bed" has no telling words.
export const INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;

/** `needsEyes` says whether the on-device model should look at it. */
export function triage(idx, listing) {
  const text = `${listing.title} ${listing.description || ''}`;
  const partOrToy = notTheProduct(listing.title);
  const candidate = partOrToy ? null : shortlist(idx, text)[0] || null;
  const hints = partOrToy ? [] : bannedHints(text);
  const maybe = partOrToy ? [] : mayContain(listing.title);
  const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title));
  return { partOrToy, candidate, hints, maybe, needsEyes };
}

/** The decision when no model answered (no built-in model, or it failed): the words alone decide. */
export function wordsOnlyAnswer(candidate) {
  return { what_is_for_sale: 'the_product', product_kind: '', same_kind_as_recalled: !!candidate, banned_type: 'none' };
}
