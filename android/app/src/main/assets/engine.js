(() => {
  // shared/text.mjs
  var NOTICE_WORDS = new Set(
    "recall recalls recalled recalling due risk risks hazard hazards serious injury injuries death deaths violation violations violate violates federal mandatory standard standards regulation regulations ban sold exclusively online at by from the and for with of to in on or a an its their this that these those reannounces announces announce expanded expands cpsc inc llc co corp company usa new used".split(" ")
  );
  var singular = (w) => w.length > 3 && /[a-z]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w;
  function tokenize(text) {
    const out2 = [];
    const raw = String(text || "").toLowerCase().replace(/[’']/g, "").replace(/\b(\d)\s*(?:-\s*in\s*-|\s+in\s+|-)\s*(\d)\b/g, "$1in$2");
    for (const chunk of raw.split(/[^a-z0-9-]+/)) {
      if (!chunk) continue;
      const parts = chunk.split("-").filter(Boolean);
      for (const p of parts) {
        const word = singular(p);
        if (word.length >= 2 && !NOTICE_WORDS.has(word) && !NOTICE_WORDS.has(p)) out2.push(word);
      }
      if (parts.length > 1 && /\d/.test(chunk)) out2.push(parts.join(""));
    }
    return out2;
  }
  function uniqueTokens(text) {
    return [...new Set(tokenize(text))];
  }
  var NOT_A_MODEL = /^(\d+-?in-?\d+|\d+[-.]?\d*-?(qt|quart|oz|lb|lbs|v|w|mm|cm|ft|inch|in|pc|pcs|pk|pack|piece|gb|mah|wheel|wheels|month|months|mo|m|yr|year|years|ct|count|x)|\d+x\d+|(19|20)\d{2}s?)$/i;
  function modelCodes(text) {
    const found = /* @__PURE__ */ new Set();
    for (const m of String(text || "").matchAll(/\b[A-Za-z0-9][A-Za-z0-9-]{2,}\b/g)) {
      const t = m[0];
      const digits = (t.match(/\d/g) || []).length, hasLetter = /[A-Za-z]/.test(t);
      if (NOT_A_MODEL.test(t)) continue;
      if (digits >= 2 && hasLetter && t.length >= 4 || /^\d{5,}$/.test(t)) found.add(t.toUpperCase());
    }
    return [...found];
  }
  function clip(text, max) {
    const s = String(text || "").replace(/\s+/g, " ").trim();
    return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "\u2026";
  }

  // shared/shortlist.mjs
  function buildIndex(cards) {
    const byToken = /* @__PURE__ */ new Map();
    const add = (t, i) => {
      if (!byToken.has(t)) byToken.set(t, []);
      byToken.get(t).push(i);
    };
    cards.forEach((c, i) => {
      const words = /* @__PURE__ */ new Set([...c.brands.map((b) => b[0]), ...c.lines.map((l) => l[0]), ...c.linesWithBrand.map((l) => l[0])]);
      for (const t of words) add(t, i);
      for (const code of c.codes) add(`#${code.replace(/-/g, "")}`, i);
    });
    return { cards, byToken };
  }
  var statedYears = (text) => [...String(text || "").matchAll(/(?<![\w$.-])(19[6-9]\d|20[0-3]\d)(?![\w-])/g)].map((m) => Number(m[1]));
  function shortlist(index2, listingText, limit = 3) {
    const tokens = new Set(uniqueTokens(listingText));
    const listingCodes = new Set(modelCodes(listingText).map((c) => c.replace(/-/g, "")));
    const years2 = statedYears(listingText);
    const seen = /* @__PURE__ */ new Set();
    for (const t of tokens) for (const i of index2.byToken.get(t) || []) seen.add(i);
    for (const c of listingCodes) for (const i of index2.byToken.get(`#${c}`) || []) seen.add(i);
    const has = (words) => words.every((t) => tokens.has(t));
    const out2 = [];
    for (const i of seen) {
      const card = index2.cards[i];
      const brandHit = card.brands.some(has);
      const lineHits = [...card.lines.filter(has), ...brandHit ? card.linesWithBrand.filter(has) : []];
      const kindHit = card.kinds.length ? card.kinds.some(has) : card.productTokens.some((t) => tokens.has(t) && !card.brands.some((b) => b.includes(t)) && !card.lines.some((l) => l.includes(t)));
      const codeHits = card.codes.filter((c) => listingCodes.has(c.replace(/-/g, "")));
      let strength = null;
      if (codeHits.length && (brandHit || kindHit)) strength = "code";
      else if (lineHits.length && (brandHit || kindHit)) strength = "line";
      else if (brandHit && kindHit && (card.all || !card.codes.length && !card.lines.length && !card.linesWithBrand.length)) strength = "brand";
      if (!strength) continue;
      let yearFit = 0;
      if (years2.length && card.from && card.to) yearFit = years2.some((y) => y >= card.from - 1 && y <= card.to + 1) ? 1 : -1;
      if (yearFit < 0 && strength === "brand") continue;
      const score = { code: 300, line: 200, brand: 100 }[strength] + codeHits.length * 10 + lineHits.length * 5 + (kindHit ? 4 : 0) + (brandHit ? 3 : 0) + yearFit * 8 + (card.all ? 2 : 0);
      out2.push({ card, strength, score, matched: { brand: brandHit, line: lineHits.map((l) => l.join(" ")), kind: kindHit, codes: codeHits, year: yearFit } });
    }
    out2.sort((a, b) => b.score - a.score || (a.card.warning ? 1 : 0) - (b.card.warning ? 1 : 0) || (a.card.date < b.card.date ? 1 : -1));
    return out2.slice(0, limit);
  }

  // shared/banned.mjs
  var BANNED_TYPES = [
    {
      key: "inclined_sleeper",
      label: "Inclined infant sleeper",
      // "inclined baby sleeper": sellers put a word between (a title in this form had no hint, 2026-11-20).
      pattern: /\b(inclined?\s+(?:(?:baby|infant|newborn)\s+)?sleeper|rock\s*'?n'?\s*play|rocking\s+sleeper|incline\s+bassinet|inclined\s+bassinet)\b/i,
      looksLike: "a fabric sleeper or rocker on a frame where the baby rests on a slope, like a hammock",
      // Banned hazardous product regardless of manufacture date, from Nov 12, 2022 (sale and offer for sale included).
      basis: "Safe Sleep for Babies Act of 2021, Pub. L. 117-126 \xA72; 16 CFR 1310",
      source: "https://www.ecfr.gov/current/title-16/part-1310"
    },
    {
      key: "crib_bumper",
      label: "Padded crib bumper",
      pattern: /\b(crib\s+bumpers?|bumper\s+pads?|braided\s+bumpers?|cot\s+bumpers?|bumpers?\s+for\s+(slatted\s+)?cribs?|baby\s+bumpers?)\b/i,
      // Thin mesh liners are a different product from padded bumpers; do not flag them (exemption to verify).
      // BreathableBaby makes only mesh liners; three were titled "crib bumper" in the third test.
      exclude: /\b(mesh|breathable\s*baby)\b/i,
      looksLike: "thick padded panels with ties, or a long braided fabric rope, made to line the inside rails of a crib (thin see-through mesh liners do not count)",
      // Banned regardless of manufacture date from Nov 12, 2022; covers vinyl bumper guards and vertical slat covers;
      // excludes non-padded mesh crib liners (§3(b)(3)).
      basis: "Safe Sleep for Babies Act of 2021, Pub. L. 117-126 \xA73; 16 CFR 1309",
      source: "https://www.ecfr.gov/current/title-16/part-1309"
    },
    {
      key: "drop_side_crib",
      label: "Drop-side crib",
      pattern: /\b(drop[\s-]*side|dropside|drop\s+down\s+side|side\s+drops?\s+down)\b/i,
      // Hospital cribs are medical devices with their own rules (a medical crib was flagged in the accuracy test).
      exclude: /\b(medical|hospital|pediatrics?)\b/i,
      looksLike: "a crib where one side rail slides down; this usually cannot be seen in a photo",
      // The crib standards apply to the sale and resale of new or used cribs from June 28, 2011; CPSC calls older cribs
      // "very likely noncompliant, unsafe, and illegal to sell".
      basis: "16 CFR 1219 and 1220 (crib standards, June 28, 2011)",
      source: "https://www.ecfr.gov/current/title-16/part-1219"
    },
    {
      key: "in_bed_sleeper",
      label: "In-bed infant sleeper or lounger",
      // Also product lines sellers name instead of the type ("Snuggle Me Organic", "DockATot Deluxe+"), and a word or two
      // between "infant" and "lounger" ("Infant Sensory Lounger"). Added after the second test, where these were missed.
      pattern: /\b(in[\s-]*bed\s+sleeper|(baby|infant|newborn)\s+nest|snuggle\s*nest|(baby|infant|newborn)\s+(\w+\s+){0,2}loungers?|co[\s-]*sleep(er|ing)\s+(nest|pod|bed)|dock\s*-?\s*a\s*-?\s*tot|snuggle\s*me\s+organic|boppy\s+(newborn\s+)?lounger|sleepyhead\s+(deluxe|grand))\b/i,
      looksLike: "one soft cushion that lies flat, with a raised padded rim all the way around a flat pad where the baby lies",
      // Not banned as a class: 16 CFR 1236 (in-bed sleepers, nests; made from June 23, 2022) and 16 CFR 1243 (loungers;
      // made after May 5, 2025) apply by manufacture date. CPSC warns against them for sleep; eBay and Facebook
      // Marketplace prohibit them by policy; many are recalled.
      basis: "16 CFR 1236 (infant sleep products) and 16 CFR 1243 (infant support cushions)",
      source: "https://www.cpsc.gov/SafeSleep"
    }
  ];
  var FOR_DOLLS = /\b(dolls?|doll\s*house|dollhouse|american\s+girl|bitty\s+baby|reborn|barbie|plush\s+(toys?|animals?|dolls?)|stuffed|(sewing|quilt|craft)\s+patterns?|patterns?\s+(cut|uncut)|(simplicity|butterick|mccall'?s?|vogue)\s+(patterns?|house|\d{3,4}))\b/i;
  var PART_ONLY_ES = /(?<![a-z\u00e0-\u00ff])(repuestos?|solo\s+(la\s+)?(funda|tela|base))(?![a-z\u00e0-\u00ff])/i;
  var PART_ONLY = /\b(replacement\s+(part|parts|seat|pad|cover|leg|arm|piece|strap|straps|tray|canopy|wheel|wheels|battery|basket|fabric|cup\s*holder)|(ac|dc|ac\/dc|ac\s+dc)\s+adapter|power\s+(supply|adapter|cord)|adapter\s+for|charger\s+for|parts?\s+only|manual\s+only|instruction\s+manual|feet\s+caps?|leg\s+pin|cup\s*holder\s+(for|only|attachment))\b/i;
  var MAY_CONTAIN = [
    { key: "crib_bumper", pattern: /\b((crib|nursery|cot|baby)\s+(bedding\s+)?set|(crib|nursery|cot|baby)\s+(\w+\s+){0,2}bedding|\d+\s*-?\s*(pc|pcs|piece)\s+(crib|nursery|baby|bedding)|(crib|nursery|baby)\s+\d+\s*-?\s*(pc|pcs|piece))\b/i },
    { key: "in_bed_sleeper", pattern: /\b(portable\s+(infant|baby|newborn|bedside)\s+(baby\s+)?(sleeper|bed)|travel\s+(baby\s+|infant\s+)?(bed|sleeper)|baby\s+bed\s+for\s+(the\s+)?bed|(baby|infant|newborn)\s+(sleep\s+)?pod|luly\s*boo|(baby|infant|newborn)\s+lounge)\b/i }
  ];
  function mayContain(listingText) {
    const text = listingText || "";
    if (FOR_DOLLS.test(text)) return [];
    return MAY_CONTAIN.filter((m) => m.pattern.test(text)).map((m) => BANNED_TYPES.find((t) => t.key === m.key));
  }
  var L = "(?<![a-z\xE0-\xFF])";
  var R = "(?![a-z\xE0-\xFF])";
  var ES = {
    crib_bumper: new RegExp(`${L}(chichoneras?|protector(es)?\\s+acolchad[oa]s?|protector(es)?\\s+(acolchad[oa]s?\\s+)?(de|para)\\s+(la\\s+)?cuna|protector(es)?\\s+trenzad[oa]s?|trenzad[oa]s?\\s+(de|para)\\s+cuna)${R}`, "i"),
    inclined_sleeper: new RegExp(`${L}((mecedora|dormidor|cuna|moises|mois\xE9s)\\s+inclinad[oa]|inclinad[oa]\\s+para\\s+beb[e\xE9])${R}`, "i"),
    in_bed_sleeper: new RegExp(`${L}(nido\\s+(de\\s+|para\\s+)?(beb[e\xE9]s?|reci[e\xE9]n\\s+nacidos?)|cama\\s+nido|reductor\\s+de\\s+cuna|colch[o\xF3]n\\s+nido)${R}`, "i"),
    drop_side_crib: new RegExp(`${L}(cuna\\s+de\\s+(lado|baranda)\\s+(abatible|corrediz[oa]|deslizable))${R}`, "i")
  };
  function bannedHints(listingText) {
    const text = listingText || "";
    if (FOR_DOLLS.test(text)) return [];
    return BANNED_TYPES.filter((t) => (t.pattern.test(text) || ES[t.key] && ES[t.key].test(text)) && !(t.exclude && t.exclude.test(text)));
  }
  function notTheProduct(listingText) {
    const text = listingText || "";
    return FOR_DOLLS.test(text) || PART_ONLY.test(text) || PART_ONLY_ES.test(text);
  }

  // shared/triage.mjs
  var INFANT_ES = /(?<![a-z\u00e0-\u00ff])(beb[e\u00e9]s?|reci[e\u00e9]n\s+nacid[oa]s?|cunas?|mois[e\u00e9]s|columpios?|mecedor(a|as|es)?|corral(ito|itos|es)?|nidos?\s+(de|para)\s+beb|chichoneras?|portabeb[e\u00e9]s?|hamacas?\s+(de|para)\s+beb)(?![a-z\u00e0-\u00ff])/i;
  var INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;
  var SLEEPISH = /\b(rockers?|sleepers?|nappers?|loungers?|nests?|pods?|pillows?|cushions?|positioners?|bassinets?|cradles?|swings?|bouncers?|hammocks?|docks?)\b/i;
  var SLEEPISH_ES = /(?<![a-zà-ÿ])(mecedor(a|as|es)?|mois[eé]s|cunas?|columpios?|hamacas?|nidos?|almohadas?|coj[ií]n(es)?|dormidor(es)?)(?![a-zà-ÿ])/i;
  var brandSets = /* @__PURE__ */ new WeakMap();
  function brands(idx2) {
    let b = brandSets.get(idx2);
    if (!b) {
      b = { one: /* @__PURE__ */ new Set(), many: [] };
      for (const c of idx2.cards) for (const br of c.brands || []) {
        if (br.length === 1) b.one.add(br[0]);
        else b.many.push(br);
      }
      brandSets.set(idx2, b);
    }
    return b;
  }
  function namesKnownBrand(idx2, title) {
    const toks = uniqueTokens(title);
    const { one, many } = brands(idx2);
    if (toks.some((t) => one.has(t))) return true;
    const have = new Set(toks);
    return many.some((br) => br.every((t) => have.has(t)));
  }
  function triage(idx2, listing) {
    const text = `${listing.title} ${listing.description || ""}`;
    const partOrToy = notTheProduct(listing.title);
    const candidate = partOrToy ? null : shortlist(idx2, text)[0] || null;
    const hints = partOrToy ? [] : bannedHints(text);
    const maybe = partOrToy ? [] : mayContain(listing.title);
    const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title) || INFANT_ES.test(listing.title));
    const unnamedSleep = needsEyes && !candidate && !hints.length && !maybe.length && (SLEEPISH.test(listing.title) || SLEEPISH_ES.test(listing.title)) && !namesKnownBrand(idx2, listing.title);
    return { partOrToy, candidate, hints, maybe, needsEyes, unnamedSleep };
  }
  function wordsOnlyAnswer(candidate) {
    return { what_is_for_sale: "the_product", product_kind: "", same_kind_as_recalled: !!candidate, banned_type: "none" };
  }

  // shared/cards.mjs
  var first = (list, key = "Name") => Array.isArray(list) && list[0] && list[0][key] || "";
  var NOT_BRAND = new Set(
    "inc llc ltd co corp corporation company group international intl usa us america american store shop shops trading technology technologies tech limited appliances products product industries industrial enterprises holdings global brands brand direct official home kids baby toys outdoor sports electronics electric amazon amazoncom walmart walmartcom target targetcom costco ebay temu shein wayfair tiktok etsy china hong kong shenzhen guangzhou thailand vietnam taiwan mexico canada india".split(" ")
  );
  var COMPANY_FORM = new Set("inc llc ltd co corp corporation company limited group international intl products product industries enterprises holdings".split(" "));
  var EVERYDAY = new Set("bedside lovely mommy mommys daddy deluxe portable foldable folding convertible organic premium classic original vintage adjustable compact travel sensory montessori cozy comfy plush luxury modern wooden electric smart outdoor indoor kitchen bedroom rocking rocker cradle bundle combo hybrid ultra super mega baby infant newborn toddler kid children child girl boy mini max plus pro lite light standard basic series collection edition model style set kit pack large small medium big little black white blue pink gray grey red green".split(" "));
  function brandTokens(r, productTokens) {
    const title = String(r.Title || "");
    const sources = [];
    const lead = title.match(/^(.+?)\s+(?:Re-?announces?|Recalls?|Expands?)\b/i);
    if (lead) sources.push(lead[1]);
    const tail = title.match(/\bby\s+([^;,]+?)(?:\s+Due\s+to\b[^;]*)?\s*(?:;|$)/i);
    if (tail) sources.push(tail[1]);
    for (const key of ["Manufacturers", "Importers", "Distributors"]) {
      const name = first(r[key]);
      if (name) sources.push(name.split(/,\s*of\s+/i)[0]);
    }
    const product = new Set(productTokens);
    for (const s of sources) {
      const toks = tokenize(s).filter((t) => !NOT_BRAND.has(t) && !/^\d+$/.test(t) && t.length >= 3);
      const inProduct = toks.filter((t) => product.has(t));
      if (inProduct.length) return inProduct.slice(0, 3);
      if (toks.length && toks.length <= 3) return toks;
    }
    return [];
  }
  var phrase = (text) => uniqueTokens(text).filter((t) => t.length >= 2);
  var phrases = (list, max) => {
    const seen = /* @__PURE__ */ new Set(), out2 = [];
    for (const x of Array.isArray(list) ? list : []) {
      const p = phrase(x);
      const k = p.join(" ");
      if (p.length && p.length <= 5 && !seen.has(k)) {
        seen.add(k);
        out2.push(p);
      }
      if (out2.length >= max) break;
    }
    return out2;
  };
  var year = (y) => Number.isInteger(y) && y >= 1960 && y <= 2035 ? y : 0;
  function cardFromCpsc(r, spot = null) {
    const id = String(r.RecallNumber || "").trim();
    const product = clip(first(r.Products), 120);
    const title = clip(r.Title, 160);
    if (!id || !(product || title) || !r.URL) return null;
    const captions = (r.Images || []).map((i) => i.Caption || "").join(" ");
    const codes = [.../* @__PURE__ */ new Set([
      ...(spot && spot.models || []).map((m) => String(m).toUpperCase().trim()).filter((m) => /\d/.test(m) && m.length >= 3 && m.length <= 24),
      ...modelCodes(product),
      ...modelCodes(captions),
      ...modelCodes(r.Description)
    ])].filter((c) => !/^(19|20)\d{2}$/.test(c));
    const more = codes.length > 14;
    codes.length = Math.min(codes.length, 14);
    const productTokens = uniqueTokens(product || title);
    const whole = (b) => String(b || "").replace(/['’]s\b/gi, "s").split(/[^A-Za-z0-9]+/).filter(Boolean).every((w) => w.length >= 2);
    let brands2 = spot ? phrases((spot.brands || []).filter(whole), 3).map((b) => b.filter((t) => !COMPANY_FORM.has(t))).filter((b) => b.length && !b.every((t) => NOT_BRAND.has(t) || EVERYDAY.has(t) || t.length < 3)) : [];
    if (!brands2.length) {
      const b = brandTokens(r, productTokens).filter((t) => !EVERYDAY.has(t));
      if (b.length) brands2 = [b];
    }
    const kinds = spot ? phrases([spot.kind, ...spot.other_names || []], 5) : [];
    const kindWords = new Set(kinds.flat());
    const brandWords = new Set(brands2.flat());
    const lines = spot ? phrases(spot.lines, 4).map((l) => l.filter((t) => !brandWords.has(t))).filter((l) => l.length && !l.every((t) => kindWords.has(t))) : [];
    return {
      id,
      date: String(r.RecallDate || "").slice(0, 10),
      product: product || title,
      title,
      hazard: clip(first(r.Hazards), 200),
      remedy: clip(first(r.Remedies), 140),
      url: r.URL,
      image: first(r.Images, "URL"),
      codes,
      brands: brands2,
      lines,
      // sorted into `lines` (distinctive) and `linesWithBrand` in cardsFromCpsc
      linesWithBrand: [],
      kinds,
      // Without a spotter card: the product name's words stand in for the kind.
      productTokens: spot ? [] : productTokens,
      tell: spot ? clip(spot.tell, 220) : "",
      from: spot ? year(spot.sold_from) : 0,
      to: spot ? year(spot.sold_to) : 0,
      all: !!(spot && spot.all_units),
      ...more ? { more: true } : {}
    };
  }
  function cardForPrompt(c) {
    const sold = c.from && c.to ? ` Sold ${c.from === c.to ? `in ${c.from}` : `${c.from} to ${c.to}`}.` : "";
    return `${c.product}.${sold} Hazard: ${clip(c.hazard, 90)}${c.tell ? `
Which units: ${c.tell}` : ""}`;
  }
  function liveCardsFromCpsc(records, spots = /* @__PURE__ */ new Map(), baseCards = []) {
    const kindUse = /* @__PURE__ */ new Map();
    for (const c of baseCards) {
      const own = new Set(c.brands.flat());
      for (const t of new Set(c.kinds.flat())) if (!own.has(t)) kindUse.set(t, (kindUse.get(t) || 0) + 1);
    }
    const namesAKind = (t) => (kindUse.get(t) || 0) > 2;
    const known = new Set(baseCards.map((c) => c.id));
    const out2 = [];
    for (const r of records) {
      const id = String(r.RecallNumber || "").trim();
      if (known.has(id)) continue;
      const c = cardFromCpsc(r, spots.get(id) || null);
      if (!c) continue;
      known.add(id);
      const named = new Set(uniqueTokens(c.product));
      c.brands = c.brands.filter((b) => b.length > 1 || !namesAKind(b[0]) || named.has(b[0]) && !c.kinds.some((k) => k.includes(b[0])));
      c.linesWithBrand = c.lines;
      c.lines = [];
      c.live = true;
      out2.push(c);
    }
    return out2.sort((a, b) => a.date < b.date ? 1 : -1);
  }

  // shared/judge.mjs
  var SYSTEM = [
    "You look at one secondhand listing: its title, description and photo. Answer only what you can see or read.",
    'what_is_for_sale: "the_product" when the listing sells a whole product; "part_or_accessory" when it sells a spare part, adapter, cover, manual or add-on for a product; "toy_or_doll_version" when it is a toy, doll furniture or a miniature; "unclear" otherwise.',
    'product_kind: the kind of product for sale in at most five words, for example "infant swing" or "air fryer".',
    "same_kind_as_recalled: true only when the product for sale is the same kind of product as the RECALLED PRODUCT given. If none is given, answer false.",
    'recalled_unit: read "Which units" under RECALLED PRODUCT. "no" only when the listing itself names a model, version or year that those lines leave out. "yes" when it names one they include. Otherwise, or if none is given, "cannot_tell".',
    'banned_type: choose a type only when the listing clearly is that kind of product. Otherwise "none".',
    "brand_seen: a brand or maker name you can read in the photo, printed on the product, its tag, its label or its box. Copy the letters you see. Empty when you cannot read one. Never guess a brand from the product's shape or colour."
  ].join("\n");
  var SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["what_is_for_sale", "product_kind", "same_kind_as_recalled", "recalled_unit", "banned_type", "brand_seen"],
    properties: {
      what_is_for_sale: { type: "string", enum: ["the_product", "part_or_accessory", "toy_or_doll_version", "unclear"] },
      product_kind: { type: "string" },
      same_kind_as_recalled: { type: "boolean" },
      // The built-in model's reading of the card's "which units" line, written by the cloud at build time. Recorded
      // next to the cloud's own answer and not yet acted on: see docs/accuracy.md, "The cloud teaches the device".
      recalled_unit: { type: "string", enum: ["yes", "no", "cannot_tell"] },
      banned_type: { type: "string", enum: ["none", ...BANNED_TYPES.map((t) => t.key)] },
      // A brand name read in the photo. When the listing's words do not say it, the device looks it up in its own
      // field guide (lookup.mjs, deviceLookup): sellers often leave the brand out of the title.
      brand_seen: { type: "string" }
    }
  };
  function promptText(listing, candidate, hints) {
    const visible = BANNED_TYPES.filter((t) => t.key !== "drop_side_crib" || hints.includes(t));
    return [
      "LISTING",
      `Title: ${clip(listing.title, 200)}`,
      listing.description ? `Description: ${clip(listing.description, 900)}` : "",
      "",
      "RECALLED PRODUCT",
      candidate ? cardForPrompt(candidate.card) : "(none given)",
      "",
      "BANNED TYPES",
      ...visible.map((t) => `- ${t.key}: ${t.looksLike}`)
    ].filter((l) => l !== "").join("\n");
  }
  function decide(answer, candidate, hints, maybe = []) {
    const none = { level: "none", kind: null, card: null, banned: null, why: "", askCloud: maybe.length > 0, maybe: maybe[0] || null };
    const codeMatch = candidate && candidate.strength === "code" && !answer.same_kind_as_recalled ? candidate : null;
    if (codeMatch) {
      return {
        level: "possible",
        kind: "recall",
        card: codeMatch.card,
        banned: null,
        strength: "code",
        disputed: true,
        why: "the listing gives a model number this recall lists; the model on this device was not sure it is the same product"
      };
    }
    if (answer.what_is_for_sale === "part_or_accessory" || answer.what_is_for_sale === "toy_or_doll_version") {
      return { ...none, askCloud: hints.length > 0, maybe: hints[0] || none.maybe, why: "the listing is a part or a toy version, not the product" };
    }
    if (candidate && answer.same_kind_as_recalled) {
      const why = {
        code: "the listing gives a model number this recall lists",
        line: "the listing names this recalled product line",
        brand: "same brand and kind of product; the listing does not state the model"
      }[candidate.strength];
      return { level: candidate.strength === "code" ? "likely" : "possible", kind: "recall", card: candidate.card, banned: null, strength: candidate.strength, why };
    }
    const seen = BANNED_TYPES.find((t) => t.key === answer.banned_type) || null;
    if (hints.length && seen) {
      return { level: "likely", kind: "banned", card: null, banned: hints[0], why: "the wording and the photo both point to a banned type" };
    }
    if (hints.length) {
      return { level: "possible", kind: "banned", card: null, banned: hints[0], why: "the wording points to a banned type" };
    }
    if (seen && seen.key !== "drop_side_crib") {
      return { level: "possible", kind: "banned", card: null, banned: seen, why: "the photo looks like a banned type" };
    }
    return none;
  }

  // shared/notice.mjs
  var names = (list) => Array.isArray(list) ? list.map((x) => x && x.Name).filter(Boolean).join("; ") : "";
  function noticeFromCpsc(r) {
    return {
      id: String(r.RecallNumber || ""),
      date: String(r.RecallDate || "").slice(0, 10),
      title: r.Title || "",
      product: names(r.Products),
      units: r.Products && r.Products[0] && r.Products[0].NumberOfUnits || "",
      description: r.Description || "",
      hazard: names(r.Hazards),
      remedy: names(r.Remedies),
      soldAt: names(r.Retailers),
      upcs: (r.ProductUPCs || []).map((u) => u && u.UPC).filter(Boolean).slice(0, 12),
      // Product photos first; label close-ups ("label", "tag", "model number") are useful but show less of the product.
      images: (r.Images || []).map((i) => i && i.URL).filter(Boolean).sort((a, b) => /label|tag|model|date|code/i.test(a) - /label|tag|model|date|code/i.test(b)),
      url: r.URL || ""
    };
  }
  function noticeFromCard(c) {
    return {
      id: String(c.id || ""),
      date: c.date || "",
      title: c.title || c.product || "",
      product: c.product || "",
      units: "",
      description: [
        c.all ? "Every unit of this product is recalled." : "",
        c.tell ? `Which units are recalled: ${c.tell}` : "",
        c.from && c.to ? `Sold ${c.from === c.to ? `in ${c.from}` : `from ${c.from} to ${c.to}`}.` : "",
        c.codes && c.codes.length ? `Model numbers in the notice: ${c.codes.join(", ")}${c.more ? ", and others" : ""}.` : "",
        "(The full notice could not be fetched; this is the short record kept on the device.)"
      ].filter(Boolean).join(" "),
      hazard: c.hazard || "",
      remedy: "",
      soldAt: "",
      upcs: [],
      images: c.image ? [c.image] : [],
      url: c.url || "",
      fromCard: true
    };
  }
  function noticeForPrompt(n) {
    return [
      `Recall ${n.id}, ${n.date}: ${clip(n.title, 220)}`,
      n.product ? `Recalled product: ${clip(n.product, 160)}${n.units ? ` (${n.units} units)` : ""}` : "",
      `Description: ${clip(n.description, 1600)}`,
      n.hazard ? `Hazard: ${clip(n.hazard, 300)}` : "",
      n.soldAt ? `Sold at: ${clip(n.soldAt, 300)}` : "",
      n.upcs.length ? `UPCs: ${n.upcs.join(", ")}` : ""
    ].filter(Boolean).join("\n");
  }

  // shared/lookup.mjs
  var LOOKUP_TOOL = {
    name: "lookup_recalls",
    description: "Search the recall field guide kept on the shopper's device (every U.S. CPSC recall since 1973) for recalls of one brand and product that the listing's words do not name. Returns the matching recall notices, or none.",
    parameters: {
      type: "object",
      properties: {
        brand: { type: "string", description: 'The brand or maker, as a seller would type it, for example "Fisher-Price".' },
        product: { type: "string", description: `The product line and kind of product, for example "Rock 'n Play sleeper".` },
        model_number: { type: "string", description: "A model number the listing shows, if any." }
      },
      required: ["brand", "product"]
    }
  };
  var LOOKUP_SYSTEM = [
    "lookup_recalls: the device has already searched its field guide with the listing's own words; the RECALL NOTICE given, if any, is what that search found. Call lookup_recalls once, and only when you can name a brand or product line that the listing's words do not state: you recognise it in the photo, read it on the product or its label in the photo, or know the product by a name the seller did not use. Do not call it for a brand or product the title or description already names, and do not call it when you cannot name a brand.",
    "recall_id: when the product for sale is covered by a recall that lookup_recalls returned, or by the one under FOUND BY THE DEVICE, that recall's number, and answer matches_recall for that recall. Otherwise empty."
  ].join("\n");
  var str = (v) => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, 80);
  function lookupArgs(args) {
    const a = args && typeof args === "object" ? args : {};
    return { brand: str(a.brand), product: str(a.product), model_number: str(a.model_number) };
  }
  function lookupCards(index2, args, { exclude = "" } = {}) {
    const a = lookupArgs(args);
    if (!a.brand || !a.product) return [];
    const spellings = [.../* @__PURE__ */ new Set([a.brand, a.brand.replace(/\s+II$/i, "2"), a.brand.replace(/[\s-]+/g, "")])];
    for (const brand of spellings) {
      const found = shortlist(index2, `${brand} ${a.product} ${a.model_number}`, 4).filter((c) => c.card.id !== String(exclude)).slice(0, 2);
      if (found.length) return found;
    }
    return [];
  }
  var NO_BRAND = /^(none|n\/?a|unknown|no brand|not (visible|readable|shown)|unbranded|generic|brand|baby|infant|kids?)$/i;
  function deviceLookup(index2, listing, answer) {
    const brand = str(answer && answer.brand_seen);
    if (brand.length < 3 || NO_BRAND.test(brand)) return null;
    const said = new Set(uniqueTokens(`${listing.title} ${listing.description || ""}`));
    const read = new Set([brand, brand.replace(/\s+II$/i, "2"), brand.replace(/[\s-]+/g, "")].flatMap(uniqueTokens));
    if (!read.size || uniqueTokens(brand).every((t) => said.has(t))) return null;
    const found = lookupCards(index2, { brand, product: `${str(answer.product_kind)} ${str(listing.title)}` });
    const hit = found.find((c) => c.matched.brand && c.card.brands.some((b) => b.every((t) => read.has(t))));
    return hit ? { card: hit.card, strength: hit.strength, brand } : null;
  }
  function applyDeviceLookup(index2, listing, answer, candidate, device) {
    if (candidate || !answer || device.kind === "recall" || /part or a toy/.test(device.why || "")) return { device, seen: null };
    const hit = deviceLookup(index2, listing, answer);
    if (!hit) return { device, seen: null };
    return { device: { ...device, askCloud: true, seen: hit.card }, seen: { brand: hit.brand, id: hit.card.id } };
  }
  function lookupResponse(candidates, notices = []) {
    if (!candidates.length) return { recalls: [], note: "The field guide has no recall for that brand and product. Answer from the listing alone." };
    return {
      recalls: candidates.map(({ card, strength }, i) => ({
        recall_id: card.id,
        matched_by: { code: "a model number", line: "the product line", brand: "the brand and kind of product" }[strength],
        which_units: clip(card.tell || "", 300),
        every_unit_recalled: !!card.all,
        notice: notices[i] ? noticeForPrompt(notices[i]) : `Recall ${card.id}, ${card.date}: ${clip(card.title || card.product, 220)}${card.hazard ? `
Hazard: ${clip(card.hazard, 300)}` : ""}`
      }))
    };
  }

  // shared/confirm.mjs
  var BANNED_KEYS = BANNED_TYPES.map((t) => t.key);
  var CONFIRM_SYSTEM = [
    "You check one secondhand listing against a U.S. government (CPSC) recall notice and a short list of infant product types that may no longer be sold.",
    "You get the listing (title, price, maybe a description, and its photo) and, when there is one, the recall notice text and a photo of the recalled product.",
    "Answer only from what the listing shows. Never say a listing is safe.",
    'what_is_for_sale: "the_product" when it sells a whole product; "part_or_accessory" for a spare piece of a larger product (power adapter, replacement cover or seat pad, manual, mobile, cup holder); "toy_or_doll_version" for toys, doll furniture or miniatures; "unclear" otherwise.',
    '  Crib bumpers, crib bedding sets, loungers, nests and sleepers sold on their own are "the_product", not accessories.',
    'matches_recall: "yes" when the listing shows the same brand and the same product as the notice, and nothing in the listing (model, version, colour, date) places it outside what the notice recalls.',
    '  "no" when the listing is clearly a different product: another brand, another kind of product, or a model or version the notice does not include.',
    '  "cannot_tell" when brand and kind match but the listing does not show enough (model number, manufacture date, version) to know whether it is one of the recalled units.',
    '  "no_recall_given" when no recall notice is given.',
    'banned_type: one of the listed types only when the listing clearly is that kind of product, otherwise "none".',
    "evidence: one short sentence naming what in the listing decided your answer.",
    `check_before_buying: one short sentence telling a buyer what to look at or ask the seller to settle it, in the notice's own terms (which models or dates are recalled, where the label is, whether a set includes a padded bumper). Empty when matches_recall is "no" and banned_type is "none".`,
    "where: a box around the one thing in the listing photo that decided your answer (the padded bumper among the bedding, the lounger, the recalled product), as [ymin, xmin, ymax, xmax] with each number from 0 to 1000. An empty list when you are flagging nothing, when there is no listing photo, or when the thing is not visible in it.",
    'Do not state legal conclusions or give orders: never write "banned", "illegal", "prohibited" or "do not buy". The app adds its own wording about the rules.'
  ].join("\n");
  var CONFIRM_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["what_is_for_sale", "matches_recall", "banned_type", "evidence", "check_before_buying", "where"],
    properties: {
      what_is_for_sale: { type: "string", enum: ["the_product", "part_or_accessory", "toy_or_doll_version", "unclear"] },
      matches_recall: { type: "string", enum: ["yes", "no", "cannot_tell", "no_recall_given"] },
      banned_type: { type: "string", enum: ["none", ...BANNED_KEYS] },
      evidence: { type: "string" },
      check_before_buying: { type: "string" },
      where: { type: "array", items: { type: "integer" } }
    }
  };
  var CONFIRM_SYSTEM_LOOKUP = `${CONFIRM_SYSTEM}
${LOOKUP_SYSTEM}`;
  var CONFIRM_SCHEMA_LOOKUP = {
    ...CONFIRM_SCHEMA,
    required: [...CONFIRM_SCHEMA.required, "recall_id"],
    properties: { ...CONFIRM_SCHEMA.properties, recall_id: { type: "string" } }
  };
  function capForStandIn(decision) {
    return decision && decision.kind === "recall" && decision.level === "likely" ? { ...decision, level: "possible", why: "matched against the short record on the device; the full recall notice could not be fetched" } : decision;
  }
  function boxFrom(where) {
    if (!Array.isArray(where) || where.length !== 4 || where.some((n) => !Number.isFinite(n))) return null;
    const [y0, x0, y1, x1] = where.map((n) => Math.min(1e3, Math.max(0, n)) / 1e3);
    const w = x1 - x0, h = y1 - y0;
    if (w < 0.04 || h < 0.04 || w * h > 0.7) return null;
    return { x: +x0.toFixed(3), y: +y0.toFixed(3), w: +w.toFixed(3), h: +h.toFixed(3) };
  }
  function confirmParts({ listing, notice, listingPhoto, recallPhoto, seen = null }) {
    const parts = [[
      "LISTING",
      `Title: ${clip(listing.title, 200)}`,
      listing.price ? `Price: ${listing.price}` : "",
      listing.description ? `Description: ${clip(listing.description, 1200)}` : "",
      listingPhoto ? "Listing photo:" : "No listing photo."
    ].filter(Boolean).join("\n")];
    if (listingPhoto) parts.push(listingPhoto);
    parts.push(notice ? ["", "RECALL NOTICE", noticeForPrompt(notice), recallPhoto ? "Photo of the recalled product, from the notice:" : ""].filter(Boolean).join("\n") : "\nRECALL NOTICE\n(none given)");
    if (notice && recallPhoto) parts.push(recallPhoto);
    if (seen && seen.notice) {
      parts.push([
        "",
        "FOUND BY THE DEVICE (unverified)",
        `The listing's words name no brand. A small model on the device looked at the photo and gave the brand "${clip(seen.brand, 60)}", and the device's field guide has the recall below for that brand and kind of product. The reading may be wrong: small models guess a brand from a product's shape.`,
        `If you can see that brand in the photo, or recognise the product for sale as the one in this notice, answer recall_id "${seen.id}" and matches_recall for it. If it is another product that you can name, call lookup_recalls for that product. Otherwise leave recall_id empty.`,
        `recall_id: ${seen.id}`,
        noticeForPrompt(seen.notice),
        !notice && recallPhoto ? "Photo of the recalled product, from this notice:" : ""
      ].filter(Boolean).join("\n"));
      if (!notice && recallPhoto) parts.push(recallPhoto);
    }
    parts.push(["", "BANNED TYPES", ...BANNED_TYPES.map((t) => `- ${t.key}: ${t.looksLike}`)].join("\n"));
    return parts;
  }
  function decideFinal(device, cloud, hints, lookedUp = []) {
    const r = decideWithCloud(device, cloud, hints, lookedUp);
    if (cloud && r.level === "none" && device.kind === "recall" && device.strength === "code" && device.card && !device.seen) {
      return { ...r, level: "possible", kind: "recall", card: device.card, why: "the listing gives a model number this recall lists; the cloud check did not confirm it, so check the label" };
    }
    return r;
  }
  function decideWithCloud(device, cloud, hints, lookedUp) {
    if (!cloud) {
      const { seen, ...rest } = device;
      return { ...rest, confirmed: false };
    }
    const base2 = { kind: null, card: null, banned: null, confirmed: true, evidence: cloud.evidence || "", check: cloud.check_before_buying || "", where: boxFrom(cloud.where) };
    if (cloud.what_is_for_sale === "toy_or_doll_version" || cloud.what_is_for_sale === "part_or_accessory" && (cloud.banned_type === "none" || device.kind === "recall")) {
      return { ...base2, level: "none", why: "the listing is a part or a toy version, not the product" };
    }
    const agrees = cloud.matches_recall === "yes" || cloud.matches_recall === "cannot_tell";
    const pool = device.seen ? [...lookedUp, device.seen] : lookedUp;
    const said = String(cloud.recall_id || "").trim();
    const numbers = said.split(/[^A-Za-z0-9-]+/).filter(Boolean);
    const hit = said ? pool.find((c) => c.id === said) || pool.find((c) => numbers.includes(c.id)) : null;
    const found = agrees ? hit : null;
    const wordsCard = device.kind === "recall" && device.card && !device.seen ? device.card : null;
    if (wordsCard && !hit) {
      if (cloud.matches_recall === "yes") {
        return { ...base2, level: "likely", kind: "recall", card: wordsCard, why: "matches the recalled product in the notice" };
      }
      if (cloud.matches_recall === "cannot_tell") {
        return { ...base2, level: "possible", kind: "recall", card: wordsCard, why: "same brand and kind as a recalled product; the listing does not show which model" };
      }
    }
    if (wordsCard && hit && agrees) {
      return { ...base2, level: "possible", kind: "recall", card: wordsCard, alsoRecall: hit, why: "the listing's words match one recall; the cloud named another product and the field guide on the device had a recall for it too" };
    }
    const cloudBanned = BANNED_TYPES.find((t) => t.key === cloud.banned_type) || null;
    const deviceBanned = device.kind === "banned" ? device.banned : null;
    if (cloudBanned && (hints.length || deviceBanned)) {
      return { ...base2, level: "likely", kind: "banned", banned: hints[0] || cloudBanned, why: "both models see a product type that may no longer be sold", ...found ? { alsoRecall: found } : {} };
    }
    if (found) {
      return { ...base2, level: "possible", kind: "recall", card: found, lookedUp: true, why: device.seen && found.id === device.seen.id ? "a brand was read in the photo on the device; its field guide had a recall for that brand and kind of product; the cloud saw the same product; the listing's words do not name it" : "the cloud named the product from the photo or the description; the field guide on the device had a recall for it; the listing itself does not name it" };
    }
    if (hints.length) {
      return { ...base2, level: "possible", kind: "banned", banned: hints[0], why: "the wording names a product type that may no longer be sold; the photo did not confirm it" };
    }
    if (cloudBanned && device.askCloud && device.maybe && cloudBanned.key === device.maybe.key) {
      return { ...base2, level: "possible", kind: "banned", banned: cloudBanned, why: "the photo appears to include a product type that may no longer be sold" };
    }
    if (cloudBanned && device.secondOpinion) {
      return { ...base2, level: "possible", kind: "banned", banned: cloudBanned, why: "the photo looks like a product type that may no longer be sold" };
    }
    return { ...base2, level: "none", why: "the cloud check did not confirm the flag" };
  }

  // shared/i18n.mjs
  var lang = "en";
  try {
    if (typeof navigator !== "undefined" && /^es\b/i.test(navigator.language || "")) lang = "es";
  } catch {
  }
  var getLang = () => lang;
  function setLang(l) {
    lang = l === "es" ? "es" : "en";
  }
  var tr = (en, es) => lang === "es" && es ? es : en;
  var MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function monthYearOf(iso) {
    const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    const i = Number(m[2]) - 1;
    return lang === "es" ? `${MONTHS_ES[i]} de ${m[1]}` : `${MONTHS_EN[i]} ${m[1]}`;
  }

  // shared/present.mjs
  var SAFE_SLEEP_URL = "https://www.cpsc.gov/SafeSleep";
  var TYPE_COPY_EN = {
    inclined_sleeper: {
      name: "Inclined infant sleeper",
      short: "inclined sleeper",
      risk: "Selling an inclined infant sleeper has been against federal law since November 2022. CPSC says products with an incline over 10\xB0 should never be used for infant sleep; about 100 deaths were reported in one recalled model alone.",
      advice: "Never use it for sleep. Many inclined sleepers are also recalled, so ask for the brand and model.",
      ask: "Hi, before I buy: what brand and model is this, and what is the manufacture date on its label?"
    },
    crib_bumper: {
      name: "Padded crib bumper",
      short: "crib bumper",
      risk: "Selling a padded crib bumper has been against federal law since November 2022. CPSC lists bumpers among the soft items that can suffocate a baby; its advice is nothing but a fitted sheet in a crib.",
      advice: "Mesh liners aren't covered by the sales ban, but safe-sleep advice is still nothing in a crib but a fitted sheet, so you don't need either. Ask which this is before you buy.",
      ask: "Hi, before I buy: is this a padded bumper or a thin mesh liner? Could you send a photo of the label?"
    },
    in_bed_sleeper: {
      name: "Infant lounger or nest",
      short: "lounger",
      risk: "Many young babies can't lift their heads to pull away from soft padding. CPSC says these are never for sleep, eBay and Facebook Marketplace don't allow them, and many have been recalled.",
      advice: "Never use it for sleep, not even for a nap. Several loungers have been recalled, so ask for the brand and model.",
      ask: "Hi, before I buy: what brand and model is this? Could you send a photo of the label?"
    },
    drop_side_crib: {
      name: "Drop-side crib",
      short: "drop-side crib",
      risk: "Drop-side cribs don't meet the federal crib standard in force since June 2011, and CPSC says older cribs very likely can't be legally sold.",
      advice: "Ask whether a side of the crib slides down, and for the manufacture date on its label.",
      ask: "Hi, before I buy: does one side of the crib slide down? What is the manufacture date on its label?"
    }
  };
  var TYPE_COPY_ES = {
    inclined_sleeper: {
      name: "Dormidor inclinado para beb\xE9",
      short: "dormidor inclinado",
      a: "un dormidor inclinado para beb\xE9",
      risk: "Vender un dormidor inclinado para beb\xE9 es ilegal en EE. UU. desde noviembre de 2022. La CPSC dice que los productos con m\xE1s de 10\xB0 de inclinaci\xF3n nunca deben usarse para que duerma un beb\xE9; solo en un modelo retirado del mercado se reportaron unas 100 muertes.",
      advice: "Nunca lo use para dormir. Muchos dormidores inclinados tambi\xE9n han sido retirados del mercado, as\xED que pida la marca y el modelo.",
      ask: "Hola, antes de comprarlo: \xBFqu\xE9 marca y modelo es, y qu\xE9 fecha de fabricaci\xF3n dice la etiqueta?"
    },
    crib_bumper: {
      name: "Protector acolchado para cuna",
      short: "protector de cuna",
      a: "un protector acolchado para cuna",
      risk: "Vender un protector acolchado para cuna es ilegal en EE. UU. desde noviembre de 2022. La CPSC incluye los protectores entre los objetos blandos que pueden asfixiar a un beb\xE9; su consejo es no poner nada en la cuna m\xE1s que una s\xE1bana ajustable.",
      advice: "Los protectores de malla no est\xE1n prohibidos para la venta, pero el consejo de sue\xF1o seguro sigue siendo no poner nada en la cuna m\xE1s que una s\xE1bana ajustable, as\xED que no necesita ninguno. Pregunte cu\xE1l es antes de comprar.",
      ask: "Hola, antes de comprarlo: \xBFes un protector acolchado o uno de malla delgada? \xBFMe puede mandar una foto de la etiqueta?"
    },
    in_bed_sleeper: {
      name: "Nido o coj\xEDn para beb\xE9",
      short: "nido para beb\xE9",
      a: "un nido o coj\xEDn para beb\xE9",
      risk: "Muchos beb\xE9s peque\xF1os no pueden levantar la cabeza para apartarse del acolchado. La CPSC dice que estos nunca son para dormir, eBay y Facebook Marketplace no los permiten, y muchos han sido retirados del mercado.",
      advice: "Nunca lo use para dormir, ni siquiera para una siesta. Varios nidos han sido retirados del mercado, as\xED que pida la marca y el modelo.",
      ask: "Hola, antes de comprarlo: \xBFqu\xE9 marca y modelo es? \xBFMe puede mandar una foto de la etiqueta?"
    },
    drop_side_crib: {
      name: "Cuna de baranda corrediza",
      short: "cuna de baranda corrediza",
      a: "una cuna de baranda corrediza",
      risk: "Las cunas de baranda corrediza no cumplen la norma federal de cunas vigente desde junio de 2011, y la CPSC dice que las cunas m\xE1s antiguas muy probablemente no se pueden vender legalmente.",
      advice: "Pregunte si un lado de la cuna se desliza hacia abajo, y la fecha de fabricaci\xF3n de la etiqueta.",
      ask: "Hola, antes de comprarla: \xBFuno de los lados de la cuna se desliza hacia abajo? \xBFQu\xE9 fecha de fabricaci\xF3n dice la etiqueta?"
    }
  };
  var TYPE_COPY = new Proxy(TYPE_COPY_EN, {
    get: (en, k) => getLang() === "es" && TYPE_COPY_ES[k] ? TYPE_COPY_ES[k] : en[k]
  });
  function productName(product) {
    return clip(String(product || "").replace(/^all\s+(models\s+of\s+|units\s+of\s+)?/i, "").replace(/^the\s+/i, ""), 90);
  }
  function remedyText(remedy) {
    const s = String(remedy || "").trim();
    if (!/…$/.test(s)) return s;
    const body = s.slice(0, -1).trim();
    if (/[.!?]$/.test(body)) return body;
    const stop = body.search(/[.!?](?=\s+[A-Z][^.!?]*$)/);
    if (stop > 40) return body.slice(0, stop + 1);
    const words = body.replace(/\s*\S*$/, "").replace(/\s+https?:\S*$/i, "").replace(/(?:[\s,;:(]+(?:and|or|to|go|visit|at|for|the|a|an|of|with|by|on|in))*[\s,;:(]*$/i, "");
    return `${words}\u2026 (the notice has the rest)`;
  }
  function badgeText(r) {
    if (r.kind === "recall" && r.recall && r.recall.warning) return r.level === "likely" ? tr("CPSC warning", "Advertencia de la CPSC") : tr("Possible CPSC warning", "Posible advertencia de la CPSC");
    if (r.kind === "recall") return r.level === "likely" ? tr("Recalled product", "Retirado del mercado") : tr("Possible recall", "Posible retiro");
    if (r.kind === "banned") return r.level === "likely" ? (TYPE_COPY[r.banned.key] || {}).name || tr("Sleep risk", "Riesgo al dormir") : tr(`Possible ${(TYPE_COPY[r.banned.key] || {}).short || "sleep risk"}`, `Posible ${(TYPE_COPY[r.banned.key] || {}).short || "riesgo al dormir"}`);
    return "";
  }
  function verdictLine(r) {
    const p = r.recall ? productName(r.recall.product) : "", when = r.recall ? monthYear(r.recall.date) : "";
    if (r.kind === "recall" && r.lookedUp) {
      return tr(
        `Looks like the ${p}, ${r.recall.warning ? "which CPSC warned people to stop using in" : "recalled"} ${when}. The listing's words don't name this product, so check the brand before you buy.`,
        `Parece ser \xAB${p}\xBB, ${r.recall.warning ? "que la CPSC pidi\xF3 dejar de usar en" : "retirado del mercado en"} ${when}. El anuncio no nombra este producto, as\xED que revise la marca antes de comprar.`
      );
    }
    if (r.kind === "recall" && r.recall.warning) {
      return r.level === "likely" ? tr(
        `Looks like the ${p}. CPSC warned people to stop using them in ${when}; the seller behind them did not recall them.`,
        `Parece ser \xAB${p}\xBB. La CPSC pidi\xF3 dejar de usarlos en ${when}; quien los vend\xEDa no los retir\xF3 del mercado.`
      ) : tr(`Same brand and kind as the ${p}, which CPSC warned people to stop using in ${when}.`, `Misma marca y tipo que \xAB${p}\xBB, que la CPSC pidi\xF3 dejar de usar en ${when}.`);
    }
    if (r.kind === "recall") {
      return r.level === "likely" ? tr(`Looks like the ${p}, recalled ${when}.`, `Parece ser \xAB${p}\xBB, retirado del mercado en ${when}.`) : tr(`Same brand and kind as the ${p}, recalled ${when}. The listing doesn't show which model.`, `Misma marca y tipo que \xAB${p}\xBB, retirado del mercado en ${when}. El anuncio no muestra el modelo.`);
    }
    if (r.kind === "banned") {
      if (getLang() === "es") {
        const a2 = (TYPE_COPY[r.banned.key] || {}).a || "un producto de riesgo para dormir";
        return r.level === "likely" ? `Parece ser ${a2}.` : `Puede ser o incluir ${a2}.`;
      }
      const name = (TYPE_COPY[r.banned.key] || { name: "infant sleep product" }).name.toLowerCase();
      const a = /^[aeiou]/.test(name) ? "an" : "a";
      return r.level === "likely" ? `This looks like ${a} ${name}.` : `This may be or include ${a} ${name}.`;
    }
    return "";
  }
  function actionLine(r) {
    if (r.kind === "recall" && r.lookedUp) {
      return r.recall && r.recall.all ? tr("Don't buy it until you know it isn't this product: every unit of it is recalled.", "No lo compre hasta saber que no es este producto: todas sus unidades fueron retiradas del mercado.") : tr("Don't buy it until the seller shows the brand and the label, and it isn't one of the recalled units.", "No lo compre hasta que el vendedor muestre la marca y la etiqueta, y no sea una de las unidades retiradas.");
    }
    if (r.kind === "recall" && r.recall && r.recall.warning) {
      return r.level === "possible" ? tr("Don't buy it until you know it isn't the product CPSC warned about.", "No lo compre hasta saber que no es el producto sobre el que advirti\xF3 la CPSC.") : tr("Don't buy it. CPSC has told people to stop using this product.", "No lo compre. La CPSC pidi\xF3 dejar de usar este producto.");
    }
    if (r.kind === "recall") {
      if (r.level === "possible") return tr("Don't buy it until the seller's label shows it isn't one of the recalled units.", "No lo compre hasta que la etiqueta muestre que no es una de las unidades retiradas.");
      return r.recall && r.recall.all ? tr("Don't buy it. Every unit of this product is recalled.", "No lo compre. Todas las unidades de este producto fueron retiradas del mercado.") : tr("Don't buy it unless the seller's label shows it isn't one of the recalled units.", "No lo compre a menos que la etiqueta muestre que no es una de las unidades retiradas.");
    }
    if (r.kind === "banned") {
      if (r.level === "possible") return r.banned && r.banned.key === "in_bed_sleeper" ? tr("Ask the seller what it is. If it's a soft padded nest or cushion for a baby to lie in, skip it, whatever it's called.", "Preg\xFAntele al vendedor qu\xE9 es. Si es un nido o coj\xEDn acolchado para acostar a un beb\xE9, no lo compre, se llame como se llame.") : tr("Ask the seller what it is before you buy.", "Preg\xFAntele al vendedor qu\xE9 es antes de comprarlo.");
      return {
        crib_bumper: tr("Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.", "No lo compre. El consejo de la CPSC: nada en la cuna m\xE1s que una s\xE1bana ajustable."),
        inclined_sleeper: tr("Skip this one, and never use an inclined sleeper for sleep.", "No lo compre, y nunca use un dormidor inclinado para dormir."),
        in_bed_sleeper: tr("Skip this one. Babies fall asleep in loungers, and infants have died in them, even during naps.", "No lo compre. Los beb\xE9s se duermen en los nidos, y algunos han muerto en ellos, incluso durante siestas."),
        drop_side_crib: tr("Skip this one: drop-side cribs don't meet today's crib standard.", "No la compre: las cunas de baranda corrediza no cumplen la norma de cunas actual.")
      }[r.banned && r.banned.key] || tr("Never use it for sleep.", "Nunca lo use para dormir.");
    }
    return "";
  }
  function noMatchLine(count, since, input = "listing") {
    const what = input === "typed" ? tr("the words you typed", "las palabras que escribi\xF3") : tr("what the listing shows", "lo que muestra el anuncio");
    return tr(
      `No recall found for what we could read. That doesn't mean it's safe. We searched ${count} recall notices since ${since}, and can only match ${what}.`,
      `No encontramos un retiro del mercado para lo que pudimos leer. Eso no quiere decir que sea seguro. Buscamos en ${count} avisos de retiro desde ${since}, y solo podemos comparar ${what}.`
    );
  }
  var SLEEP_PLACE = /\b(cribs?|cots?|bassinets?|cradles?|moses|play\s*yards?|playards?|pack\s*'?n\s*'?play|playpens?|bed(ding)?|mattress(es)?|sleep\w*|co-?sleep\w*|cunas?|moises|corral(ito)?s?)\b/i;
  var SITTING = /\b(swings?|bouncers?|rockers?|car\s*seats?|infant\s*seats?|carriers?|slings?|strollers?|columpios?|mecedor(a|es)?)\b/i;
  var LOUNGE = /\b(loungers?|nests?|nids?|pods?|pillows?|cushions?|positioners?|docks?|inclined|nido|almohadas?|cojin(es)?)\b/i;
  var BEDDING_SET = /\b(bedding|quilts?|comforters?|blankets?|crib\s*sets?)\b/i;
  var SLEEP_PART = /\b(pads?|mattress(es)?|inserts?|sheets?)\b/i;
  var CAR_SEAT = /\b(car\s*seats?|infant\s*seats?|booster\s*seats?|boosters?|silla\s+(de\s+)?(auto|carro))\b/i;
  var carSeatLine = () => tr(
    "Car seat recalls are kept by NHTSA, not CPSC, so they aren't checked here. Look up the seat's model and date at nhtsa.gov/recalls.",
    "Los retiros de asientos de auto los lleva la NHTSA, no la CPSC, as\xED que aqu\xED no se revisan. Busque el modelo y la fecha del asiento en nhtsa.gov/recalls."
  );
  var abc = () => tr(
    "Every sleep: baby alone, on their back, in a crib, bassinet or play yard with only a fitted sheet.",
    "Cada vez que duerma, de d\xEDa o de noche: el beb\xE9 solito, boca arriba, en una cuna, mois\xE9s o corral, con nada m\xE1s que una s\xE1bana ajustable."
  );
  function sleepLine(text, part = false, r = null) {
    const t = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const key = r && r.kind === "banned" && r.banned ? r.banned.key : "";
    if (part && SLEEP_PART.test(t) && SLEEP_PLACE.test(t)) {
      return tr(
        "This looks like a part, so a recall may not cover it. Use only the mattress or pad that came with the crib, bassinet or play yard: extra padding can suffocate a baby.",
        "Parece ser una pieza, as\xED que un retiro puede no cubrirla. Use solo el colch\xF3n o la almohadilla que vino con la cuna, el mois\xE9s o el corral: el acolchado extra puede asfixiar a un beb\xE9."
      );
    }
    if (part) return "";
    if (key === "inclined_sleeper" || /\b(inclined|rock\s*'?n\s*'?play)\b/i.test(t)) return tr(`Babies should sleep flat, never in an inclined sleeper, recalled or not. ${abc()}`, `Los beb\xE9s deben dormir sobre una superficie plana, nunca en un dormidor inclinado, est\xE9 retirado del mercado o no. ${abc()}`);
    if (key === "in_bed_sleeper" || LOUNGE.test(t) && /\b(baby|babies|infant|newborn|bebes?|bebés?)\b/i.test(t)) {
      return tr(
        "Not for sleep, recalled or not. If your baby gets sleepy, move them to their crib or bassinet, on their back.",
        "No es para dormir, est\xE9 retirado del mercado o no. Si su beb\xE9 se duerme, p\xE1selo a su cuna o mois\xE9s, boca arriba."
      );
    }
    if (key === "crib_bumper" || BEDDING_SET.test(t)) return tr(`Quilts, comforters, pillows and bumpers from crib sets are for decoration only. ${abc()}`, `Las colchas, edredones, almohadas y protectores de los juegos de cuna son solo de decoraci\xF3n. ${abc()}`);
    if (SLEEP_PLACE.test(t)) return abc();
    if (SITTING.test(t)) return tr("Not for sleep. If your baby falls asleep in it, move them to their crib or bassinet, on their back.", "No es para dormir. Si su beb\xE9 se queda dormido ah\xED, p\xE1selo a su cuna o mois\xE9s, boca arriba.");
    return "";
  }
  function oldCribLine(text) {
    text = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return /\b(cribs?|cunas?)\b/i.test(text) && !/\b(mini|portable|travel)\b/i.test(text) ? tr(
      "A crib made before June 28, 2011 likely doesn't meet today's crib standard. Check the date on its label, and that it has every part.",
      "Una cuna fabricada antes del 28 de junio de 2011 probablemente no cumple la norma de cunas actual. Revise la fecha en la etiqueta y que tenga todas sus piezas."
    ) : "";
  }
  var FILLER = new Set(`a an the this that these those one ones it its is are was be my your our their his her i me we you
  and or but for with of to in on at by from as so if not no yes ok okay hi hello hey thanks thank please
  used new like good great nice excellent perfect condition works working clean cheap free price priced obo firm cash
  pickup pick up only must go sale selling sell sold item items thing things stuff listing post here there what how much
  any some all very really just still check see look this one`.split(/\s+/));
  function namesNothing(text) {
    const words = (String(text || "").toLowerCase().match(/[a-z][a-z'&+-]*/g) || []).map((w) => w.replace(/['&+-]+$/, "")).filter((w) => w.length > 1 && !FILLER.has(w));
    return words.length === 0;
  }
  var grouped = (n) => String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  function noMatchView(r, listing, { input = "listing", audience = "buyer", count = 0, since = "" } = {}) {
    const title = listing && listing.title || "";
    const partOrToy = r.why === "part or toy" || /part or a toy/.test(r.why || "");
    const vague = !partOrToy && input === "typed" && namesNothing(title);
    const owner = audience === "owner" ? ownerView(r) : null;
    const sleep = sleepLine(title, partOrToy);
    const safeSleep = !!sleep || INFANT.test(title) || INFANT_ES.test(title);
    if (vague) {
      return {
        vague,
        safeSleep: false,
        pill: tr("Nothing to match", "Nada que comparar"),
        line: tr(
          "We couldn't tell what the product is. Type its brand and name, like \u201CGraco Pack 'n Play\u201D, or check a screenshot of the listing.",
          "No pudimos saber qu\xE9 producto es. Escriba la marca y el nombre, como \u201CGraco Pack 'n Play\u201D, o revise una captura de pantalla del anuncio."
        ),
        heading: tr("What helps", "Qu\xE9 ayuda"),
        lines: [tr("The brand and the product name are enough. A model number, if you have one, settles most recalls.", "La marca y el nombre del producto bastan. Un n\xFAmero de modelo, si lo tiene, resuelve la mayor\xEDa de los retiros.")]
      };
    }
    const line = partOrToy ? tr("This looks like a part or a toy version, not the product itself.", "Parece ser una pieza o una versi\xF3n de juguete, no el producto en s\xED.") : owner ? owner.action : noMatchLine(grouped(count), monthYear(since || "1973-01-01"), input);
    const plain = String(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const extra = [sleep, CAR_SEAT.test(plain) ? carSeatLine() : "", oldCribLine(title)].filter(Boolean);
    const pill = tr("No match found", "Sin coincidencias");
    if (owner) return { vague, safeSleep, pill, line, heading: owner.heading, lines: [...owner.lines, ...extra] };
    return {
      vague,
      safeSleep,
      pill,
      line,
      heading: tr("Before you buy", "Antes de comprar"),
      lines: [
        tr(
          "A listing rarely shows the model number, and many recalls cover only some models. Ask the seller for a photo of the label, then search the model number on SaferProducts.gov.",
          "Un anuncio rara vez muestra el n\xFAmero de modelo, y muchos retiros cubren solo algunos modelos. P\xEDdale al vendedor una foto de la etiqueta y busque el n\xFAmero de modelo en SaferProducts.gov."
        ),
        ...extra
      ].filter(Boolean)
    };
  }
  function sellerQuestion(r) {
    const es = getLang() === "es" && INFANT_ES.test(`${r.listing && r.listing.title || ""}`);
    const q = (en, sp) => es ? sp : en;
    const p = r.recall ? productName(r.recall.product) : "";
    if (r.kind === "recall" && r.lookedUp) {
      return q(
        `Hi, before I buy: what brand and model is this? Could you send a photo of its label? It looks like a product CPSC ${r.recall.warning ? "warned about" : "recalled"} (${r.recall.warning ? "warning" : "recall"} ${r.recall.number}, ${p}).`,
        `Hola, antes de comprarlo: \xBFqu\xE9 marca y modelo es? \xBFMe puede mandar una foto de la etiqueta? Se parece a un producto que la CPSC ${r.recall.warning ? "pidi\xF3 dejar de usar" : "retir\xF3 del mercado"} (${r.recall.warning ? "advertencia" : "retiro"} ${r.recall.number}, ${p}).`
      );
    }
    if (r.kind === "recall" && r.recall.warning) {
      return q(
        `Hi, before I buy: what brand is this, and could you send a photo of its tag or label? CPSC has warned people to stop using a product like it (warning ${r.recall.number}, ${p}).`,
        `Hola, antes de comprarlo: \xBFqu\xE9 marca es, y me puede mandar una foto de la etiqueta? La CPSC pidi\xF3 dejar de usar un producto como este (advertencia ${r.recall.number}, ${p}).`
      );
    }
    if (r.kind === "recall") {
      return q(
        `Hi, before I buy: could you send a photo of the label showing the model number and manufacture date? I'd like to check it against a CPSC recall (${r.recall.id}, ${p}).`,
        `Hola, antes de comprarlo: \xBFme puede mandar una foto de la etiqueta con el n\xFAmero de modelo y la fecha de fabricaci\xF3n? Quiero compararla con un retiro de la CPSC (${r.recall.id}, ${p}).`
      );
    }
    if (r.kind === "banned" && r.banned.key === "crib_bumper" && r.level === "possible") {
      return q(
        "Hi, before I buy: does this set include padded crib bumpers? Could you list every piece that comes with it?",
        "Hola, antes de comprarlo: \xBFeste juego incluye protectores acolchados para cuna? \xBFMe puede decir todas las piezas que trae?"
      );
    }
    if (r.kind === "banned") return es ? (TYPE_COPY_ES[r.banned.key] || {}).ask || "" : (TYPE_COPY_EN[r.banned.key] || {}).ask || "";
    return "";
  }
  var OWNER_TYPE_EN = {
    inclined_sleeper: "Selling an inclined infant sleeper has been against federal law since November 2022, whatever its age. CPSC says never to use one for sleep.",
    crib_bumper: "Selling a padded crib bumper has been against federal law since November 2022, whatever its age. CPSC's advice is nothing in a crib but a fitted sheet.",
    in_bed_sleeper: "eBay and Facebook Marketplace don't allow loungers and nests, many have been recalled, and CPSC says never to use one for sleep.",
    drop_side_crib: "CPSC says cribs made before June 28, 2011, drop-sides included, are very likely illegal to sell."
  };
  var OWNER_ADVICE_EN = {
    inclined_sleeper: "Many inclined sleepers are also recalled: look for the brand and model on its label.",
    crib_bumper: "Mesh liners aren't covered by the sales ban, but safe-sleep advice is still nothing in a crib but a fitted sheet. Check which one yours is.",
    in_bed_sleeper: "Several loungers have been recalled: look for the brand and model on its label.",
    drop_side_crib: "Check whether a side of the crib slides down, and the manufacture date on its label."
  };
  var OWNER_TYPE_ES = {
    inclined_sleeper: "Vender un dormidor inclinado para beb\xE9 es ilegal en EE. UU. desde noviembre de 2022, sin importar su antig\xFCedad. La CPSC dice que nunca se use para dormir.",
    crib_bumper: "Vender un protector acolchado para cuna es ilegal en EE. UU. desde noviembre de 2022, sin importar su antig\xFCedad. El consejo de la CPSC es no poner nada en la cuna m\xE1s que una s\xE1bana ajustable.",
    in_bed_sleeper: "eBay y Facebook Marketplace no permiten nidos ni cojines para beb\xE9, muchos han sido retirados del mercado, y la CPSC dice que nunca se usen para dormir.",
    drop_side_crib: "La CPSC dice que las cunas fabricadas antes del 28 de junio de 2011, incluidas las de baranda corrediza, muy probablemente no se pueden vender legalmente."
  };
  var OWNER_ADVICE_ES = {
    inclined_sleeper: "Muchos dormidores inclinados tambi\xE9n han sido retirados del mercado: busque la marca y el modelo en su etiqueta.",
    crib_bumper: "Los protectores de malla no est\xE1n prohibidos para la venta, pero el consejo de sue\xF1o seguro sigue siendo no poner nada en la cuna m\xE1s que una s\xE1bana ajustable. Revise cu\xE1l es el suyo.",
    in_bed_sleeper: "Varios nidos han sido retirados del mercado: busque la marca y el modelo en su etiqueta.",
    drop_side_crib: "Revise si un lado de la cuna se desliza hacia abajo, y la fecha de fabricaci\xF3n en la etiqueta."
  };
  var OWNER_TYPE = new Proxy(OWNER_TYPE_EN, { get: (en, k) => getLang() === "es" ? OWNER_TYPE_ES[k] : en[k] });
  var OWNER_ADVICE = new Proxy(OWNER_ADVICE_EN, { get: (en, k) => getLang() === "es" ? OWNER_ADVICE_ES[k] : en[k] });
  function ownerVerdict(r) {
    if (r.kind !== "recall" || !r.recall) return r.verdict || "";
    const product = productName(r.recall.product);
    const when = monthYear(r.recall.date);
    if (r.lookedUp) return tr(
      `Looks like the ${product}, ${r.recall.warning ? "which CPSC warned people to stop using in" : "recalled"} ${when}. Check the brand on yours.`,
      `Parece ser \xAB${product}\xBB, ${r.recall.warning ? "que la CPSC pidi\xF3 dejar de usar en" : "retirado del mercado en"} ${when}. Revise la marca del suyo.`
    );
    if (r.recall.warning) return r.verdict || "";
    return r.level === "likely" ? tr(`Looks like the ${product}, recalled ${when}.`, `Parece ser \xAB${product}\xBB, retirado del mercado en ${when}.`) : tr(`Same brand and kind as the ${product}, recalled ${when}. Its label shows which model you have.`, `Misma marca y tipo que \xAB${product}\xBB, retirado del mercado en ${when}. Su etiqueta muestra qu\xE9 modelo tiene.`);
  }
  function ownerView(r) {
    return { verdict: ownerVerdict(r), evidence: ownerWords(r.evidence), foundBy: String(r.foundBy || "").replace(/The listing's words/g, "The words you gave").replace(/Las palabras del anuncio/g, "Las palabras que usted dio"), ...ownerAdvice(r) };
  }
  function ownerWords(text) {
    const s = String(text || "").replace(/\bthe listing(?:['’]s)? (?:photo|image|picture)\b/gi, "your photo").replace(/\bthe seller['’]s (?:photo|image|picture)s?\b/gi, "your photo").replace(/\bthe listing(?:['’]s)? (?:title|description|text|words|wording)\b/gi, "what you entered").replace(/\bthe listing['’]s\b/gi, "its").replace(/\bthe (?:item|product) for sale\b/gi, "your item").replace(/\bthe listing\b/gi, "what you entered").replace(/\bthis listing\b/gi, "this item");
    return s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }
  function ownerAdvice(r) {
    const heading = tr("Before you sell it or give it away", "Antes de venderlo o regalarlo");
    if (r.kind === "recall" && r.recall) {
      const c = r.recall;
      const sure = r.level === "likely";
      const p = productName(c.product);
      if (c.warning) {
        return {
          heading,
          action: sure ? tr("Don't sell it or give it away. CPSC has told people to stop using this product.", "No lo venda ni lo regale. La CPSC pidi\xF3 dejar de usar este producto.") : tr("Check the brand before you sell it or give it away.", "Revise la marca antes de venderlo o regalarlo."),
          lines: [
            sure ? tr("Its seller did not recall it, so there is no refund to claim. CPSC warned the public itself.", "Quien lo vend\xEDa no lo retir\xF3 del mercado, as\xED que no hay reembolso que reclamar. La CPSC advirti\xF3 al p\xFAblico directamente.") : tr(`CPSC warned people to stop using the ${p}. If yours is that brand, don't pass it on.`, `La CPSC pidi\xF3 dejar de usar \xAB${p}\xBB. Si el suyo es de esa marca, no se lo pase a nadie.`),
            c.remedy ? tr(`CPSC says: ${c.remedy}`, `La CPSC dice: ${c.remedy}`) : ""
          ].filter(Boolean)
        };
      }
      if (!sure || r.lookedUp) {
        return {
          heading,
          action: r.lookedUp ? tr("Check the brand and the label before you sell it or give it away: it looks like a recalled product.", "Revise la marca y la etiqueta antes de venderlo o regalarlo: parece un producto retirado del mercado.") : tr("Check its label before you sell it or give it away.", "Revise su etiqueta antes de venderlo o regalarlo."),
          lines: [
            c.all ? tr(`Every unit of the ${p} is recalled. If that is what you have, don't pass it on.`, `Todas las unidades de \xAB${p}\xBB fueron retiradas del mercado. Si es lo que tiene, no se lo pase a nadie.`) : c.tell ? tr(`Which units are recalled: ${c.tell}`, `Qu\xE9 unidades fueron retiradas: ${c.tell}`) : tr(`Some ${p} are recalled. The notice says which.`, `Algunas unidades de \xAB${p}\xBB fueron retiradas. El aviso dice cu\xE1les.`),
            tr("CPSC says it is illegal to sell any recalled product.", "La CPSC dice que es ilegal vender cualquier producto retirado del mercado."),
            c.remedy ? tr(`If yours is recalled, the recall's remedy: ${c.remedy} The notice says how to claim it.`, `Si el suyo fue retirado, lo que ofrece el retiro: ${c.remedy} El aviso dice c\xF3mo reclamarlo.`) : ""
          ].filter(Boolean)
        };
      }
      return {
        heading,
        action: tr("Don't sell it or give it away: it looks like a recalled product.", "No lo venda ni lo regale: parece un producto retirado del mercado."),
        lines: [
          tr("Stop using it unless the recall's fix has already been done. CPSC says it is illegal to sell any recalled product.", "Deje de usarlo, a menos que ya se haya hecho la reparaci\xF3n del retiro. La CPSC dice que es ilegal vender cualquier producto retirado del mercado."),
          c.remedy ? tr(`The recall's remedy: ${c.remedy} The notice says how to claim it.`, `Lo que ofrece el retiro: ${c.remedy} El aviso dice c\xF3mo reclamarlo.`) : tr("The notice says what the maker offers and how to claim it.", "El aviso dice qu\xE9 ofrece el fabricante y c\xF3mo reclamarlo."),
          c.all ? "" : c.tell ? tr(`Which units are recalled: ${c.tell}`, `Qu\xE9 unidades fueron retiradas: ${c.tell}`) : ""
        ].filter(Boolean)
      };
    }
    if (r.kind === "banned" && r.banned) {
      const rule = OWNER_TYPE[r.banned.key] || "";
      return r.level === "likely" ? { heading, action: tr("Don't sell it or give it away.", "No lo venda ni lo regale."), lines: [rule, r.also ? tr(`It also looks like the ${productName(r.also.product)} (${r.also.warning ? "CPSC warning" : "recall"} ${r.also.number}): the notice says what its maker offers.`, `Tambi\xE9n parece ser \xAB${productName(r.also.product)}\xBB (${r.also.warning ? "advertencia de la CPSC" : "retiro"} ${r.also.number}): el aviso dice qu\xE9 ofrece su fabricante.`) : ""].filter(Boolean) } : { heading, action: tr("Check what it is before you sell it or give it away.", "Revise qu\xE9 es antes de venderlo o regalarlo."), lines: [OWNER_ADVICE[r.banned.key] || r.banned.advice, rule].filter(Boolean) };
    }
    return {
      heading,
      action: tr("No recall found for what we could read. That doesn't mean it's safe to pass on.", "No encontramos un retiro del mercado para lo que pudimos leer. Eso no quiere decir que sea seguro pas\xE1rselo a alguien."),
      lines: [tr("Many recalls cover only some models. Find the model number and date on its label and search them at SaferProducts.gov before you sell it or give it away.", "Muchos retiros cubren solo algunos modelos. Busque el n\xFAmero de modelo y la fecha en la etiqueta y b\xFAsquelos en SaferProducts.gov antes de venderlo o regalarlo.")]
    };
  }
  var SALE_RULE = {
    inclined_sleeper: "Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1310, inclined sleepers for infants may not be sold after November 12, 2022.",
    crib_bumper: "Under the Safe Sleep for Babies Act of 2021 (Pub. L. 117-126) and 16 CFR 1309, padded crib bumpers may not be sold after November 12, 2022.",
    drop_side_crib: "Full-size cribs sold since June 28, 2011 must meet the federal crib standard (16 CFR 1219), which drop-side designs do not meet."
  };
  function reportable(r) {
    if (r.level !== "likely") return false;
    if (r.kind === "recall") return !!r.recall && !r.recall.warning;
    return r.kind === "banned" && !!SALE_RULE[r.banned && r.banned.key];
  }
  function cpscReport(r, seen = /* @__PURE__ */ new Date()) {
    if (!reportable(r)) return "";
    const day = seen.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const what = r.kind === "recall" ? `It appears to be the ${productName(r.recall.product)}, recalled ${monthYear(r.recall.date)} (CPSC recall ${r.recall.id}). The listing does not say the recall remedy has been applied.` : `It appears to be ${/^[aeiou]/i.test(TYPE_COPY_EN[r.banned.key].name) ? "an" : "a"} ${TYPE_COPY_EN[r.banned.key].name.toLowerCase()}. ${SALE_RULE[r.banned.key]}`;
    const head = r.kind === "recall" ? "A recalled product listed for sale online." : "An infant sleep product listed for sale online.";
    const facts = [
      listingLink(r) ? `Listing: ${listingLink(r)}` : "Listing: see the attached screenshot.",
      `Title: ${r.listing.title}`,
      r.listing.price ? `Asking price: ${r.listing.price}` : "",
      `Seen on: ${day}`
    ].filter(Boolean).join("\n");
    const why = [what, r.confirmed && r.evidence ? `What the listing shows: ${r.evidence}` : ""].filter(Boolean).join("\n");
    return [head, facts, why].join("\n\n");
  }
  function listingLink(r) {
    let u;
    try {
      u = new URL(r.listing.url);
    } catch {
      return "";
    }
    if (u.protocol !== "https:") return "";
    if (/(^|\.)ebay\.com$/.test(u.hostname) && /^\d{9,}$/.test(String(r.id))) return `https://www.ebay.com/itm/${r.id}`;
    return `${u.origin}${u.pathname}`;
  }
  function sellerMessageUrl(r) {
    const link = listingLink(r);
    return link && /^https:\/\/www\.ebay\.com\/itm\//.test(link) ? `${link}?m2mOpen=1` : link;
  }
  function monthYear(isoDate) {
    const [y, m] = String(isoDate || "").split("-").map(Number);
    if (!y || !m) return tr("by CPSC", "por la CPSC");
    return monthYearOf(isoDate);
  }
  function present(listing, decision, how = {}) {
    const via = decision.alsoRecall || decision.lookedUp && decision.card || null;
    const asked = via ? (how.lookups || []).find((l) => l.found.includes(via.id)) : null;
    const askedFor = asked ? clip([asked.asked.brand, asked.asked.product].filter(Boolean).join(" "), 70) : "";
    const seenIt = via && !asked && how.seen && how.seen.id === via.id ? how.seen : null;
    const ledBy = seenIt ? tr(
      `${how.device ? "Gemini Nano, on this device," : "Gemini"} read \u201C${clip(seenIt.brand, 40)}\u201D in the photo and asked the recall field guide on this device, which had it.`,
      `${how.device ? "Gemini Nano, en este dispositivo," : "Gemini"} ley\xF3 \u201C${clip(seenIt.brand, 40)}\u201D en la foto y consult\xF3 la gu\xEDa de retiros de este dispositivo, que lo ten\xEDa.`
    ) : tr(
      `Gemini in the cloud named the product (${askedFor}) and asked the recall field guide on this device, which had it.`,
      `Gemini en la nube identific\xF3 el producto (${askedFor}) y consult\xF3 la gu\xEDa de retiros de este dispositivo, que lo ten\xEDa.`
    );
    const viaNumber = via ? `${via.warning ? tr("warning", "advertencia") : tr("recall", "retiro")} ${via.id.replace(/^W/, "")}` : "";
    const base2 = {
      id: listing.id,
      listing: { title: listing.title, price: listing.price || "", image: listing.image || "", url: listing.url || "" },
      level: decision.level,
      kind: decision.level === "none" ? null : decision.kind,
      why: decision.why || "",
      check: decision.check || "",
      evidence: decision.evidence || "",
      confirmed: !!decision.confirmed,
      // Where in the listing photo the cloud check saw it: { x, y, w, h } as fractions of the photo, or null.
      where: decision.level !== "none" && decision.where || null,
      how: {
        device: !!how.device,
        deviceLevel: how.deviceLevel || (how.words ? "words" : ""),
        // The built-in model's reading of "which units", and the cloud's answer on the recall, for comparing the two.
        candidate: how.candidate || "",
        // the recall the word rules proposed, and how strongly
        deviceUnit: how.deviceUnit || "",
        cloudMatch: how.cloud && how.cloud.answer && how.cloud.answer.matches_recall || "",
        judgedInCloud: !!how.judgedInCloud,
        deviceError: how.deviceError || "",
        cloudModel: how.cloud && how.cloud.model || "",
        cloudError: how.cloudError || "",
        // What the cloud asked the device's field guide, and the recalls the device returned.
        lookups: (how.lookups || []).slice(0, 3),
        // The device's own question to its field guide: the brand read in the photo, and the recall it found.
        seen: how.seen ? { brand: clip(how.seen.brand, 40), id: how.seen.id } : null,
        // Sent to the cloud by the unnamed-sleep rule (shared/triage.mjs), whatever the built-in model said.
        unnamedSleep: !!how.unnamedSleep
      },
      // Said on the card when the listing's own words did not lead to the recall.
      // Hedged on purpose: other makers sell look-alikes (a Kids2 rocking sleeper was once named as a Rock 'n Play), so
      // the line sends the reader to the brand on the label.
      foundBy: !(asked || seenIt) ? "" : decision.alsoRecall ? tr(
        `${decision.kind === "recall" ? "It may also be" : "It may be"} the ${productName(via.product)}, ${via.warning ? "which CPSC warned about in" : "recalled"} ${monthYear(via.date)} (${viaNumber}). Other makers sell look-alikes, so check the brand on its label. The listing's words didn't name it: ${ledBy}`,
        `${decision.kind === "recall" ? "Tambi\xE9n puede ser" : "Puede ser"} \xAB${productName(via.product)}\xBB, ${via.warning ? "sobre el que advirti\xF3 la CPSC en" : "retirado del mercado en"} ${monthYear(via.date)} (${viaNumber}). Otros fabricantes venden productos parecidos, as\xED que revise la marca en la etiqueta. Las palabras del anuncio no lo nombraban: ${ledBy}`
      ) : tr(`The listing's words didn't lead to this recall. ${ledBy}`, `Las palabras del anuncio no llevaron a este retiro. ${ledBy}`),
      // A recall shown because the cloud named the product, not because the listing's words did.
      lookedUp: !!(decision.lookedUp && decision.card && decision.level !== "none"),
      // On a type flag that stands on its own: the recall the cloud and the device's field guide pointed to as well.
      also: decision.alsoRecall && decision.level !== "none" ? { id: via.id, number: via.id.replace(/^W/, ""), warning: !!via.warning, product: via.product, date: via.date, url: via.url } : null,
      recall: null,
      banned: null,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (base2.kind === "recall" && decision.card) {
      const c = decision.card;
      const remedy = how.remedies && how.remedies[c.id] ? clip(how.remedies[c.id], 700) : remedyText(c.remedy);
      base2.recall = {
        id: c.id,
        warning: !!c.warning,
        number: c.warning ? c.id.replace(/^W/, "") : c.id,
        date: c.date,
        product: c.product,
        title: c.title,
        hazard: c.hazard,
        remedy,
        url: c.url,
        image: c.image,
        // For the card's "which units" line and the label check.
        tell: c.tell || "",
        codes: (c.codes || []).slice(0, 14),
        more: !!c.more,
        from: c.from || 0,
        to: c.to || 0,
        all: !!c.all
      };
    }
    if (base2.kind === "banned" && decision.banned) {
      const t = TYPE_COPY[decision.banned.key] || {};
      base2.banned = { key: decision.banned.key, name: t.name || decision.banned.label, risk: t.risk || "", advice: t.advice || "", source: SAFE_SLEEP_URL };
    }
    if (base2.kind) {
      base2.badge = badgeText(base2);
      base2.verdict = verdictLine(base2);
      base2.action = actionLine(base2);
      base2.question = sellerQuestion(base2);
      base2.sleep = sleepLine(`${listing.title || ""} ${base2.recall ? base2.recall.product : ""}`, false, base2);
      base2.messageUrl = sellerMessageUrl(base2);
      base2.report = cpscReport(base2);
    }
    return base2;
  }

  // shared/read.mjs
  var READ_SYSTEM = [
    "You read one screenshot of a secondhand listing, or one photo of an item. Report only what you can see or read; never guess a brand or model that is not visible.",
    'found: "listing" for a screenshot of a listing, "item_photo" for a photo of the item itself, "nothing" when no product is shown.',
    'title: the listing title exactly as written, or "" when there is none.',
    'brand: the brand named in the text or printed on the product, or "".',
    "model_numbers: model numbers or product codes that are visible, or [] when none are.",
    'product_kind: the kind of product, in at most five words, for example "infant lounger" or "space heater".',
    'what_is_for_sale: "the_product" for a whole product; "part_or_accessory" for a spare part, cover, insert or add-on; "toy_or_doll_version" for a toy or doll-size version; "unclear" otherwise.',
    'price: the price as written, or "".',
    'description: other text from the seller that describes the item, at most 300 characters, or "".'
  ].join("\n");
  var READ_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["found", "title", "brand", "model_numbers", "product_kind", "what_is_for_sale", "price", "description"],
    properties: {
      found: { type: "string", enum: ["listing", "item_photo", "nothing"] },
      title: { type: "string" },
      brand: { type: "string" },
      model_numbers: { type: "array", items: { type: "string" } },
      product_kind: { type: "string" },
      what_is_for_sale: { type: "string", enum: ["the_product", "part_or_accessory", "toy_or_doll_version", "unclear"] },
      price: { type: "string" },
      description: { type: "string" }
    }
  };
  function listingFromRead(read, image) {
    const has = (hay, needle) => needle && String(hay).toLowerCase().includes(String(needle).toLowerCase());
    const title = clip(read.title || "", 200);
    const extra = [
      has(title, read.brand) ? "" : read.brand,
      has(title, read.product_kind) ? "" : read.product_kind,
      ...(read.model_numbers || []).filter((m) => !has(title, m))
    ].filter(Boolean);
    return {
      id: "check",
      site: "web",
      title: [title, ...extra].filter(Boolean).join(" ").trim() || read.product_kind || "Unnamed item",
      description: clip(read.description || "", 300),
      price: read.price || "",
      image,
      url: ""
    };
  }
  function listingFromText(text) {
    return { id: "check", site: "web", title: clip(String(text || "").trim(), 200), description: "", price: "", image: "", url: "" };
  }

  // shared/label.mjs
  var LABEL_SYSTEM = [
    "You read the label, tag or sticker in a photo of a product. Copy what is printed; do not guess.",
    "model_numbers: every model, item, style or product number printed on the label, exactly as printed. An empty list if none can be read.",
    'manufacture_date: the date of manufacture or date code as printed (for example "03/2019", "2019-03-14", "DOM 14MAR19"). Empty if none.',
    "year: the four-digit year of manufacture when the label shows one, otherwise 0.",
    "brand: the brand or maker printed on the label. Empty if none.",
    "readable: false when the photo shows no label or the print cannot be read."
  ].join("\n");
  var LABEL_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["readable", "model_numbers", "manufacture_date", "year", "brand"],
    properties: {
      readable: { type: "boolean" },
      model_numbers: { type: "array", items: { type: "string" } },
      manufacture_date: { type: "string" },
      year: { type: "integer" },
      brand: { type: "string" }
    }
  };
  var bare = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function sameModel(a, b) {
    const x = bare(a), y = bare(b);
    if (x.length < 3 || y.length < 3) return false;
    if (x === y) return true;
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    return short.length >= 4 && long.startsWith(short) || short.length >= 5 && long.includes(short);
  }
  function oneOff(a, b) {
    const x = bare(a), y = bare(b);
    if (x === y || Math.min(x.length, y.length) < 5 || Math.abs(x.length - y.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) {
        i++;
        j++;
        continue;
      }
      if (++edits > 1) return false;
      if (x.length > y.length) i++;
      else if (y.length > x.length) j++;
      else {
        i++;
        j++;
      }
    }
    return edits + (x.length - i) + (y.length - j) <= 1;
  }
  function settleReadings(device, cloud, card) {
    const v = judgeLabel(cloud, card);
    if (v.state !== "not_listed" && v.state !== "year_out") return v;
    const ofDevice = judgeLabel(device, card);
    if (ofDevice.state === "near") return ofDevice;
    const codes = (r) => new Set((r && r.readable !== false && Array.isArray(r.model_numbers) ? r.model_numbers : []).map(bare).filter((c) => c.length >= 3));
    const a = codes(device), b = codes(cloud);
    if (a.size && b.size && ![...a].some((c) => b.has(c))) return { ...v, state: "disagree", other: [...device.model_numbers || []].slice(0, 2).join(", ") };
    return v;
  }
  function readOnce(v) {
    return v && (v.state === "not_listed" || v.state === "year_out") ? { ...v, was: v.state, state: "read_once" } : v;
  }
  function judgeLabel(reading, card) {
    const read = (reading && reading.readable !== false && Array.isArray(reading.model_numbers) ? reading.model_numbers : []).map((m) => String(m).trim()).filter((m) => bare(m).length >= 3).slice(0, 8);
    const listed = (card.codes || []).slice(0, 14);
    const year3 = reading && Number.isInteger(reading.year) && reading.year >= 1960 && reading.year <= 2035 ? reading.year : 0;
    const yearOut = !!(year3 && card.from && card.to && (year3 < card.from - 1 || year3 > card.to));
    const base2 = { model: "", listed, year: year3, yearOut, from: card.from || 0, to: card.to || 0 };
    if (!read.length && !year3) return { ...base2, state: "unreadable" };
    const hit = read.find((m) => listed.some((c) => sameModel(m, c)));
    if (hit) return { ...base2, state: "recalled", model: hit };
    if (read.length && listed.length) {
      for (const m of read) {
        const twin = listed.find((c) => oneOff(m, c));
        if (twin) return { ...base2, state: "near", model: m, twin };
      }
      if (card.more) return { ...base2, state: "list_cut", model: read[0] };
      return { ...base2, state: "not_listed", model: read[0] };
    }
    if (yearOut) return { ...base2, state: "year_out", model: read[0] || "" };
    return { ...base2, state: read.length ? "no_models" : "unreadable", model: read[0] || "" };
  }
  var years = (v) => v.from && v.to ? v.from === v.to ? tr(`in ${v.from}`, `en ${v.from}`) : tr(`from ${v.from} to ${v.to}`, `de ${v.from} a ${v.to}`) : "";
  var some = (list) => list.length > 6 ? tr(`${list.slice(0, 6).join(", ")} and ${list.length - 6} more`, `${list.slice(0, 6).join(", ")} y ${list.length - 6} m\xE1s`) : list.join(", ");
  function labelCopy(v, { owner = false } = {}) {
    switch (v.state) {
      case "recalled":
        return {
          tone: "likely",
          title: tr("The label matches the recall", "La etiqueta coincide con el retiro"),
          text: tr(
            `Model ${v.model} is one of the models in the notice${v.yearOut ? `, though the label's year (${v.year}) is outside the years the notice gives` : ""}. ${owner ? "Don't sell it or give it away unless the recall's fix was done." : "Don't buy it unless the seller shows the recall's fix was done."}`,
            `El modelo ${v.model} es uno de los modelos del aviso${v.yearOut ? `, aunque el a\xF1o de la etiqueta (${v.year}) est\xE1 fuera de los a\xF1os que da el aviso` : ""}. ${owner ? "No lo venda ni lo regale a menos que ya se haya hecho la reparaci\xF3n del retiro." : "No lo compre a menos que el vendedor muestre que ya se hizo la reparaci\xF3n del retiro."}`
          )
        };
      case "near":
        return {
          tone: "possible",
          title: tr("One character from a recalled model", "A un car\xE1cter de un modelo retirado"),
          text: tr(
            `The label reads ${v.model}; the notice recalls ${v.twin}. Labels are easy to misread, by people and by models: ${owner ? "look at the label yourself before you pass it on." : "look at the label yourself, or ask for a sharper photo, before you buy."}`,
            `La etiqueta dice ${v.model}; el aviso retira el ${v.twin}. Las etiquetas se leen mal con facilidad, tanto las personas como los modelos: ${owner ? "revise la etiqueta usted mismo antes de pas\xE1rsela a alguien." : "revise la etiqueta usted mismo, o pida una foto m\xE1s n\xEDtida, antes de comprar."}`
          )
        };
      case "disagree":
        return {
          tone: "possible",
          title: tr("The label is hard to read", "La etiqueta es dif\xEDcil de leer"),
          text: tr(
            `Two readings of the label disagree (${v.other} and ${v.model}), so this can't rule the recall out. ${owner ? "Take" : "Ask for"} a closer, sharper photo of the label.`,
            `Dos lecturas de la etiqueta no coinciden (${v.other} y ${v.model}), as\xED que esto no descarta el retiro. ${owner ? "Tome" : "Pida"} una foto m\xE1s cercana y n\xEDtida de la etiqueta.`
          )
        };
      case "read_once":
        return {
          tone: "possible",
          title: tr("Read once, on this device: not ruled out", "Le\xEDda una vez, en este dispositivo: no descartado"),
          text: tr(
            `${v.was === "year_out" ? `The label is dated ${v.year}; the notice covers units sold ${years(v)}.` : `The label reads ${v.model}; the notice lists ${some(v.listed)}.`} That would point away from this recall, but the label was read only once, by the model on this device, and it can misread a label. Compare the label with the notice yourself before you rely on it.`,
            `${v.was === "year_out" ? `La etiqueta tiene fecha de ${v.year}; el aviso cubre unidades vendidas ${years(v)}.` : `La etiqueta dice ${v.model}; el aviso enumera ${some(v.listed)}.`} Eso apuntar\xEDa a que no es de este retiro, pero la etiqueta se ley\xF3 una sola vez, con el modelo de este dispositivo, que puede leer mal. Compare usted mismo la etiqueta con el aviso antes de fiarse.`
          )
        };
      case "list_cut":
        return {
          tone: "possible",
          title: tr("Check this model against the notice", "Compare este modelo con el aviso"),
          text: tr(
            `The label reads ${v.model}. This notice lists many model numbers, more than are kept here (${some(v.listed)}, and others), so look for ${v.model} in the notice itself before you rely on this.`,
            `La etiqueta dice ${v.model}. Este aviso enumera muchos n\xFAmeros de modelo, m\xE1s de los que se guardan aqu\xED (${some(v.listed)}, y otros), as\xED que busque ${v.model} en el aviso mismo antes de fiarse.`
          )
        };
      case "not_listed":
        return {
          tone: "plain",
          title: tr("Model not listed in this recall", "Modelo que no aparece en este retiro"),
          text: tr(
            `The label reads ${v.model}. The notice lists ${some(v.listed)}.${v.year && v.from ? ` It covers units sold ${years(v)}; this one is dated ${v.year}.` : ""} Some notices recall by date or serial number too, and other recalls may still apply: check the notice before you rely on this.`,
            `La etiqueta dice ${v.model}. El aviso enumera ${some(v.listed)}.${v.year && v.from ? ` Cubre unidades vendidas ${years(v)}; esta tiene fecha de ${v.year}.` : ""} Algunos avisos retiran tambi\xE9n por fecha o n\xFAmero de serie, y puede haber otros retiros: revise el aviso antes de fiarse.`
          )
        };
      case "year_out":
        return {
          tone: "possible",
          title: tr("Dated outside the years we have for this recall", "Fecha fuera de los a\xF1os que tenemos para este retiro"),
          text: tr(
            `The label is dated ${v.year}. Our summary of the notice gives units sold ${years(v)}, and no model number could be read to compare. Check the dates in the notice itself before you rely on this.`,
            `La etiqueta tiene fecha de ${v.year}. Nuestro resumen del aviso da unidades vendidas ${years(v)}, y no se pudo leer un n\xFAmero de modelo para comparar. Revise las fechas en el aviso mismo antes de fiarse.`
          )
        };
      case "no_models":
        return {
          tone: "possible",
          title: tr("The notice lists no model numbers", "El aviso no enumera n\xFAmeros de modelo"),
          text: tr(
            `The label reads ${v.model}${v.year ? `, dated ${v.year}` : ""}, but this notice doesn't recall by model number. Read "which units" in the notice.`,
            `La etiqueta dice ${v.model}${v.year ? `, con fecha de ${v.year}` : ""}, pero este aviso no retira por n\xFAmero de modelo. Lea en el aviso qu\xE9 unidades se retiran.`
          )
        };
      default:
        return {
          tone: "possible",
          title: tr("Couldn't read the label", "No se pudo leer la etiqueta"),
          text: tr("No model number or date could be read. Try a closer, sharper photo of the label or tag.", "No se pudo leer ning\xFAn n\xFAmero de modelo ni fecha. Pruebe con una foto m\xE1s cercana y n\xEDtida de la etiqueta.")
        };
    }
  }

  // shared/spotter.mjs
  var names2 = (list) => Array.isArray(list) ? list.map((x) => x && x.Name).filter(Boolean).join("; ") : "";
  var clip2 = (s, n) => {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
  };
  var SPOTTER_SYSTEM = [
    "You read one U.S. CPSC recall notice and fill in a short card used to match secondhand listings (eBay, Craigslist) to it.",
    "Use only what the notice says. Write names the way a seller would type them in a listing title.",
    'brands: the brand names on the recalled product (for example "Fisher-Price", "Graco", "IKEA"). A store counts only when the product is its own brand. Not a manufacturer nobody would name in a listing. Empty if the notice names no brand.',
    `lines: distinctive product line or model names (for example "Rock 'n Play", "MamaRoo", "MALM"). Not everyday words like "deluxe" or "portable", and not the kind of product. Empty if none.`,
    'kind: the kind of product in one to three everyday words, singular (for example "stroller", "crib", "space heater", "infant lounger").',
    'other_names: up to four other everyday names sellers use for the same kind of product (for example "play yard": "playpen", "playard", "pack n play").',
    "models: model, style or item numbers the notice lists, exactly as written. At most twelve.",
    "sold_from and sold_to: the first and last year the recalled units were sold or made, as four-digit years. 0 when the notice does not say.",
    "all_units: true when the recall covers every unit of the named product or line; false when only certain models, colours, dates or serial numbers are recalled.",
    "tell: one sentence, at most 35 words, on how a shopper can tell a recalled unit from one that is not: which models, colours, dates or markings, and where the label is. If all units are recalled, say so.",
    "for_children: true when the product is made for babies or children."
  ].join("\n");
  var SPOTTER_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["brands", "lines", "kind", "other_names", "models", "sold_from", "sold_to", "all_units", "tell", "for_children"],
    properties: {
      brands: { type: "array", items: { type: "string" } },
      lines: { type: "array", items: { type: "string" } },
      kind: { type: "string" },
      other_names: { type: "array", items: { type: "string" } },
      models: { type: "array", items: { type: "string" } },
      sold_from: { type: "integer" },
      sold_to: { type: "integer" },
      all_units: { type: "boolean" },
      tell: { type: "string" },
      for_children: { type: "boolean" }
    }
  };
  var noticeText = (r) => [
    `Recall ${r.RecallNumber}, ${String(r.RecallDate || "").slice(0, 10)}`,
    `Title: ${clip2(r.Title, 300)}`,
    names2(r.Products) ? `Products: ${clip2(names2(r.Products), 300)}` : "",
    `Description: ${clip2(r.Description, 2200)}`,
    names2(r.Manufacturers) ? `Manufacturer: ${clip2(names2(r.Manufacturers), 160)}` : "",
    names2(r.Importers) ? `Importer: ${clip2(names2(r.Importers), 160)}` : "",
    names2(r.Distributors) ? `Distributor: ${clip2(names2(r.Distributors), 160)}` : "",
    names2(r.Retailers) ? `Sold at: ${clip2(names2(r.Retailers), 400)}` : "",
    (r.Images || []).length ? `Photo captions: ${clip2((r.Images || []).map((i) => i.Caption).filter(Boolean).join("; "), 400)}` : ""
  ].filter(Boolean).join("\n");

  // shared/fieldguide.mjs
  var MAX = { list: 12, item: 80, kind: 60, tell: 400, model: 40 };
  function entryId(recallNumber) {
    const id = String(recallNumber || "").trim();
    return /^[A-Za-z0-9-]{2,20}$/.test(id) ? id : "";
  }
  var fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  var strings = (list, n, len) => Array.isArray(list) && list.length <= n && list.every((x) => typeof x === "string" && x.length <= len);
  var year2 = (y) => Number.isInteger(y) && (y === 0 || y >= 1950 && y <= (/* @__PURE__ */ new Date()).getFullYear() + 1);
  function validEntry(spot) {
    if (!spot || typeof spot !== "object" || Array.isArray(spot)) return false;
    const keys = ["brands", "lines", "kind", "other_names", "models", "sold_from", "sold_to", "all_units", "tell", "for_children"];
    if (Object.keys(spot).some((k) => !keys.includes(k)) || keys.some((k) => !(k in spot))) return false;
    return strings(spot.brands, MAX.list, MAX.item) && strings(spot.lines, MAX.list, MAX.item) && strings(spot.other_names, MAX.list, MAX.item) && strings(spot.models, MAX.list, MAX.model) && typeof spot.kind === "string" && spot.kind.length <= MAX.kind && typeof spot.tell === "string" && spot.tell.length <= MAX.tell && typeof spot.all_units === "boolean" && typeof spot.for_children === "boolean" && year2(spot.sold_from) && year2(spot.sold_to) && (!spot.sold_from || !spot.sold_to || spot.sold_from <= spot.sold_to);
  }
  function fitsNotice(spot, record) {
    if (!validEntry(spot)) return "shape";
    const text = ` ${fold(noticeText(record))} `;
    const squeezed = text.replace(/ /g, "");
    const inNotice = (s) => {
      const f = fold(s);
      return !!f && (text.includes(` ${f} `) || squeezed.includes(f.replace(/ /g, "")));
    };
    for (const b of spot.brands) if (!inNotice(b)) return `brand not in notice: ${b.slice(0, 40)}`;
    for (const l of spot.lines) if (!inNotice(l)) return `line not in notice: ${l.slice(0, 40)}`;
    for (const m of spot.models) if (!inNotice(m)) return `model not in notice: ${m.slice(0, 40)}`;
    const named = [...record.Manufacturers || [], ...record.Importers || [], ...record.Distributors || []].map((x) => x && x.Name).filter(Boolean);
    if (!spot.brands.length && !spot.lines.length && named.length) return "names nothing, but the notice names a firm";
    for (const y of [spot.sold_from, spot.sold_to]) if (y && !text.includes(` ${y} `)) return `year not in notice: ${y}`;
    for (const n of String(spot.tell).match(/[A-Za-z]*\d[\w-]*/g) || []) if (!inNotice(n)) return `number in tell not in notice: ${n.slice(0, 20)}`;
    return "";
  }
  function cautiousEntry(spot, record) {
    const text = ` ${fold(noticeText(record))} `;
    const saysAll = /\b(all (units|models|sizes|colors|colours|styles|versions)|entire|every)\b/.test(text);
    return { ...spot, tell: "", all_units: !!spot.all_units || saysAll };
  }

  // shared/live.mjs
  var TYPE_SAY = {
    inclined_sleeper: { name: "an inclined sleeper", say: "don't buy it. Selling one has been against federal law since November 2022, and babies have died in them." },
    crib_bumper: { name: "a padded crib bumper", say: "don't buy it. Selling one has been against federal law since November 2022; a crib needs nothing but a fitted sheet." },
    in_bed_sleeper: { name: "an infant lounger or nest", say: "skip it. They are never for sleep, babies fall asleep in them, and infants have died in them." },
    drop_side_crib: { name: "a drop-side crib", say: "don't buy it. Drop-side cribs don't meet the federal crib standard." }
  };
  var LIVE_TOOL = {
    ...LOOKUP_TOOL,
    // The brand is optional here: an unbranded lounger or bumper is still checked against the banned types.
    parameters: { ...LOOKUP_TOOL.parameters, required: ["product"] },
    description: "Search the recall field guide kept on the shopper's phone (every U.S. CPSC recall since 1973, and the infant sleep product types banned from sale) for one product you can see. Returns the matching recall notices, or none, and any banned type the words name."
  };
  var LIVE_SYSTEM = [
    "You help a parent at a yard sale or thrift store check baby and children's products for U.S. CPSC recalls. You see their phone's camera and hear them.",
    "Call lookup_recalls once for each baby or children's product in view, before you say anything about it: the kind of product always, the brand and product line when you can read or recognise them (leave the brand empty otherwise), and a model number if you can read one. Do not call it again for the same product.",
    'Say only what lookup_recalls returned, using its "say" lines. If it returned a recall that covers every unit, say: if this is that product, do not buy it, every unit is recalled. If it returned a recall that covers some units, say the brand and product may be recalled and which units the notice names, and suggest checking the label. If it returned a sleep type, say its "say" line as given. If it returned nothing, say no recall was found in the list for it, which does not mean it is safe, and say its "sleep" line if it has one.',
    "Never say a product is safe or not recalled. Never name a recall number or product that lookup_recalls did not return.",
    "When you cannot read a brand, say what kind of product it is and ask the parent to show you the label or the brand.",
    "Speak in short, plain sentences. Do not describe people or anything that is not a product for sale."
  ].join("\n");
  var LIVE_OPENING = "I am at a yard sale. Look at what my camera shows and check the baby products you can name.";
  function liveLookup(index2, args) {
    const a = lookupArgs(args);
    const words = `${a.brand} ${a.product} ${a.model_number}`.trim();
    const found = notTheProduct(words) ? [] : lookupCards(index2, a);
    const types = notTheProduct(words) ? [] : bannedHints(words).map((t) => ({ key: t.key, label: t.label, basis: t.basis }));
    const say = [
      ...found.filter((f) => f.card.all).map((f) => `If this is the ${productName(f.card.product)}: don't buy it. Every unit is recalled.`),
      ...types.map((t) => TYPE_SAY[t.key] ? `If this is ${TYPE_SAY[t.key].name}: ${TYPE_SAY[t.key].say}` : "")
    ].filter(Boolean);
    const response = { ...lookupResponse(found), sleep_types: types.map((t) => t.label), say, sleep: sleepLine(words) };
    if (!found.length && types.length) response.note = "No recall notice for that brand and product, but its kind is a sleep risk: say its line.";
    return {
      asked: a,
      response,
      shown: { recalls: found.map(({ card, strength }) => ({ card, strength })), types: types.map((t) => ({ ...t, say: TYPE_SAY[t.key] ? `If this is ${TYPE_SAY[t.key].name}: ${TYPE_SAY[t.key].say}` : "" })), sleep: sleepLine(words) }
    };
  }

  // android/engine/bridge.js
  var out = (v) => JSON.stringify(v === void 0 ? null : v);
  var base = [];
  var live = [];
  var idx = null;
  var index = () => idx || (idx = buildIndex([...live, ...base]));
  var PHOTO = { listing: "\0LISTING_PHOTO", recall: "\0RECALL_PHOTO" };
  globalThis.SR = {
    /** The phone's language for what the shopper reads (shared/i18n.mjs): 'es' on a Spanish phone, else English. */
    setLanguage(l) {
      setLang(l);
      return out(l === "es" ? "es" : "en");
    },
    /** Cards arrive in chunks (the sandbox caps one evaluation's size). */
    addCards(cards) {
      base.push(...cards);
      idx = null;
      return out(base.length);
    },
    setLive(cards) {
      live = cards || [];
      idx = null;
      return out(live.length);
    },
    counts() {
      return out({ base: base.length, live: live.length });
    },
    prompts() {
      return out({
        read: { system: READ_SYSTEM, schema: READ_SCHEMA },
        judge: { system: SYSTEM, schema: SCHEMA },
        // The confirmation carries one function the cloud may call, answered on the phone (shared/lookup.mjs).
        confirm: { system: CONFIRM_SYSTEM_LOOKUP, schema: CONFIRM_SCHEMA_LOOKUP, tool: LOOKUP_TOOL },
        label: { system: LABEL_SYSTEM, schema: LABEL_SCHEMA },
        spotter: { system: SPOTTER_SYSTEM, schema: SPOTTER_SCHEMA }
      });
    },
    listingFromRead(answer, image) {
      return out(listingFromRead(answer, image));
    },
    listingFromText(text) {
      return out(listingFromText(text));
    },
    /** Step 1. Adds `words`, a one-line summary for the progress view. */
    triage(listing) {
      const t = triage(index(), listing);
      const words = t.partOrToy ? "Looks like a part or a toy version" : t.candidate ? `Possible match: ${productName(t.candidate.card.product)}` : t.hints.length ? `Wording points to ${(t.hints[0].label || "a risky sleep product").toLowerCase()}` : "No recall names this brand and product";
      return out({ ...t, words });
    },
    /** The finished result for a listing no model needs to look at. */
    wordsOnly(listing, t) {
      return out(present(listing, { level: "none", why: t.partOrToy ? "part or toy" : "no recall or risky type in the words" }, { words: true }));
    },
    judgeText(listing, t) {
      return out(promptText(listing, t.candidate, t.hints));
    },
    /**
     * Step 2's answer (null when no model answered) as the device's decision, as engine.js lookOnDevice makes it.
     * `secondOpinion`: every baby product goes to the cloud, which may raise a soft flag on its own (the web page and
     * the phone do this; a search page of 60 listings does not).
     */
    afterLook(answer, t, { secondOpinion = false } = {}, listing = null) {
      let device = decide(answer || wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
      let seen = null;
      if (listing && answer) ({ device, seen } = applyDeviceLookup(index(), listing, answer, t.candidate, device));
      if (secondOpinion && !/part or a toy/.test(device.why || "")) device = { ...device, secondOpinion: true };
      const needsCloud = !(device.level === "none" && !device.askCloud && !device.secondOpinion);
      const deviceLevel = device.level === "none" && device.askCloud ? "ask" : device.level;
      const inHand = device.kind === "recall" && device.card ? device.card : device.seen || null;
      return out({ device, needsCloud, deviceLevel, recallId: inHand ? inHand.id : "", seen, recallImage: "" });
    },
    /**
     * Step 3's prompt, as text parts in order. A photo goes where a part is "\u0000LISTING_PHOTO" or
     * "\u0000RECALL_PHOTO". `noticeRecord` is the raw CPSC API record, or null.
     */
    confirmParts(listing, noticeRecord, hasListingPhoto, hasRecallPhoto, seenBrand, recallId) {
      let notice = noticeRecord ? noticeFromCpsc(noticeRecord) : null;
      if (!notice && recallId) {
        const card = [...live, ...base].find((c) => c.id === recallId);
        if (card) notice = noticeFromCard(card);
      }
      const seen = seenBrand && notice ? { brand: seenBrand, id: notice.id, notice } : null;
      const parts = confirmParts({ listing, notice: seen ? null : notice, listingPhoto: hasListingPhoto ? PHOTO.listing : null, recallPhoto: notice && hasRecallPhoto ? PHOTO.recall : null, seen });
      return out(parts);
    },
    noticeImage(noticeRecord) {
      const n = noticeFromCpsc(noticeRecord);
      return out(n.images[0] || "");
    },
    /** The notice's remedy in full, for the card (a recall card keeps only its first 140 characters). */
    remedy(noticeRecord) {
      return out(noticeRecord ? noticeFromCpsc(noticeRecord).remedy : "");
    },
    /**
     * The cloud asks the device: its lookup_recalls call, answered by the shortlist's code on the phone. Returns
     * { asked, ids, cards, strengths }; `exclude` is the recall the confirmation already has.
     */
    lookup(args, exclude) {
      const found = lookupCards(index(), args, { exclude: exclude || "" });
      return out({ asked: lookupArgs(args), ids: found.map((c) => c.card.id), cards: found.map((c) => c.card), strengths: found.map((c) => c.strength) });
    },
    /** The function's response for the cloud. `noticeRecords`: the raw CPSC record for each id, or null, in order. */
    lookupResponse(found, noticeRecords) {
      const candidates = (found.cards || []).map((card, i) => ({ card, strength: (found.strengths || [])[i] || "brand" }));
      return out(lookupResponse(candidates, (noticeRecords || []).map((r) => r ? noticeFromCpsc(r) : null)));
    },
    /**
     * The presented result. `cloud` is the cloud's answer, or null when the cloud did not run. `lookedUp`: the cards
     * the phone returned to the cloud's lookups.
     */
    finish(listing, device, cloud, hints, how, lookedUp, standIn) {
      let decision = cloud ? decideFinal(device, cloud, hints, lookedUp || []) : device.level === "none" ? device : decideFinal(device, null, hints);
      if (cloud && standIn) decision = capForStandIn(decision);
      return out(present(listing, decision, how));
    },
    /** The same result, said to someone who owns the item: { verdict, evidence, foundBy, action, heading, lines }. */
    ownerView(result) {
      return out(ownerView(result));
    },
    /**
     * What a no-match result says (shared/present.mjs noMatchView), with the count of notices this phone searched.
     * `input`: 'listing' for a screenshot or photo, 'typed' for typed or shared text.
     */
    noMatchView(result, listing, input, owner) {
      return out(noMatchView(result, listing, { input, audience: owner ? "owner" : "buyer", count: live.length + base.length, since: "1973-01-01" }));
    },
    judgeLabel(reading, recall) {
      return out(judgeLabel(reading, recall));
    },
    settleReadings(device, cloud, recall) {
      return out(settleReadings(device, cloud, recall));
    },
    labelCopy(verdict, owner) {
      return out(labelCopy(verdict, { owner: !!owner }));
    },
    /** A reading by the phone alone, with no second reading in the cloud: it never rules a recall out. */
    readOnce(verdict) {
      return out(readOnce(verdict));
    },
    // ---- Live recalls and the watch ---------------------------------------------------------------------------------
    // Warnings come from another CPSC file at build time: they say nothing about how new the recall list is.
    newest() {
      return out([...live, ...base].filter((c) => !c.warning).reduce((m, c) => c.date > m ? c.date : m, "1973-01-01"));
    },
    /** The records of an API answer that are not known yet. */
    unknown(records) {
      const ids = new Set([...live, ...base].map((c) => c.id));
      return out((records || []).filter((r) => r && r.RecallNumber && !ids.has(String(r.RecallNumber).trim())));
    },
    noticeText(record) {
      return out(noticeText(record));
    },
    // ---- Yard-sale mode (shared/live.mjs) ---------------------------------------------------------------------------
    /** The Live session's instructions, its one function, and the first thing the parent says. */
    liveSpec() {
      return out({ system: LIVE_SYSTEM, tool: LIVE_TOOL, opening: LIVE_OPENING });
    },
    /** Gemini Live's lookup_recalls call, answered from this phone's field guide: { asked, response, shown }. */
    liveLookup(args) {
      return out(liveLookup(index(), args));
    },
    /** Whether a shared field-guide entry fits the notice this phone fetched (shared/fieldguide.mjs): '' when it fits. */
    fitsNotice(spot, record) {
      return out(fitsNotice(spot, record));
    },
    /** A shared entry as the phone uses it: it may add a match and a warning, never make the card less cautious. */
    cautiousEntry(spot, record) {
      return out(cautiousEntry(spot, record));
    },
    /** The notice number as a shared field-guide document id, or '' when it can't be one. */
    entryId(recallNumber) {
      return out(entryId(recallNumber));
    },
    liveCards(records, spots) {
      return out(liveCardsFromCpsc(records, new Map(Object.entries(spots || {})), [...live, ...base]));
    },
    /** Watched listings whose words could be one of the new recalls: { listingId: recallId }. */
    watchHits(listings, newIds) {
      const fresh = live.filter((c) => newIds.includes(c.id));
      if (!fresh.length) return out({});
      const small = buildIndex(fresh);
      const hits = {};
      for (const l of listings) {
        const s = shortlist(small, `${l.title} ${l.description || ""}`)[0];
        if (s) hits[l.id] = s.card.id;
      }
      return out(hits);
    },
    /** Recent recalls of baby products, for the home screen. */
    recentInfant(n) {
      return out([...live, ...base].filter((c) => INFANT.test(`${c.product} ${c.title}`) && /^https:/.test(c.image || "")).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n).map((c) => ({ id: c.id, date: c.date, product: productName(c.product), image: c.image, url: c.url, hazard: c.hazard, live: !!c.live })));
    }
  };
})();
