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
    advice: 'If you buy it, never use it for sleep. Ask for the brand and model too: many inclined sleepers are also recalled.',
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
    advice: 'If you buy it, never use it for sleep. Ask for the brand and model too: several loungers have been recalled.',
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
  if (r.kind === 'recall') return r.level === 'likely' ? 'Recalled product' : 'Possible recall';
  if (r.kind === 'banned') return r.level === 'likely' ? (TYPE_COPY[r.banned.key] || {}).name || 'Sleep risk' : `Possible ${(TYPE_COPY[r.banned.key] || {}).short || 'sleep risk'}`;
  return '';
}

/** One sentence saying what was found, for the panel row and the top of the detail. */
export function verdictLine(r) {
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

/** A message the shopper can paste to the seller. Plain, polite, and asks for the one fact that settles it. */
export function sellerQuestion(r) {
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
  if (r.kind === 'recall') return !!r.recall;
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
    },
    recall: null,
    banned: null,
    checkedAt: new Date().toISOString(),
  };
  if (base.kind === 'recall' && decision.card) {
    const c = decision.card;
    base.recall = { id: c.id, date: c.date, product: c.product, title: c.title, hazard: c.hazard, remedy: c.remedy, url: c.url, image: c.image,
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
