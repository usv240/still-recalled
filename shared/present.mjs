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

/**
 * A recall card keeps the first 140 characters of the notice's remedy, which often ends mid-word. For reading: the
 * whole sentences that fit, or, when the first sentence itself was cut, whole words and a note that the notice has
 * the rest. A remedy that was not cut is returned as it is.
 */
export function remedyText(remedy) {
  const s = String(remedy || '').trim();
  if (!/…$/.test(s)) return s;
  const body = s.slice(0, -1).trim();
  // Cut exactly at the end of a sentence: nothing is missing from what is shown.
  if (/[.!?]$/.test(body)) return body;
  const stop = body.search(/[.!?](?=\s+[A-Z][^.!?]*$)/);
  if (stop > 40) return body.slice(0, stop + 1);
  // No whole sentence: drop the cut word (and a cut web address), and say where the rest is.
  const words = body.replace(/\s*\S*$/, '').replace(/\s+https?:\S*$/i, '').replace(/(?:[\s,;:(]+(?:and|or|to|go|visit|at|for|the|a|an|of|with|by|on|in))*[\s,;:(]*$/i, '');
  return `${words}… (the notice has the rest)`;
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
  // Found by the cloud's question to the device's field guide: the listing itself does not name the product.
  if (r.kind === 'recall' && r.lookedUp) {
    return `Looks like the ${productName(r.recall.product)}, ${r.recall.warning ? 'which CPSC warned people to stop using in' : 'recalled'} ${monthYear(r.recall.date)}. The listing's words don't name this product, so check the brand before you buy.`;
  }
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
  if (r.kind === 'recall' && r.lookedUp) {
    return r.recall && r.recall.all
      ? "Don't buy it until you know it isn't this product: every unit of it is recalled."
      : "Don't buy it until the seller shows the brand and the label, and it isn't one of the recalled units.";
  }
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
export function noMatchLine(count, since, input = 'listing') {
  const what = input === 'typed' ? 'the words you typed' : 'what the listing shows';
  return `No recall found for what we could read. That doesn't mean it's safe: ${count} recall notices since ${since} were searched, and only ${what} can be matched.`;
}

/** A message the shopper can paste to the seller. Plain, polite, and asks for the one fact that settles it. */
export function sellerQuestion(r) {
  if (r.kind === 'recall' && r.lookedUp) {
    return `Hi, before I buy: what brand and model is this? Could you send a photo of its label? ` +
      `It looks like a product CPSC ${r.recall.warning ? 'warned about' : 'recalled'} (${r.recall.warning ? 'warning' : 'recall'} ${r.recall.number}, ${productName(r.recall.product)}).`;
  }
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

// For the person who owns the thing: about to list it, give it away, or keep using a hand-me-down. A listing that is
// never posted needs no takedown. Same check, other words: what to do with it, and what the recall offers its owner.
const OWNER_TYPE = {
  inclined_sleeper: 'Selling an inclined infant sleeper has been against federal law since November 2022, whatever its age. CPSC says never to use one for sleep.',
  crib_bumper: 'Selling a padded crib bumper has been against federal law since November 2022, whatever its age. CPSC\'s advice is nothing in a crib but a fitted sheet.',
  in_bed_sleeper: 'eBay and Facebook Marketplace don\'t allow loungers and nests, many have been recalled, and CPSC says never to use one for sleep.',
  drop_side_crib: 'CPSC says cribs made before June 28, 2011, drop-sides included, are very likely illegal to sell.',
};

// What to check on a possible type flag, said to the person holding the item (TYPE_COPY's advice speaks to a buyer).
const OWNER_ADVICE = {
  inclined_sleeper: 'Many inclined sleepers are also recalled: look for the brand and model on its label.',
  crib_bumper: 'A thin, breathable mesh liner is a different product from a padded bumper. Check which one yours is.',
  in_bed_sleeper: 'Several loungers have been recalled: look for the brand and model on its label.',
  drop_side_crib: 'Check whether a side of the crib slides down, and the manufacture date on its label.',
};

/** The one-line finding, said to the owner: no "listing", no "before you buy". */
function ownerVerdict(r) {
  if (r.kind !== 'recall' || !r.recall) return r.verdict || '';
  const product = productName(r.recall.product);
  const when = monthYear(r.recall.date);
  if (r.lookedUp) return `Looks like the ${product}, ${r.recall.warning ? 'which CPSC warned people to stop using in' : 'recalled'} ${when}. Check the brand on yours.`;
  if (r.recall.warning) return r.verdict || '';
  return r.level === 'likely' ? `Looks like the ${product}, recalled ${when}.` : `Same brand and kind as the ${product}, recalled ${when}. Its label shows which model you have.`;
}

/**
 * What the owner of a checked item reads: { verdict, foundBy, action, heading, lines }. `r` is a presented result
 * (present()), flagged or not. Advice, in CPSC's terms; never "safe to sell".
 */
export function ownerView(r) {
  return { verdict: ownerVerdict(r), evidence: ownerWords(r.evidence), foundBy: String(r.foundBy || '').replace(/The listing's words/g, 'The words you gave'), ...ownerAdvice(r) };
}

/** The cloud's one-line reason speaks of "the listing"; the owner gave a photo or typed words, and has no listing. */
function ownerWords(text) {
  const s = String(text || '')
    .replace(/\bthe listing(?:['’]s)? (?:photo|image|picture)\b/gi, 'your photo')
    .replace(/\bthe seller['’]s (?:photo|image|picture)s?\b/gi, 'your photo')
    .replace(/\bthe listing(?:['’]s)? (?:title|description|text|words|wording)\b/gi, 'what you entered')
    .replace(/\bthe listing['’]s\b/gi, 'its')
    .replace(/\bthe (?:item|product) for sale\b/gi, 'your item')
    .replace(/\bthe listing\b/gi, 'what you entered')
    .replace(/\bthis listing\b/gi, 'this item');
  return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

function ownerAdvice(r) {
  const heading = 'Before you sell it or give it away';
  if (r.kind === 'recall' && r.recall) {
    const c = r.recall;
    const sure = r.level === 'likely';
    if (c.warning) {
      return { heading, action: sure ? "Don't sell it or give it away. CPSC has told people to stop using this product." : 'Check the brand before you sell it or give it away.',
        lines: [sure ? 'Its seller did not recall it, so there is no refund to claim. CPSC warned the public itself.' : `CPSC warned people to stop using the ${productName(c.product)}. If yours is that brand, don't pass it on.`,
          c.remedy ? `CPSC says: ${c.remedy}` : ''].filter(Boolean) };
    }
    if (!sure || r.lookedUp) {
      return { heading, action: r.lookedUp ? 'Check the brand and the label before you sell it or give it away: it looks like a recalled product.' : 'Check its label before you sell it or give it away.',
        lines: [c.all ? `Every unit of the ${productName(c.product)} is recalled. If that is what you have, don't pass it on.` : c.tell ? `Which units are recalled: ${c.tell}` : `Some ${productName(c.product)} are recalled. The notice says which.`,
          'CPSC says it is illegal to sell any recalled product.',
          c.remedy ? `If yours is recalled, the recall's remedy: ${c.remedy} The notice says how to claim it.` : ''].filter(Boolean) };
    }
    return { heading, action: "Don't sell it or give it away: it looks like a recalled product.",
      lines: ["Stop using it unless the recall's fix has already been done. CPSC says it is illegal to sell any recalled product.",
        c.remedy ? `The recall's remedy: ${c.remedy} The notice says how to claim it.` : 'The notice says what the maker offers and how to claim it.',
        c.all ? '' : c.tell ? `Which units are recalled: ${c.tell}` : ''].filter(Boolean) };
  }
  if (r.kind === 'banned' && r.banned) {
    const rule = OWNER_TYPE[r.banned.key] || '';
    return r.level === 'likely'
      ? { heading, action: "Don't sell it or give it away.", lines: [rule, r.also ? `It also looks like the ${productName(r.also.product)} (${r.also.warning ? 'CPSC warning' : 'recall'} ${r.also.number}): the notice says what its maker offers.` : ''].filter(Boolean) }
      : { heading, action: 'Check what it is before you sell it or give it away.', lines: [OWNER_ADVICE[r.banned.key] || r.banned.advice, rule].filter(Boolean) };
  }
  return { heading, action: "No recall found for what we could read. That doesn't mean it's safe to pass on.",
    lines: ['Many recalls cover only some models. Find the model number and date on its label and search them at SaferProducts.gov before you sell it or give it away.'] };
}

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
  // A recall the listing's words did not lead to (lookup.mjs), and which question to the device's field guide did:
  // the cloud's (`asked`), or the device's own, from a brand read in the photo (`seenIt`).
  const via = decision.alsoRecall || (decision.lookedUp && decision.card) || null;
  const asked = via ? (how.lookups || []).find(l => l.found.includes(via.id)) : null;
  const askedFor = asked ? clip([asked.asked.brand, asked.asked.product].filter(Boolean).join(' '), 70) : '';
  const seenIt = via && !asked && how.seen && how.seen.id === via.id ? how.seen : null;
  const ledBy = seenIt
    ? `${how.device ? 'Gemini Nano, on this device,' : 'Gemini'} read “${clip(seenIt.brand, 40)}” in the photo and asked the recall field guide on this device, which had it.`
    : `Gemini in the cloud named the product (${askedFor}) and asked the recall field guide on this device, which had it.`;
  const viaNumber = via ? `${via.warning ? 'warning' : 'recall'} ${via.id.replace(/^W/, '')}` : '';
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
      // The device's own question to its field guide: the brand read in the photo, and the recall it found.
      seen: how.seen ? { brand: clip(how.seen.brand, 40), id: how.seen.id } : null,
    },
    // Said on the card when the listing's own words did not lead to the recall.
    // Hedged on purpose: other makers sell look-alikes (a Kids2 rocking sleeper was once named as a Rock 'n Play), so
    // the line sends the reader to the brand on the label.
    foundBy: !(asked || seenIt) ? '' : decision.alsoRecall
      ? `${decision.kind === 'recall' ? 'It may also be' : 'It may be'} the ${productName(via.product)}, ${via.warning ? 'which CPSC warned about in' : 'recalled'} ${monthYear(via.date)} (${viaNumber}). Other makers sell look-alikes, so check the brand on its label. The listing's words didn't name it: ${ledBy}`
      : `The listing's words didn't lead to this recall. ${ledBy}`,
    // A recall shown because the cloud named the product, not because the listing's words did.
    lookedUp: !!(decision.lookedUp && decision.card && decision.level !== 'none'),
    // On a type flag that stands on its own: the recall the cloud and the device's field guide pointed to as well.
    also: decision.alsoRecall && decision.level !== 'none' ? { id: via.id, number: via.id.replace(/^W/, ''), warning: !!via.warning, product: via.product, date: via.date, url: via.url } : null,
    recall: null,
    banned: null,
    checkedAt: new Date().toISOString(),
  };
  if (base.kind === 'recall' && decision.card) {
    const c = decision.card;
    // The remedy in full when the notice was fetched for the cloud check; otherwise the card's, cut back to whole words.
    const remedy = how.remedies && how.remedies[c.id] ? clip(how.remedies[c.id], 700) : remedyText(c.remedy);
    base.recall = { id: c.id, warning: !!c.warning, number: c.warning ? c.id.replace(/^W/, '') : c.id, date: c.date, product: c.product, title: c.title, hazard: c.hazard, remedy, url: c.url, image: c.image,
      // For the card's "which units" line and the label check.
      tell: c.tell || '', codes: (c.codes || []).slice(0, 14), more: !!c.more, from: c.from || 0, to: c.to || 0, all: !!c.all };
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
