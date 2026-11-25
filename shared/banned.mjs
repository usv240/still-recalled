// Banned product types have no brand or model to look up, so they cannot come from the recall shortlist.
// These word rules raise a hint; the model then looks at the listing text and photo.
//
// Legal basis checked against primary sources on 2026-11-15 (docs/research/sources.md). What the law says differs by
// type, so the shopper-facing text (present.mjs) states each type's own rule and never calls a listing "illegal":
// the tool can be wrong about what a listing is, and a recalled item may be sold once its fix has been applied.
export const BANNED_TYPES = [
  {
    key: 'inclined_sleeper',
    label: 'Inclined infant sleeper',
    // "inclined baby sleeper": sellers put a word between (a title in this form had no hint, 2026-11-20).
    pattern: /\b(inclined?\s+(?:(?:baby|infant|newborn)\s+)?sleeper|rock\s*'?n'?\s*play|rocking\s+sleeper|incline\s+bassinet|inclined\s+bassinet)\b/i,
    looksLike: 'a fabric sleeper or rocker on a frame where the baby rests on a slope, like a hammock',
    // Banned hazardous product regardless of manufacture date, from Nov 12, 2022 (sale and offer for sale included).
    basis: 'Safe Sleep for Babies Act of 2021, Pub. L. 117-126 §2; 16 CFR 1310',
    source: 'https://www.ecfr.gov/current/title-16/part-1310',
  },
  {
    key: 'crib_bumper',
    label: 'Padded crib bumper',
    pattern: /\b(crib\s+bumpers?|bumper\s+pads?|braided\s+bumpers?|cot\s+bumpers?|bumpers?\s+for\s+(slatted\s+)?cribs?|baby\s+bumpers?)\b/i,
    // Thin mesh liners are a different product from padded bumpers; do not flag them (exemption to verify).
    // BreathableBaby makes only mesh liners; three were titled "crib bumper" in the third test.
    exclude: /\b(mesh|breathable\s*baby)\b/i,
    looksLike: 'thick padded panels with ties, or a long braided fabric rope, made to line the inside rails of a crib (thin see-through mesh liners do not count)',
    // Banned regardless of manufacture date from Nov 12, 2022; covers vinyl bumper guards and vertical slat covers;
    // excludes non-padded mesh crib liners (§3(b)(3)).
    basis: 'Safe Sleep for Babies Act of 2021, Pub. L. 117-126 §3; 16 CFR 1309',
    source: 'https://www.ecfr.gov/current/title-16/part-1309',
  },
  {
    key: 'drop_side_crib',
    label: 'Drop-side crib',
    pattern: /\b(drop[\s-]*side|dropside|drop\s+down\s+side|side\s+drops?\s+down)\b/i,
    // Hospital cribs are medical devices with their own rules (a medical crib was flagged in the accuracy test).
    exclude: /\b(medical|hospital|pediatrics?)\b/i,
    looksLike: 'a crib where one side rail slides down; this usually cannot be seen in a photo',
    // The crib standards apply to the sale and resale of new or used cribs from June 28, 2011; CPSC calls older cribs
    // "very likely noncompliant, unsafe, and illegal to sell".
    basis: '16 CFR 1219 and 1220 (crib standards, June 28, 2011)',
    source: 'https://www.ecfr.gov/current/title-16/part-1219',
  },
  {
    key: 'in_bed_sleeper',
    label: 'In-bed infant sleeper or lounger',
    // Also product lines sellers name instead of the type ("Snuggle Me Organic", "DockATot Deluxe+"), and a word or two
    // between "infant" and "lounger" ("Infant Sensory Lounger"). Added after the second test, where these were missed.
    pattern: /\b(in[\s-]*bed\s+sleeper|(baby|infant|newborn)\s+nest|snuggle\s*nest|(baby|infant|newborn)\s+(\w+\s+){0,2}loungers?|co[\s-]*sleep(er|ing)\s+(nest|pod|bed)|dock\s*-?\s*a\s*-?\s*tot|snuggle\s*me\s+organic|boppy\s+(newborn\s+)?lounger|sleepyhead\s+(deluxe|grand))\b/i,
    looksLike: 'one soft cushion that lies flat, with a raised padded rim all the way around a flat pad where the baby lies',
    // Not banned as a class: 16 CFR 1236 (in-bed sleepers, nests; made from June 23, 2022) and 16 CFR 1243 (loungers;
    // made after May 5, 2025) apply by manufacture date. CPSC warns against them for sleep; eBay and Facebook
    // Marketplace prohibit them by policy; many are recalled.
    basis: '16 CFR 1236 (infant sleep products) and 16 CFR 1243 (infant support cushions)',
    source: 'https://www.cpsc.gov/SafeSleep',
  },
];

