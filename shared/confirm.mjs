// The cloud check. It runs only on listings the on-device pass flagged, so most listings never leave the device.
//
// Division of labour between the two models:
//   on-device  screens every listing on the page: is it the product, what kind, does the photo look like a banned type
//   cloud      reads the full recall notice (models, dates, where the label is), looks at the listing photo next to
//              the recall's own photo, and decides whether the flag stands, plus what a buyer should check to be sure
import { BANNED_TYPES } from './banned.mjs';
import { noticeForPrompt } from './notice.mjs';
import { clip } from './text.mjs';
import { LOOKUP_SYSTEM } from './lookup.mjs';

const BANNED_KEYS = BANNED_TYPES.map(t => t.key);

export const CONFIRM_SYSTEM = [
  'You check one secondhand listing against a U.S. government (CPSC) recall notice and a short list of infant product types that may no longer be sold.',
  'You get the listing (title, price, maybe a description, and its photo) and, when there is one, the recall notice text and a photo of the recalled product.',
  'Answer only from what the listing shows. Never say a listing is safe.',
  'what_is_for_sale: "the_product" when it sells a whole product; "part_or_accessory" for a spare piece of a larger product (power adapter, replacement cover or seat pad, manual, mobile, cup holder); "toy_or_doll_version" for toys, doll furniture or miniatures; "unclear" otherwise.',
  '  Crib bumpers, crib bedding sets, loungers, nests and sleepers sold on their own are "the_product", not accessories.',
  'matches_recall: "yes" when the listing shows the same brand and the same product as the notice, and nothing in the listing (model, version, colour, date) places it outside what the notice recalls.',
  '  "no" when the listing is clearly a different product: another brand, another kind of product, or a model or version the notice does not include.',
  '  "cannot_tell" when brand and kind match but the listing does not show enough (model number, manufacture date, version) to know whether it is one of the recalled units.',
  '  "no_recall_given" when no recall notice is given.',
  'banned_type: one of the listed types only when the listing clearly is that kind of product, otherwise "none".',
  'evidence: one short sentence naming what in the listing decided your answer.',
  'check_before_buying: one short sentence telling a buyer what to look at or ask the seller to settle it, in the notice\'s own terms (which models or dates are recalled, where the label is, whether a set includes a padded bumper). Empty when matches_recall is "no" and banned_type is "none".',
  'where: a box around the one thing in the listing photo that decided your answer (the padded bumper among the bedding, the lounger, the recalled product), as [ymin, xmin, ymax, xmax] with each number from 0 to 1000. An empty list when you are flagging nothing, when there is no listing photo, or when the thing is not visible in it.',
  'Do not state legal conclusions or give orders: never write "banned", "illegal", "prohibited" or "do not buy". The app adds its own wording about the rules.',
].join('\n');

export const CONFIRM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['what_is_for_sale', 'matches_recall', 'banned_type', 'evidence', 'check_before_buying', 'where'],
  properties: {
    what_is_for_sale: { type: 'string', enum: ['the_product', 'part_or_accessory', 'toy_or_doll_version', 'unclear'] },
    matches_recall: { type: 'string', enum: ['yes', 'no', 'cannot_tell', 'no_recall_given'] },
    banned_type: { type: 'string', enum: ['none', ...BANNED_KEYS] },
    evidence: { type: 'string' },
    check_before_buying: { type: 'string' },
    where: { type: 'array', items: { type: 'integer' } },
  },
};

// The confirmation with the lookup_recalls function offered (lookup.mjs): the cloud can ask the device's field guide
// for the recall of a product it names from the photo, and says which recall it matched.
export const CONFIRM_SYSTEM_LOOKUP = `${CONFIRM_SYSTEM}
${LOOKUP_SYSTEM}`;
export const CONFIRM_SCHEMA_LOOKUP = {
  ...CONFIRM_SCHEMA,
  required: [...CONFIRM_SCHEMA.required, 'recall_id'],
  properties: { ...CONFIRM_SCHEMA.properties, recall_id: { type: 'string' } },
};

/**
 * The cloud judged the listing against a stand-in for the notice (notice.mjs noticeFromCard: the CPSC recall API did
 * not answer). The stand-in holds less than the notice does (it can lack the models or versions a recall leaves
 * out), so a recall match made on it is a soft flag at most.
 */
export function capForStandIn(decision) {
  return decision && decision.kind === 'recall' && decision.level === 'likely'
    ? { ...decision, level: 'possible', why: 'matched against the short record on the device; the full recall notice could not be fetched' }
    : decision;
}

