// What the shopper reads. Turns a decision (judge.decide or confirm.decideFinal) into a plain, serialisable result:
// no RegExps, no functions, so it can travel between extension pages and be stored.
//
// Wording rules: never "safe"; never a legal verdict on the listing ("banned", "illegal"): the tool can be wrong about
// what a listing is. The risk lines state each type's own rule and CPSC's guidance, checked against primary sources on
// 2026-11-15 (docs/research/sources.md).
import { clip } from './text.mjs';

export const SAFE_SLEEP_URL = 'https://www.cpsc.gov/SafeSleep';

// One entry per type key in banned.mjs.
export const TYPE_COPY = {
  inclined_sleeper: {
    name: 'Inclined infant sleeper',
    short: 'inclined sleeper',
    risk: 'Selling an inclined infant sleeper has been against federal law since November 2022. CPSC says products with an incline over 10° should never be used for infant sleep; about 100 deaths were reported in one recalled model alone.',
    advice: 'Never use it for sleep. Many inclined sleepers are also recalled, so ask for the brand and model.',
    ask: 'Hi, before I buy: what brand and model is this, and what is the manufacture date on its label?',
  },
  crib_bumper: {
    name: 'Padded crib bumper',
    short: 'crib bumper',
    risk: 'Selling a padded crib bumper has been against federal law since November 2022. CPSC lists bumpers among the soft items that can suffocate a baby; its advice is nothing but a fitted sheet in a crib.',
    advice: 'A thin, breathable mesh liner is a different product from a padded bumper. Ask which this is before you buy.',
    ask: 'Hi, before I buy: is this a padded bumper or a thin mesh liner? Could you send a photo of the label?',
  },
  in_bed_sleeper: {
    name: 'Infant lounger or nest',
    short: 'lounger',
    risk: 'Many young babies can\'t lift their heads to pull away from soft padding. CPSC says these are never for sleep, eBay and Facebook Marketplace don\'t allow them, and many have been recalled.',
    advice: 'Never use it for sleep, not even for a nap. Several loungers have been recalled, so ask for the brand and model.',
    ask: 'Hi, before I buy: what brand and model is this? Could you send a photo of the label?',
  },
  drop_side_crib: {
    name: 'Drop-side crib',
    short: 'drop-side crib',
    risk: 'Drop-side cribs don\'t meet the federal crib standard in force since June 2011, and CPSC says older cribs very likely can\'t be legally sold.',
    advice: 'Ask whether a side of the crib slides down, and for the manufacture date on its label.',
    ask: 'Hi, before I buy: does one side of the crib slide down? What is the manufacture date on its label?',
  },
};

/** Recall product names as a sentence can carry them: "All Models of Fisher-Price Snuga Swings" -> "Fisher-Price Snuga Swings". */
export function productName(product) {
  return clip(String(product || '').replace(/^all\s+(models\s+of\s+|units\s+of\s+)?/i, '').replace(/^the\s+/i, ''), 90);
}

/** The badge text on the listing: short, specific, never "safe". */
export function badgeText(r) {
  // A CPSC safety warning: the maker did not recall the product, so CPSC warned the public itself.
  if (r.kind === 'recall' && r.recall && r.recall.warning) return r.level === 'likely' ? 'CPSC warning' : 'Possible CPSC warning';
  if (r.kind === 'recall') return r.level === 'likely' ? 'Recalled product' : 'Possible recall';
  if (r.kind === 'banned') return r.level === 'likely' ? (TYPE_COPY[r.banned.key] || {}).name || 'Sleep risk' : `Possible ${(TYPE_COPY[r.banned.key] || {}).short || 'sleep risk'}`;
  return '';
}

/** One sentence saying what was found, for the panel row and the top of the detail. */
export function verdictLine(r) {
  if (r.kind === 'recall' && r.recall.warning) {
    const product = productName(r.recall.product);
    return r.level === 'likely'
      ? `Looks like the ${product}. CPSC warned people to stop using them in ${monthYear(r.recall.date)}; the seller behind them did not recall them.`
      : `Same brand and kind as the ${product}, which CPSC warned people to stop using in ${monthYear(r.recall.date)}.`;
  }
  if (r.kind === 'recall') {
    const product = productName(r.recall.product);
    return r.level === 'likely'
      ? `Looks like the ${product}, recalled ${monthYear(r.recall.date)}.`
      : `Same brand and kind as the ${product}, recalled ${monthYear(r.recall.date)}. The listing doesn't show which model.`;
  }
  if (r.kind === 'banned') {
    const name = (TYPE_COPY[r.banned.key] || { name: 'infant sleep product' }).name.toLowerCase();
    const a = /^[aeiou]/.test(name) ? 'an' : 'a';
    return r.level === 'likely' ? `This looks like ${a} ${name}.` : `This may be or include ${a} ${name}.`;
  }
  return '';
}

/**
 * What to do, in one line, at the top of the card: a flag that only names a product leaves the shopper asking "so can
 * I buy it?". Advice, not a verdict on the listing, which the tool can be wrong about.
 */
