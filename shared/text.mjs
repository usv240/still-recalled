// Shared text helpers: one tokenizer for recall cards and listings, so they are compared like with like.

// Words that appear in almost every recall notice and say nothing about the product.
const NOTICE_WORDS = new Set(
  ('recall recalls recalled recalling due risk risks hazard hazards serious injury injuries death deaths ' +
   'violation violations violate violates federal mandatory standard standards regulation regulations ban ' +
   'sold exclusively online at by from the and for with of to in on or a an its their this that these those ' +
   'reannounces announces announce expanded expands cpsc inc llc co corp company usa new used').split(' '));

// "swings" in a recall has to match "swing" in a listing. Crude on purpose: both sides go through the same rule.
const singular = w => (w.length > 3 && /[a-z]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w);

/** Lowercase tokens of 2+ characters. Codes with digits also get a joined form, so "RGV3-304" matches "RGV3304". */
export function tokenize(text) {
  const out = [];
  // "2-1", "2 in 1" and "2-in-1" are the same thing in listings: all become "2in1".
  const raw = String(text || '').toLowerCase().replace(/[’']/g, '').replace(/\b(\d)\s*(?:-\s*in\s*-|\s+in\s+|-)\s*(\d)\b/g, '$1in$2');
  for (const chunk of raw.split(/[^a-z0-9-]+/)) {
    if (!chunk) continue;
    const parts = chunk.split('-').filter(Boolean);
    for (const p of parts) {
      const word = singular(p);
      if (word.length >= 2 && !NOTICE_WORDS.has(word) && !NOTICE_WORDS.has(p)) out.push(word);
    }
    if (parts.length > 1 && /\d/.test(chunk)) out.push(parts.join(''));
  }
  return out;
}

export function uniqueTokens(text) {
  return [...new Set(tokenize(text))];
}

// Sizes, counts and feature tags that look like codes but are not: "2-IN-1", "5-8QT", "3-WHEEL", "12V", "4PC".
const NOT_A_MODEL = /^(\d+-?in-?\d+|\d+[-.]?\d*-?(qt|quart|oz|lb|lbs|v|w|mm|cm|ft|inch|in|pc|pcs|pk|pack|piece|gb|mah|wheel|wheels|month|months|mo|m|yr|year|years|ct|count|x)|\d+x\d+|(19|20)\d{2}s?)$/i;

/** Model and part codes: tokens with letters and at least two digits, or long digit runs. */
export function modelCodes(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(/\b[A-Za-z0-9][A-Za-z0-9-]{2,}\b/g)) {
    const t = m[0];
    const digits = (t.match(/\d/g) || []).length, hasLetter = /[A-Za-z]/.test(t);
    if (NOT_A_MODEL.test(t)) continue;
    if ((digits >= 2 && hasLetter && t.length >= 4) || /^\d{5,}$/.test(t)) found.add(t.toUpperCase());
  }
  return [...found];
}

export function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}