/**
 * The cloud's box as fractions of the photo, { x, y, w, h }, or null. Dropped when malformed, tiny, or nearly the
 * whole photo: an outline around everything shows the shopper nothing.
 */
export function boxFrom(where) {
  if (!Array.isArray(where) || where.length !== 4 || where.some(n => !Number.isFinite(n))) return null;
  const [y0, x0, y1, x1] = where.map(n => Math.min(1000, Math.max(0, n)) / 1000);
  const w = x1 - x0, h = y1 - y0;
  if (w < 0.04 || h < 0.04 || w * h > 0.7) return null;
  return { x: +x0.toFixed(3), y: +y0.toFixed(3), w: +w.toFixed(3), h: +h.toFixed(3) };
}

/**
 * Prompt parts for the cloud model: text, the listing photo, then the notice and the recall photo.
 * `listingPhoto` and `recallPhoto` are inlineData parts or null.
 */
export function confirmParts({ listing, notice, listingPhoto, recallPhoto, seen = null }) {
  const parts = [[
    'LISTING',
    `Title: ${clip(listing.title, 200)}`,
    listing.price ? `Price: ${listing.price}` : '',
    listing.description ? `Description: ${clip(listing.description, 1200)}` : '',
    listingPhoto ? 'Listing photo:' : 'No listing photo.',
  ].filter(Boolean).join('\n')];
  if (listingPhoto) parts.push(listingPhoto);

  parts.push(notice
    ? ['', 'RECALL NOTICE', noticeForPrompt(notice), recallPhoto ? 'Photo of the recalled product, from the notice:' : ''].filter(Boolean).join('\n')
    : '\nRECALL NOTICE\n(none given)');
  if (notice && recallPhoto) parts.push(recallPhoto);

  // The device's own lookup (lookup.mjs deviceLookup): `seen` is { brand, id, notice }. It is a guess to check, not a
  // match by the listing's words. On ten test photos the built-in model gave "Fisher-Price" for three different
  // sleepers and was right once, so the cloud is told the reading may be wrong, and how to answer about it or about
  // another product it can name itself.
  if (seen && seen.notice) {
    parts.push(['', 'FOUND BY THE DEVICE (unverified)',
      `The listing's words name no brand. A small model on the device looked at the photo and gave the brand "${clip(seen.brand, 60)}", and the device's field guide has the recall below for that brand and kind of product. The reading may be wrong: small models guess a brand from a product's shape.`,
      `If you can see that brand in the photo, or recognise the product for sale as the one in this notice, answer recall_id "${seen.id}" and matches_recall for it. If it is another product that you can name, call lookup_recalls for that product. Otherwise leave recall_id empty.`,
      `recall_id: ${seen.id}`,
      noticeForPrompt(seen.notice), !notice && recallPhoto ? 'Photo of the recalled product, from this notice:' : ''].filter(Boolean).join('\n'));
    if (!notice && recallPhoto) parts.push(recallPhoto);
  }

  parts.push(['', 'BANNED TYPES', ...BANNED_TYPES.map(t => `- ${t.key}: ${t.looksLike}`)].join('\n'));
  return parts;
}

/**
 * Final decision from the on-device flag (`device`, the output of judge.decide) and the cloud answer.
 * With no cloud answer (offline, quota, error) the on-device flag stands, marked as unconfirmed.
 * Levels: "none" (show nothing), "possible" (soft flag), "likely" (warning). Never "safe".
 * `lookedUp`: the recall cards the device returned when the cloud called lookup_recalls. A recall the cloud names
 * counts only when it is one of them.
 * `device.seen`: the recall card the device's own lookup found from a brand read in the photo, if any.
 */