export function actionLine(r) {
  if (r.kind === 'recall' && r.recall && r.recall.warning) {
    return r.level === 'possible'
      ? "Don't buy it until you know it isn't the product CPSC warned about."
      : "Don't buy it. CPSC has told people to stop using this product.";
  }
  if (r.kind === 'recall') {
    if (r.level === 'possible') return "Don't buy it until the seller's label shows it isn't one of the recalled units.";
    return r.recall && r.recall.all
      ? "Don't buy it. Every unit of this product is recalled."
      : "Don't buy it unless the seller's label shows it isn't one of the recalled units.";
  }
  if (r.kind === 'banned') {
    if (r.level === 'possible') return 'Ask the seller what it is before you buy.';
    return ({
      crib_bumper: "Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.",
      inclined_sleeper: 'Skip this one, and never use an inclined sleeper for sleep.',
      in_bed_sleeper: 'Never use it for sleep, not even for a nap.',
      drop_side_crib: "Skip this one: drop-side cribs don't meet today's crib standard.",
    })[r.banned && r.banned.key] || 'Never use it for sleep.';
  }
  return '';
}

/** What the shopper reads when nothing matched: never an all-clear. */
export function noMatchLine(count, since) {
  return `No recall found for what we could read. That doesn't mean it's safe: ${count} recall notices since ${since} were searched, and only what the listing shows can be matched.`;
}

/** A message the shopper can paste to the seller. Plain, polite, and asks for the one fact that settles it. */
export function sellerQuestion(r) {
  if (r.kind === 'recall' && r.recall.warning) {
    return `Hi, before I buy: what brand is this, and could you send a photo of its tag or label? ` +
      `CPSC has warned people to stop using a product like it (warning ${r.recall.number}, ${productName(r.recall.product)}).`;
  }
  if (r.kind === 'recall') {
    return `Hi, before I buy: could you send a photo of the label showing the model number and manufacture date? ` +
      `I'd like to check it against a CPSC recall (${r.recall.id}, ${productName(r.recall.product)}).`;
  }
  if (r.kind === 'banned' && r.banned.key === 'crib_bumper' && r.level === 'possible') {
    return 'Hi, before I buy: does this set include padded crib bumpers? Could you list every piece that comes with it?';
  }
  if (r.kind === 'banned') return (TYPE_COPY[r.banned.key] || {}).ask || '';
  return '';
}

// CPSC's advice to shoppers who find a recalled product for sale online: "report the sale through saferproducts.gov",
// with a screenshot and a link to the listing (cpsc.gov, FAQs for Buying and Selling Products Online, read
// 2026-11-15). Its e-commerce team asks sites to take recalled and banned products down.
export const CPSC_REPORT_URL = 'https://www.saferproducts.gov/IncidentReporting';

// The rule a CPSC reader needs, per type: only the types whose sale the law itself rules out. Loungers and nests are
// not offered a report unless a recall names them, since older ones are not covered by a sales ban.
const SALE_RULE = {
  inclined_sleeper: 'Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1310, inclined sleepers for infants may not be sold after November 12, 2022.',
  crib_bumper: 'Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1309, padded crib bumpers may not be sold after November 12, 2022.',
  drop_side_crib: 'Full-size cribs sold since June 28, 2011 must meet the federal crib standard (16 CFR 1219), which drop-side designs do not meet.',
};

/** Whether the card offers a report to CPSC: only a likely flag, and only where the sale itself is ruled out. */
export function reportable(r) {
  if (r.level !== 'likely') return false;
  // A warning is not a recall: the report text's wording would not hold, so none is offered.
  if (r.kind === 'recall') return !!r.recall && !r.recall.warning;
  return r.kind === 'banned' && !!SALE_RULE[r.banned && r.banned.key];
}

/**
 * The text a shopper pastes into the SaferProducts.gov form. Factual and hedged ("appears to be"): it reports what the
 * listing shows, with the link CPSC asks for, and never states a verdict the tool can't make.
 */
export function cpscReport(r, seen = new Date()) {
  if (!reportable(r)) return '';
  const day = seen.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const what = r.kind === 'recall'
    ? `It appears to be the ${productName(r.recall.product)}, recalled ${monthYear(r.recall.date)} (CPSC recall ${r.recall.id}). The listing does not say the recall remedy has been applied.`
    : `It appears to be ${/^[aeiou]/i.test(r.banned.name) ? 'an' : 'a'} ${r.banned.name.toLowerCase()}. ${SALE_RULE[r.banned.key]}`;
  const head = r.kind === 'recall' ? 'A recalled product listed for sale online.' : 'An infant sleep product listed for sale online.';
  const facts = [
    listingLink(r) ? `Listing: ${listingLink(r)}` : 'Listing: see the attached screenshot.',
    `Title: ${r.listing.title}`,
    r.listing.price ? `Asking price: ${r.listing.price}` : '',
    `Seen on: ${day}`,
  ].filter(Boolean).join('\n');
  const why = [what, r.confirmed && r.evidence ? `What the listing shows: ${r.evidence}` : ''].filter(Boolean).join('\n');
  return [head, facts, why].join('\n\n');
}