// Doll furniture and toy versions use the same words ("crib bumper for doll bed") and are not infant products.
// Sewing patterns ("Simplicity 3795 Nursery Quilt Canopy Bumper Pad Pattern") sell paper, not the product.
// Added after the 2026-11-15 accuracy test, where three sewing patterns were flagged as crib bumpers.
// "Plush" alone is a fabric ("Lounger Pillow Plush Pink"); only a plush toy, animal or doll is a toy. The second test
// found a lounger dropped as a toy because of that word.
const FOR_DOLLS = /\b(dolls?|doll\s*house|dollhouse|american\s+girl|bitty\s+baby|reborn|barbie|plush\s+(toys?|animals?|dolls?)|stuffed|(sewing|quilt|craft)\s+patterns?|patterns?\s+(cut|uncut)|(simplicity|butterick|mccall'?s?|vogue)\s+(patterns?|house|\d{3,4}))\b/i;

// Listings for a piece of a product, not the product. A recalled swing's power adapter is not a recalled swing.
// "Cup holder" alone is not enough: "Stroller w/ Canopy & Cup Holder" sells the stroller.
// "repuesto" (replacement part) and "solo la funda" (cover only) in Spanish titles.
const PART_ONLY_ES = /(?<![a-z\u00e0-\u00ff])(repuestos?|solo\s+(la\s+)?(funda|tela|base))(?![a-z\u00e0-\u00ff])/i;
const PART_ONLY = /\b(replacement\s+(part|parts|seat|pad|cover|leg|arm|piece|strap|straps|tray|canopy|wheel|wheels|battery|basket|fabric|cup\s*holder)|(ac|dc|ac\/dc|ac\s+dc)\s+adapter|power\s+(supply|adapter|cord)|adapter\s+for|charger\s+for|parts?\s+only|manual\s+only|instruction\s+manual|feet\s+caps?|leg\s+pin|cup\s*holder\s+(for|only|attachment))\b/i;

// Listings that often contain a banned item without naming it: multi-piece crib bedding sets usually include a bumper.
// These are not flagged on their words; they are sent to the cloud so it can look at the photo.
// Portable sleepers and travel beds are often a padded nest under another name ("Portable Bedside Baby Sleeper" whose
// photo is a lounger), so the photo decides. Added after the second test.
// After the third test: "Baby Bedding ... 5 Pc Set" and "Crib Baby bed Bedding" were bedding sets with a padded bumper
// in the photo that never reached a photo check; LulyBoo sells loungers as a "Lounge". Not yet measured.
const MAY_CONTAIN = [
  { key: 'crib_bumper', pattern: /\b((crib|nursery|cot|baby)\s+(bedding\s+)?set|(crib|nursery|cot|baby)\s+(\w+\s+){0,2}bedding|\d+\s*-?\s*(pc|pcs|piece)\s+(crib|nursery|baby|bedding)|(crib|nursery|baby)\s+\d+\s*-?\s*(pc|pcs|piece))\b/i },
  { key: 'in_bed_sleeper', pattern: /\b(portable\s+(infant|baby|newborn|bedside)\s+(baby\s+)?(sleeper|bed)|travel\s+(baby\s+|infant\s+)?(bed|sleeper)|baby\s+bed\s+for\s+(the\s+)?bed|(baby|infant|newborn)\s+(sleep\s+)?pod|luly\s*boo|(baby|infant|newborn)\s+lounge)\b/i },
];

/** Banned types a listing may contain without naming them; worth a cloud look at the photo. Doll items never count. */
export function mayContain(listingText) {
  const text = listingText || '';
  if (FOR_DOLLS.test(text)) return [];
  return MAY_CONTAIN.filter(m => m.pattern.test(text)).map(m => BANNED_TYPES.find(t => t.key === m.key));
}

// Spanish names for the same types, as U.S. sellers write them on Craigslist, OfferUp and Facebook Marketplace.
// Added 2026-11-25; not yet measured on a test set.
const L = '(?<![a-z\u00e0-\u00ff])', R = '(?![a-z\u00e0-\u00ff])';
const ES = {
  crib_bumper: new RegExp(`${L}(chichoneras?|protector(es)?\\s+acolchad[oa]s?|protector(es)?\\s+(acolchad[oa]s?\\s+)?(de|para)\\s+(la\\s+)?cuna|protector(es)?\\s+trenzad[oa]s?|trenzad[oa]s?\\s+(de|para)\\s+cuna)${R}`, 'i'),
  inclined_sleeper: new RegExp(`${L}((mecedora|dormidor|cuna|moises|mois\u00e9s)\\s+inclinad[oa]|inclinad[oa]\\s+para\\s+beb[e\u00e9])${R}`, 'i'),
  in_bed_sleeper: new RegExp(`${L}(nido\\s+(de\\s+|para\\s+)?(beb[e\u00e9]s?|reci[e\u00e9]n\\s+nacidos?)|cama\\s+nido|reductor\\s+de\\s+cuna|colch[o\u00f3]n\\s+nido)${R}`, 'i'),
  drop_side_crib: new RegExp(`${L}(cuna\\s+de\\s+(lado|baranda)\\s+(abatible|corrediz[oa]|deslizable))${R}`, 'i'),
};
/** The Spanish pattern for a type, or null. */
export const spanishPattern = key => ES[key] || null;

/** Banned types whose words appear in the listing text. Doll items never count. */
export function bannedHints(listingText) {
  const text = listingText || '';
  if (FOR_DOLLS.test(text)) return [];
  return BANNED_TYPES.filter(t => (t.pattern.test(text) || (ES[t.key] && ES[t.key].test(text))) && !(t.exclude && t.exclude.test(text)));
}

/** True when the wording says the listing is a toy version or a spare part, so no recall or ban applies to it. */
export function notTheProduct(listingText) {
  const text = listingText || '';
  return FOR_DOLLS.test(text) || PART_ONLY.test(text) || PART_ONLY_ES.test(text);
}
