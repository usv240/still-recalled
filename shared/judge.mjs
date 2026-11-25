// The questions put to the model about one listing, and how its answers become a decision.
// The same prompt and schema are used on-device and in the cloud, so the two can be compared directly.
//
// Division of labour, set after a live test on real listings:
//   code  checks words: is the recall's brand, model or line named in the listing (shortlist.mjs)
//   model looks and reads: is this the product itself or a part or toy, what kind of product is it, what the photo shows
import { cardForPrompt } from './cards.mjs';
import { BANNED_TYPES } from './banned.mjs';
import { clip } from './text.mjs';

export const SYSTEM = [
  'You look at one secondhand listing: its title, description and photo. Answer only what you can see or read.',
  'what_is_for_sale: "the_product" when the listing sells a whole product; "part_or_accessory" when it sells a spare part, adapter, cover, manual or add-on for a product; "toy_or_doll_version" when it is a toy, doll furniture or a miniature; "unclear" otherwise.',
  'product_kind: the kind of product for sale in at most five words, for example "infant swing" or "air fryer".',
  'same_kind_as_recalled: true only when the product for sale is the same kind of product as the RECALLED PRODUCT given. If none is given, answer false.',
  'recalled_unit: read "Which units" under RECALLED PRODUCT. "no" only when the listing itself names a model, version or year that those lines leave out. "yes" when it names one they include. Otherwise, or if none is given, "cannot_tell".',
  'banned_type: choose a type only when the listing clearly is that kind of product. Otherwise "none".',
  'brand_seen: a brand or maker name you can read in the photo, printed on the product, its tag, its label or its box. Copy the letters you see. Empty when you cannot read one. Never guess a brand from the product\'s shape or colour.',
].join('\n');

// A fixed schema, so one model instance serves every listing.
export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['what_is_for_sale', 'product_kind', 'same_kind_as_recalled', 'recalled_unit', 'banned_type', 'brand_seen'],
  properties: {
    what_is_for_sale: { type: 'string', enum: ['the_product', 'part_or_accessory', 'toy_or_doll_version', 'unclear'] },
    product_kind: { type: 'string' },
    same_kind_as_recalled: { type: 'boolean' },
    // The built-in model's reading of the card's "which units" line, written by the cloud at build time. Recorded
    // next to the cloud's own answer and not yet acted on: see docs/accuracy.md, "The cloud teaches the device".
    recalled_unit: { type: 'string', enum: ['yes', 'no', 'cannot_tell'] },
    banned_type: { type: 'string', enum: ['none', ...BANNED_TYPES.map(t => t.key)] },
    // A brand name read in the photo. When the listing's words do not say it, the device looks it up in its own
    // field guide (lookup.mjs, deviceLookup): sellers often leave the brand out of the title.
    brand_seen: { type: 'string' },
  },
};

/** Text half of the prompt. `candidate` is the strongest shortlist entry or null; `hints` come from the word rules. */
export function promptText(listing, candidate, hints) {
  // Always describe the types a photo can show, so a listing with a vague title can still be caught from its picture.
  const visible = BANNED_TYPES.filter(t => t.key !== 'drop_side_crib' || hints.includes(t));
  return [
    'LISTING',
    `Title: ${clip(listing.title, 200)}`,
    listing.description ? `Description: ${clip(listing.description, 900)}` : '',
    '',
    'RECALLED PRODUCT',
    candidate ? cardForPrompt(candidate.card) : '(none given)',
    '',
    'BANNED TYPES',
    ...visible.map(t => `- ${t.key}: ${t.looksLike}`),
  ].filter(l => l !== '').join('\n');
}

/**
 * Turn the model's answers plus the code's checks into what the shopper sees.
 * level: "none" (show nothing), "possible" (soft flag), "likely" (warning). The tool never reports "safe".
 */
export function decide(answer, candidate, hints, maybe = []) {
  // `maybe`: banned types the listing may contain without naming them (mayContain). If nothing else flags it,
  // the shopper sees nothing yet, but the listing goes to the cloud for a look at the photo.
  const none = { level: 'none', kind: null, card: null, banned: null, why: '', askCloud: maybe.length > 0, maybe: maybe[0] || null };
  // A model number in the listing that the recall lists was matched by code. The built-in model may disagree (it
  // calls the listing a part, or another kind of product), but its word alone never clears that match: it stays a
  // soft flag, and the cloud reads the full notice (0.16.1; the seventh review found the device clearing it alone).
  const codeMatch = candidate && candidate.strength === 'code' && !answer.same_kind_as_recalled ? candidate : null;
  if (codeMatch) {
    return { level: 'possible', kind: 'recall', card: codeMatch.card, banned: null, strength: 'code', disputed: true,
      why: 'the listing gives a model number this recall lists; the model on this device was not sure it is the same product' };
  }
  if (answer.what_is_for_sale === 'part_or_accessory' || answer.what_is_for_sale === 'toy_or_doll_version') {
    // The words name a risky type but the built-in model calls the listing a part or a toy: the two disagree, so the
    // cloud looks at the photo to settle it. ("DockATot Deluxe+ Lounger Cover" whose photo shows the whole lounger was
    // cleared as a part in the first test.) Parts and toys the words already recognise never reach this point.
    return { ...none, askCloud: hints.length > 0, maybe: hints[0] || none.maybe, why: 'the listing is a part or a toy version, not the product' };
  }

  if (candidate && answer.same_kind_as_recalled) {
    const why = {
      code: 'the listing gives a model number this recall lists',
      line: 'the listing names this recalled product line',
      brand: 'same brand and kind of product; the listing does not state the model',
    }[candidate.strength];
    // Only a matching model number is strong enough to warn on-device. The rest wait for the cloud check.
    return { level: candidate.strength === 'code' ? 'likely' : 'possible', kind: 'recall', card: candidate.card, banned: null, strength: candidate.strength, why };
  }

  const seen = BANNED_TYPES.find(t => t.key === answer.banned_type) || null;
  if (hints.length && seen) {
    // The words and the model agree. Trust the words for which type: the model confuses look-alike types.
    return { level: 'likely', kind: 'banned', card: null, banned: hints[0], why: 'the wording and the photo both point to a banned type' };
  }
  if (hints.length) {
    return { level: 'possible', kind: 'banned', card: null, banned: hints[0], why: 'the wording points to a banned type' };
  }
  if (seen && seen.key !== 'drop_side_crib') {
    return { level: 'possible', kind: 'banned', card: null, banned: seen, why: 'the photo looks like a banned type' };
  }
  return none;
}