/** A made-up listing on the practice page (still-recalled.web.app/try): nothing there to report or message. */
export function isPractice(r) {
  return /^https:\/\/still-recalled\.web\.app\/try\//.test((r.listing && r.listing.url) || '');
}

/** The listing's own address without search-page tracking: what a report or a message should point at. */
export function listingLink(r) {
  let u;
  try { u = new URL(r.listing.url); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  if (/(^|\.)ebay\.com$/.test(u.hostname) && /^\d{9,}$/.test(String(r.id))) return `https://www.ebay.com/itm/${r.id}`;
  return `${u.origin}${u.pathname}`;
}

/** Where "Ask the seller" goes: eBay opens its own message box on the listing; other sites keep it on the listing. */
export function sellerMessageUrl(r) {
  const link = listingLink(r);
  return link && /^https:\/\/www\.ebay\.com\/itm\//.test(link) ? `${link}?m2mOpen=1` : link;
}

function monthYear(isoDate) {
  const [y, m] = String(isoDate || '').split('-').map(Number);
  if (!y || !m) return 'by CPSC';
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
}

/**
 * The stored result for one listing.
 * `decision`: output of decide or decideFinal. `listing`: { id, title, price, image, url }.
 * `how`: { words: true } | { device: true, cloud: { model } | null, cloudError? }.
 */
export function present(listing, decision, how = {}) {
  // The cloud's question to the device's field guide that led to this recall (lookup.mjs), if one did.
  const asked = decision.lookedUp && decision.card ? (how.lookups || []).find(l => l.found.includes(decision.card.id)) : null;
  const base = {
    id: listing.id,
    listing: { title: listing.title, price: listing.price || '', image: listing.image || '', url: listing.url || '' },
    level: decision.level,
    kind: decision.level === 'none' ? null : decision.kind,
    why: decision.why || '',
    check: decision.check || '',
    evidence: decision.evidence || '',
    confirmed: !!decision.confirmed,
    // Where in the listing photo the cloud check saw it: { x, y, w, h } as fractions of the photo, or null.
    where: (decision.level !== 'none' && decision.where) || null,
    how: {
      device: !!how.device,
      deviceLevel: how.deviceLevel || (how.words ? 'words' : ''),
      // The built-in model's reading of "which units", and the cloud's answer on the recall, for comparing the two.
      candidate: how.candidate || '',     // the recall the word rules proposed, and how strongly
      deviceUnit: how.deviceUnit || '',
      cloudMatch: (how.cloud && how.cloud.answer && how.cloud.answer.matches_recall) || '',
      judgedInCloud: !!how.judgedInCloud,
      deviceError: how.deviceError || "",
      cloudModel: (how.cloud && how.cloud.model) || '',
      cloudError: how.cloudError || '',
      // What the cloud asked the device's field guide, and the recalls the device returned.
      lookups: (how.lookups || []).slice(0, 3),
    },
    // Said on the card when the listing's own words did not lead to the recall.
    foundBy: asked ? `The listing's words didn't lead to this recall. Gemini in the cloud named the product (${clip([asked.asked.brand, asked.asked.product].filter(Boolean).join(' '), 70)}) and asked the recall field guide on this device, which had it.` : '',
    recall: null,
    banned: null,
    checkedAt: new Date().toISOString(),
  };
  if (base.kind === 'recall' && decision.card) {
    const c = decision.card;
    base.recall = { id: c.id, warning: !!c.warning, number: c.warning ? c.id.replace(/^W/, '') : c.id, date: c.date, product: c.product, title: c.title, hazard: c.hazard, remedy: c.remedy, url: c.url, image: c.image,
      // For the card's "which units" line and the label check.
      tell: c.tell || '', codes: (c.codes || []).slice(0, 14), from: c.from || 0, to: c.to || 0, all: !!c.all };
  }
  if (base.kind === 'banned' && decision.banned) {
    const t = TYPE_COPY[decision.banned.key] || {};
    base.banned = { key: decision.banned.key, name: t.name || decision.banned.label, risk: t.risk || '', advice: t.advice || '', source: SAFE_SLEEP_URL };
  }
  if (base.kind) {
    base.badge = badgeText(base);
    base.verdict = verdictLine(base);
    base.action = actionLine(base);
    base.question = sellerQuestion(base);
    base.messageUrl = sellerMessageUrl(base);
    base.report = cpscReport(base);
  }
  return base;
}

/** Order for display: likely before possible, recalls before types, then page order. */
export function byConcern(a, b) {
  const rank = r => (r.level === 'likely' ? 0 : r.level === 'possible' ? 1 : 2) * 2 + (r.kind === 'recall' ? 0 : 1);
  return rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0);
}
