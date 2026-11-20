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
  function bannedHints(listingText) {
    const text = listingText || "";
    if (FOR_DOLLS.test(text)) return [];
    return BANNED_TYPES.filter((t) => t.pattern.test(text) && !(t.exclude && t.exclude.test(text)));
  }
  function notTheProduct(listingText) {
    const text = listingText || "";
    return FOR_DOLLS.test(text) || PART_ONLY.test(text);
  }

  // shared/triage.mjs
  var INFANT = /\b(babys?|babies|infants?|newborns?|toddlers?|cribs?|cots?|bassinets?|cradles?|sleepers?|nests?|loungers?|swings?|bouncers?|rockers?|bumpers?|play\s*yards?|playards?|pack\s*'?n\s*'?play|nursery|co-?sleep\w*)\b/i;
  function triage(idx2, listing) {
    const text = `${listing.title} ${listing.description || ""}`;
    const partOrToy = notTheProduct(listing.title);
    const candidate = partOrToy ? null : shortlist(idx2, text)[0] || null;
    const hints = partOrToy ? [] : bannedHints(text);
    const maybe = partOrToy ? [] : mayContain(listing.title);
    const needsEyes = !partOrToy && (!!candidate || hints.length > 0 || maybe.length > 0 || INFANT.test(listing.title));
    return { partOrToy, candidate, hints, maybe, needsEyes };
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
    ])].filter((c) => !/^(19|20)\d{2}$/.test(c)).slice(0, 14);
    const productTokens = uniqueTokens(product || title);
    const whole = (b) => String(b || "").replace(/['’]s\b/gi, "s").split(/[^A-Za-z0-9]+/).filter(Boolean).every((w) => w.length >= 2);
    let brands = spot ? phrases((spot.brands || []).filter(whole), 3).map((b) => b.filter((t) => !COMPANY_FORM.has(t))).filter((b) => b.length && !b.every((t) => NOT_BRAND.has(t) || EVERYDAY.has(t) || t.length < 3)) : [];
    if (!brands.length) {
      const b = brandTokens(r, productTokens).filter((t) => !EVERYDAY.has(t));
      if (b.length) brands = [b];
    }
    const kinds = spot ? phrases([spot.kind, ...spot.other_names || []], 5) : [];
    const kindWords = new Set(kinds.flat());
    const brandWords = new Set(brands.flat());
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
      brands,
      lines,
      // sorted into `lines` (distinctive) and `linesWithBrand` in cardsFromCpsc
      linesWithBrand: [],
      kinds,
      // Without a spotter card: the product name's words stand in for the kind.
      productTokens: spot ? [] : productTokens,
      tell: spot ? clip(spot.tell, 220) : "",
      from: spot ? year(spot.sold_from) : 0,
      to: spot ? year(spot.sold_to) : 0,
      all: !!(spot && spot.all_units)
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
    'banned_type: choose a type only when the listing clearly is that kind of product. Otherwise "none".'
  ].join("\n");
  var SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["what_is_for_sale", "product_kind", "same_kind_as_recalled", "recalled_unit", "banned_type"],
    properties: {
      what_is_for_sale: { type: "string", enum: ["the_product", "part_or_accessory", "toy_or_doll_version", "unclear"] },
      product_kind: { type: "string" },
      same_kind_as_recalled: { type: "boolean" },
      // The built-in model's reading of the card's "which units" line, written by the cloud at build time. Recorded
      // next to the cloud's own answer and not yet acted on: see docs/accuracy.md, "The cloud teaches the device".
      recalled_unit: { type: "string", enum: ["yes", "no", "cannot_tell"] },
      banned_type: { type: "string", enum: ["none", ...BANNED_TYPES.map((t) => t.key)] }
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
    if (answer.what_is_for_sale === "part_or_accessory" || answer.what_is_for_sale === "toy_or_doll_version") {
      return { ...none, askCloud: hints.length > 0, maybe: hints[0] || none.maybe, why: "the listing is a part or a toy version, not the product" };
    }
    if (candidate && answer.same_kind_as_recalled) {
      const why = {
        code: "the listing gives a model number this recall lists",
        line: "the listing names this recalled product line",
        brand: "same brand and kind of product; the listing does not state the model"
      }[candidate.strength];
      return { level: candidate.strength === "code" ? "likely" : "possible", kind: "recall", card: candidate.card, banned: null, why };
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
    "recall_id: when lookup_recalls returned a recall of the product for sale, its recall number, and answer matches_recall for that recall. Otherwise empty."
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
  function boxFrom(where) {
    if (!Array.isArray(where) || where.length !== 4 || where.some((n) => !Number.isFinite(n))) return null;
    const [y0, x0, y1, x1] = where.map((n) => Math.min(1e3, Math.max(0, n)) / 1e3);
    const w = x1 - x0, h = y1 - y0;
    if (w < 0.04 || h < 0.04 || w * h > 0.7) return null;
    return { x: +x0.toFixed(3), y: +y0.toFixed(3), w: +w.toFixed(3), h: +h.toFixed(3) };
  }
  function confirmParts({ listing, notice, listingPhoto, recallPhoto }) {
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
    parts.push(["", "BANNED TYPES", ...BANNED_TYPES.map((t) => `- ${t.key}: ${t.looksLike}`)].join("\n"));
    return parts;
  }
  function decideFinal(device, cloud, hints, lookedUp = []) {
    if (!cloud) return { ...device, confirmed: false };
    const base2 = { kind: null, card: null, banned: null, confirmed: true, evidence: cloud.evidence || "", check: cloud.check_before_buying || "", where: boxFrom(cloud.where) };
    if (cloud.what_is_for_sale === "toy_or_doll_version" || cloud.what_is_for_sale === "part_or_accessory" && (cloud.banned_type === "none" || device.kind === "recall")) {
      return { ...base2, level: "none", why: "the listing is a part or a toy version, not the product" };
    }
    const found = cloud.recall_id ? lookedUp.find((c) => c.id === String(cloud.recall_id).trim()) : null;
    if (found && cloud.matches_recall === "yes") {
      return { ...base2, level: "likely", kind: "recall", card: found, lookedUp: true, why: "the cloud named the product; the field guide on the device had its recall, and the listing matches the notice" };
    }
    if (found && cloud.matches_recall === "cannot_tell") {
      return { ...base2, level: "possible", kind: "recall", card: found, lookedUp: true, why: "the cloud named the product; the field guide on the device had a recall for it, and the listing does not show which model" };
    }
    if (device.kind === "recall" && device.card && !found) {
      if (cloud.matches_recall === "yes") {
        return { ...base2, level: "likely", kind: "recall", card: device.card, why: "matches the recalled product in the notice" };
      }
      if (cloud.matches_recall === "cannot_tell") {
        return { ...base2, level: "possible", kind: "recall", card: device.card, why: "same brand and kind as a recalled product; the listing does not show which model" };
      }
    }
    const cloudBanned = BANNED_TYPES.find((t) => t.key === cloud.banned_type) || null;
    const deviceBanned = device.kind === "banned" ? device.banned : null;
    if (cloudBanned && (hints.length || deviceBanned)) {
      return { ...base2, level: "likely", kind: "banned", banned: hints[0] || cloudBanned, why: "both models see a product type that may no longer be sold" };
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

  // shared/present.mjs
  var SAFE_SLEEP_URL = "https://www.cpsc.gov/SafeSleep";
  var TYPE_COPY = {
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
      advice: "A thin, breathable mesh liner is a different product from a padded bumper. Ask which this is before you buy.",
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
  function productName(product) {
    return clip(String(product || "").replace(/^all\s+(models\s+of\s+|units\s+of\s+)?/i, "").replace(/^the\s+/i, ""), 90);
  }
  function badgeText(r) {
    if (r.kind === "recall" && r.recall && r.recall.warning) return r.level === "likely" ? "CPSC warning" : "Possible CPSC warning";
    if (r.kind === "recall") return r.level === "likely" ? "Recalled product" : "Possible recall";
    if (r.kind === "banned") return r.level === "likely" ? (TYPE_COPY[r.banned.key] || {}).name || "Sleep risk" : `Possible ${(TYPE_COPY[r.banned.key] || {}).short || "sleep risk"}`;
    return "";
  }
  function verdictLine(r) {
    if (r.kind === "recall" && r.recall.warning) {
      const product = productName(r.recall.product);
      return r.level === "likely" ? `Looks like the ${product}. CPSC warned people to stop using them in ${monthYear(r.recall.date)}; the seller behind them did not recall them.` : `Same brand and kind as the ${product}, which CPSC warned people to stop using in ${monthYear(r.recall.date)}.`;
    }
    if (r.kind === "recall") {
      const product = productName(r.recall.product);
      return r.level === "likely" ? `Looks like the ${product}, recalled ${monthYear(r.recall.date)}.` : `Same brand and kind as the ${product}, recalled ${monthYear(r.recall.date)}. The listing doesn't show which model.`;
    }
    if (r.kind === "banned") {
      const name = (TYPE_COPY[r.banned.key] || { name: "infant sleep product" }).name.toLowerCase();
      const a = /^[aeiou]/.test(name) ? "an" : "a";
      return r.level === "likely" ? `This looks like ${a} ${name}.` : `This may be or include ${a} ${name}.`;
    }
    return "";
  }
  function actionLine(r) {
    if (r.kind === "recall" && r.recall && r.recall.warning) {
      return r.level === "possible" ? "Don't buy it until you know it isn't the product CPSC warned about." : "Don't buy it. CPSC has told people to stop using this product.";
    }
    if (r.kind === "recall") {
      if (r.level === "possible") return "Don't buy it until the seller's label shows it isn't one of the recalled units.";
      return r.recall && r.recall.all ? "Don't buy it. Every unit of this product is recalled." : "Don't buy it unless the seller's label shows it isn't one of the recalled units.";
    }
    if (r.kind === "banned") {
      if (r.level === "possible") return "Ask the seller what it is before you buy.";
      return {
        crib_bumper: "Skip this one. CPSC's advice: nothing in a crib but a fitted sheet.",
        inclined_sleeper: "Skip this one, and never use an inclined sleeper for sleep.",
        in_bed_sleeper: "Never use it for sleep, not even for a nap.",
        drop_side_crib: "Skip this one: drop-side cribs don't meet today's crib standard."
      }[r.banned && r.banned.key] || "Never use it for sleep.";
    }
    return "";
  }
  function sellerQuestion(r) {
    if (r.kind === "recall" && r.recall.warning) {
      return `Hi, before I buy: what brand is this, and could you send a photo of its tag or label? CPSC has warned people to stop using a product like it (warning ${r.recall.number}, ${productName(r.recall.product)}).`;
    }
    if (r.kind === "recall") {
      return `Hi, before I buy: could you send a photo of the label showing the model number and manufacture date? I'd like to check it against a CPSC recall (${r.recall.id}, ${productName(r.recall.product)}).`;
    }
    if (r.kind === "banned" && r.banned.key === "crib_bumper" && r.level === "possible") {
      return "Hi, before I buy: does this set include padded crib bumpers? Could you list every piece that comes with it?";
    }
    if (r.kind === "banned") return (TYPE_COPY[r.banned.key] || {}).ask || "";
    return "";
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
    const what = r.kind === "recall" ? `It appears to be the ${productName(r.recall.product)}, recalled ${monthYear(r.recall.date)} (CPSC recall ${r.recall.id}). The listing does not say the recall remedy has been applied.` : `It appears to be ${/^[aeiou]/i.test(r.banned.name) ? "an" : "a"} ${r.banned.name.toLowerCase()}. ${SALE_RULE[r.banned.key]}`;
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
    if (!y || !m) return "by CPSC";
    return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
  }
  function present(listing, decision, how = {}) {
    const asked = decision.lookedUp && decision.card ? (how.lookups || []).find((l) => l.found.includes(decision.card.id)) : null;
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
        lookups: (how.lookups || []).slice(0, 3)
      },
      // Said on the card when the listing's own words did not lead to the recall.
      foundBy: asked ? `The listing's words didn't lead to this recall. Gemini in the cloud named the product (${clip([asked.asked.brand, asked.asked.product].filter(Boolean).join(" "), 70)}) and asked the recall field guide on this device, which had it.` : "",
      recall: null,
      banned: null,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (base2.kind === "recall" && decision.card) {
      const c = decision.card;
      base2.recall = {
        id: c.id,
        warning: !!c.warning,
        number: c.warning ? c.id.replace(/^W/, "") : c.id,
        date: c.date,
        product: c.product,
        title: c.title,
        hazard: c.hazard,
        remedy: c.remedy,
        url: c.url,
        image: c.image,
        // For the card's "which units" line and the label check.
        tell: c.tell || "",
        codes: (c.codes || []).slice(0, 14),
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
    const year2 = reading && Number.isInteger(reading.year) && reading.year >= 1960 && reading.year <= 2035 ? reading.year : 0;
    const yearOut = !!(year2 && card.from && card.to && (year2 < card.from - 1 || year2 > card.to));
    const base2 = { model: "", listed, year: year2, yearOut, from: card.from || 0, to: card.to || 0 };
    if (!read.length && !year2) return { ...base2, state: "unreadable" };
    const hit = read.find((m) => listed.some((c) => sameModel(m, c)));
    if (hit) return { ...base2, state: "recalled", model: hit };
    if (read.length && listed.length) {
      for (const m of read) {
        const twin = listed.find((c) => oneOff(m, c));
        if (twin) return { ...base2, state: "near", model: m, twin };
      }
      return { ...base2, state: "not_listed", model: read[0] };
    }
    if (yearOut) return { ...base2, state: "year_out", model: read[0] || "" };
    return { ...base2, state: read.length ? "no_models" : "unreadable", model: read[0] || "" };
  }
  var years = (v) => v.from && v.to ? v.from === v.to ? `in ${v.from}` : `from ${v.from} to ${v.to}` : "";
  var some = (list) => list.length > 6 ? `${list.slice(0, 6).join(", ")} and ${list.length - 6} more` : list.join(", ");
  function labelCopy(v) {
    switch (v.state) {
      case "recalled":
        return {
          tone: "likely",
          title: "The label matches the recall",
          text: `Model ${v.model} is one of the models in the notice${v.yearOut ? `, though the label's year (${v.year}) is outside the years the notice gives` : ""}. Don't buy it unless the seller shows the recall's fix was done.`
        };
      case "near":
        return {
          tone: "possible",
          title: "One character from a recalled model",
          text: `The label reads ${v.model}; the notice recalls ${v.twin}. Labels are easy to misread, by people and by models: look at the label yourself, or ask for a sharper photo, before you buy.`
        };
      case "disagree":
        return {
          tone: "possible",
          title: "The label is hard to read",
          text: `Two readings of the label disagree (${v.other} and ${v.model}), so this can't rule the recall out. Ask for a closer, sharper photo of the label.`
        };
      case "read_once":
        return {
          tone: "possible",
          title: "Read once, on this device: not ruled out",
          text: `${v.was === "year_out" ? `The label is dated ${v.year}; the notice covers units sold ${years(v)}.` : `The label reads ${v.model}; the notice lists ${some(v.listed)}.`} That would point away from this recall, but the label was read only once, by the model on this device, and it can misread a label. Compare the label with the notice yourself before you rely on it.`
        };
      case "not_listed":
        return {
          tone: "plain",
          title: "Model not listed in this recall",
          text: `The label reads ${v.model}. The notice lists ${some(v.listed)}.${v.year && v.from ? ` It covers units sold ${years(v)}; this one is dated ${v.year}.` : ""} Some notices recall by date or serial number too, and other recalls may still apply: check the notice before you rely on this.`
        };
      case "year_out":
        return {
          tone: "plain",
          title: "Dated outside this recall",
          text: `The label is dated ${v.year}. The notice covers units sold ${years(v)}. No model number could be read to compare.`
        };
      case "no_models":
        return {
          tone: "possible",
          title: "The notice lists no model numbers",
          text: `The label reads ${v.model}${v.year ? `, dated ${v.year}` : ""}, but this notice doesn't recall by model number. Read "which units" in the notice.`
        };
      default:
        return {
          tone: "possible",
          title: "Couldn't read the label",
          text: "No model number or date could be read. Try a closer, sharper photo of the label or tag."
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

  // android/engine/bridge.js
  var out = (v) => JSON.stringify(v === void 0 ? null : v);
  var base = [];
  var live = [];
  var idx = null;
  var index = () => idx || (idx = buildIndex([...live, ...base]));
  var PHOTO = { listing: "\0LISTING_PHOTO", recall: "\0RECALL_PHOTO" };
  globalThis.SR = {
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
    afterLook(answer, t, { secondOpinion = false } = {}) {
      let device = decide(answer || wordsOnlyAnswer(t.candidate), t.candidate, t.hints, t.maybe);
      if (secondOpinion && !/part or a toy/.test(device.why || "")) device = { ...device, secondOpinion: true };
      const needsCloud = !(device.level === "none" && !device.askCloud && !device.secondOpinion);
      const deviceLevel = device.level === "none" && device.askCloud ? "ask" : device.level;
      const recallId = device.kind === "recall" && device.card ? device.card.id : "";
      return out({ device, needsCloud, deviceLevel, recallId, recallImage: "" });
    },
    /**
     * Step 3's prompt, as text parts in order. A photo goes where a part is "\u0000LISTING_PHOTO" or
     * "\u0000RECALL_PHOTO". `noticeRecord` is the raw CPSC API record, or null.
     */
    confirmParts(listing, noticeRecord, hasListingPhoto, hasRecallPhoto) {
      const notice = noticeRecord ? noticeFromCpsc(noticeRecord) : null;
      const parts = confirmParts({ listing, notice, listingPhoto: hasListingPhoto ? PHOTO.listing : null, recallPhoto: notice && hasRecallPhoto ? PHOTO.recall : null });
      return out(parts);
    },
    noticeImage(noticeRecord) {
      const n = noticeFromCpsc(noticeRecord);
      return out(n.images[0] || "");
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
    finish(listing, device, cloud, hints, how, lookedUp) {
      const decision = cloud ? decideFinal(device, cloud, hints, lookedUp || []) : device.level === "none" ? device : decideFinal(device, null, hints);
      return out(present(listing, decision, how));
    },
    judgeLabel(reading, recall) {
      return out(judgeLabel(reading, recall));
    },
    settleReadings(device, cloud, recall) {
      return out(settleReadings(device, cloud, recall));
    },
    labelCopy(verdict) {
      return out(labelCopy(verdict));
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