export function decideFinal(device, cloud, hints, lookedUp = []) {
  if (!cloud) {
    // The device's own lookup is a guess for the cloud to check (the built-in model often gives a brand it did not
    // read). Unchecked, it is not shown: the decision is what the device had without it.
    const { seen, ...rest } = device;
    return { ...rest, confirmed: false };
  }
  const base = { kind: null, card: null, banned: null, confirmed: true, evidence: cloud.evidence || '', check: cloud.check_before_buying || '', where: boxFrom(cloud.where) };

  // A toy is never the product. "Part or accessory" clears a listing only when the cloud also sees no banned type:
  // a crib bumper is an "accessory" to a crib in everyday speech, but it is the product the rule is about.
  if (cloud.what_is_for_sale === 'toy_or_doll_version' ||
      (cloud.what_is_for_sale === 'part_or_accessory' && (cloud.banned_type === 'none' || device.kind === 'recall'))) {
    return { ...base, level: 'none', why: 'the listing is a part or a toy version, not the product' };
  }

  // The cloud named the product, asked the device's field guide, and judged the listing against what it returned.
  // A recall found this way rests on the cloud recognising the product: the listing's words did not name it, so no
  // code checked the brand, and look-alikes exist (many rocking sleepers resemble the Rock 'n Play). It is shown, but
  // it never becomes a red "Recalled product" on its own: at most a soft flag, or a line on a type flag that stands
  // without it.
  // The same caution holds for a recall the device's own lookup found (device.seen): the model that looked at the
  // photo read a brand there, and the field guide had a recall for that brand and kind (lookup.mjs, deviceLookup).
  // The cloud is given it as "found by the device, unverified" and answers with its recall_id only when it sees that
  // brand or product itself.
  const agrees = cloud.matches_recall === 'yes' || cloud.matches_recall === 'cannot_tell';
  const pool = device.seen ? [...lookedUp, device.seen] : lookedUp;
  // The number as the cloud wrote it: "23088", or with words around it ("Recall 23088", "#23088").
  const said = String(cloud.recall_id || '').trim();
  const numbers = said.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const hit = said ? pool.find(c => c.id === said) || pool.find(c => numbers.includes(c.id)) : null;
  const found = agrees ? hit : null;
  // The recall the listing's own words matched, checked by code.
  const wordsCard = device.kind === 'recall' && device.card && !device.seen ? device.card : null;

  if (wordsCard && !hit) {
    if (cloud.matches_recall === 'yes') {
      return { ...base, level: 'likely', kind: 'recall', card: wordsCard, why: 'matches the recalled product in the notice' };
    }
    if (cloud.matches_recall === 'cannot_tell') {
      return { ...base, level: 'possible', kind: 'recall', card: wordsCard, why: 'same brand and kind as a recalled product; the listing does not show which model' };
    }
    // "no": not this recall. A banned type can still apply, so fall through.
  }
  if (wordsCard && hit && agrees) {
    // The cloud judged a recall its lookup returned, not the one the listing's words matched. The words' recall was
    // checked by code and is not ruled out, so it stays on the card, soft, and the other is named beside it.
    return { ...base, level: 'possible', kind: 'recall', card: wordsCard, alsoRecall: hit, why: 'the listing\'s words match one recall; the cloud named another product and the field guide on the device had a recall for it too' };
  }

  const cloudBanned = BANNED_TYPES.find(t => t.key === cloud.banned_type) || null;
  const deviceBanned = device.kind === 'banned' ? device.banned : null;
  if (cloudBanned && (hints.length || deviceBanned)) {
    // Trust the listing's words for which type when there are any; models confuse look-alike types.
    return { ...base, level: 'likely', kind: 'banned', banned: hints[0] || cloudBanned, why: 'both models see a product type that may no longer be sold', ...(found ? { alsoRecall: found } : {}) };
  }
  if (found) {
    return { ...base, level: 'possible', kind: 'recall', card: found, lookedUp: true, why: device.seen && found.id === device.seen.id
      ? 'a brand was read in the photo on the device; its field guide had a recall for that brand and kind of product; the cloud saw the same product; the listing\'s words do not name it'
      : 'the cloud named the product from the photo or the description; the field guide on the device had a recall for it; the listing itself does not name it' };
  }
  if (hints.length) {
    return { ...base, level: 'possible', kind: 'banned', banned: hints[0], why: 'the wording names a product type that may no longer be sold; the photo did not confirm it' };
  }
  if (cloudBanned && device.askCloud && device.maybe && cloudBanned.key === device.maybe.key) {
    // A set that did not name the item, and the cloud sees it in the photo ("crib set" with a padded bumper).
    return { ...base, level: 'possible', kind: 'banned', banned: cloudBanned, why: 'the photo appears to include a product type that may no longer be sold' };
  }
  if (cloudBanned && device.secondOpinion) {
    // The web page asks the cloud about every baby product it is given, one at a time; the cloud alone can raise a
    // soft flag there. The extension never sets this (dozens of listings a page, so the cloud only confirms).
    return { ...base, level: 'possible', kind: 'banned', banned: cloudBanned, why: 'the photo looks like a product type that may no longer be sold' };
  }
  return { ...base, level: 'none', why: 'the cloud check did not confirm the flag' };
}
