// Settle it with the label. A "possible recall" flag ends at one fact the listing doesn't show: the model number and
// date on the product's label. When the shopper has a photo of the label (from the seller, or of the item in front of
// them), a model reads the label and plain code compares it with the recall card.
//
// The model only reads (the built-in model when the device has it, so the photo stays on the device). Whether the
// numbers match is decided here, in code, for the same reason the brand check is in code: the model is not trusted to
// compare. The answer never says "safe": a model the notice doesn't list is "not among the listed models".

export const LABEL_SYSTEM = [
  'You read the label, tag or sticker in a photo of a product. Copy what is printed; do not guess.',
  'model_numbers: every model, item, style or product number printed on the label, exactly as printed. An empty list if none can be read.',
  'manufacture_date: the date of manufacture or date code as printed (for example "03/2019", "2019-03-14", "DOM 14MAR19"). Empty if none.',
  'year: the four-digit year of manufacture when the label shows one, otherwise 0.',
  'brand: the brand or maker printed on the label. Empty if none.',
  'readable: false when the photo shows no label or the print cannot be read.',
].join('\n');

export const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'model_numbers', 'manufacture_date', 'year', 'brand'],
  properties: {
    readable: { type: 'boolean' },
    model_numbers: { type: 'array', items: { type: 'string' } },
    manufacture_date: { type: 'string' },
    year: { type: 'integer' },
    brand: { type: 'string' },
  },
};

const bare = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Do two codes name the same model? Equal, or one continues the other ("CHM84" on the notice, "CHM84-9993" on the label). */
function sameModel(a, b) {
  const x = bare(a), y = bare(b);
  if (x.length < 3 || y.length < 3) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // A label adds prefixes and suffixes: "PO: 10361800", "SUNNY CS EH1-0090".
  return (short.length >= 4 && long.startsWith(short)) || (short.length >= 5 && long.includes(short));
}

/** One character changed, added or dropped, in codes of five or more characters: how a misread usually looks. */
function oneOff(a, b) {
  const x = bare(a), y = bare(b);
  if (x === y || Math.min(x.length, y.length) < 5 || Math.abs(x.length - y.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (x.length > y.length) i++; else if (y.length > x.length) j++; else { i++; j++; }
  }
  return edits + (x.length - i) + (y.length - j) <= 1;
}

/**
 * Two readings of the same label, the built-in model's and the cloud's, settled together. The device can raise the
 * alarm on its own, but a reassuring answer needs both readings to agree: when they read different model numbers and
 * neither matches, the label is not clear enough to rule anything out. Returns the same shape as judgeLabel.
 */
export function settleReadings(device, cloud, card) {
  const v = judgeLabel(cloud, card);
  if (v.state !== 'not_listed' && v.state !== 'year_out') return v;
  const ofDevice = judgeLabel(device, card);
  if (ofDevice.state === 'near') return ofDevice;
  const codes = r => new Set((r && r.readable !== false && Array.isArray(r.model_numbers) ? r.model_numbers : []).map(bare).filter(c => c.length >= 3));
  const a = codes(device), b = codes(cloud);
  if (a.size && b.size && ![...a].some(c => b.has(c))) return { ...v, state: 'disagree', other: [...(device.model_numbers || [])].slice(0, 2).join(', ') };
  return v;
}

/**
 * A verdict from one reading by the device's model, with no second reading in the cloud (the cloud check is off, or
 * could not be reached). It can raise the alarm, but it never rules a recall out: the built-in model misread "615573"
 * as "S16578" on a real label, so "not listed" and "dated outside" become "read once".
 */
export function readOnce(v) {
  return v && (v.state === 'not_listed' || v.state === 'year_out') ? { ...v, was: v.state, state: 'read_once' } : v;
}

/**
 * Compare a label reading with a recall card. Returns { state, model, listed, year }:
 *   "recalled"    a model number on the label is one the notice lists (and the year, if read, is not outside the years sold)
 *   "near"        a model number on the label is one character away from one the notice lists: a misread is likely
 *                 (a blurred 6 read as 3 on a real CPSC label photo, 2026-11-19), so it is not ruled out
 *   "not_listed"  the label shows a model number, and it is not among those the notice lists
 *   "list_cut"    the same, but the notice lists more model numbers than the card keeps, so nothing is ruled out
 *   "year_out"    no model to compare, but the label's year is outside the years the recalled units were sold
 *   "no_models"   the label was read, but the notice gives no model numbers to compare with
 *   "unreadable"  nothing useful could be read
 */
export function judgeLabel(reading, card) {
  const read = (reading && reading.readable !== false && Array.isArray(reading.model_numbers) ? reading.model_numbers : [])
    .map(m => String(m).trim()).filter(m => bare(m).length >= 3).slice(0, 8);
  const listed = (card.codes || []).slice(0, 14);
  const year = reading && Number.isInteger(reading.year) && reading.year >= 1960 && reading.year <= 2035 ? reading.year : 0;
  // Made up to a year before the first sale; not made after the last.
  const yearOut = !!(year && card.from && card.to && (year < card.from - 1 || year > card.to));
  const base = { model: '', listed, year, yearOut, from: card.from || 0, to: card.to || 0 };

  if (!read.length && !year) return { ...base, state: 'unreadable' };
  const hit = read.find(m => listed.some(c => sameModel(m, c)));
  if (hit) return { ...base, state: 'recalled', model: hit };
  if (read.length && listed.length) {
    for (const m of read) {
      const twin = listed.find(c => oneOff(m, c));
      if (twin) return { ...base, state: 'near', model: m, twin };
    }
    // The card keeps only some of the notice's model numbers: "not among them" would say nothing.
    if (card.more) return { ...base, state: 'list_cut', model: read[0] };
    return { ...base, state: 'not_listed', model: read[0] };
  }
  if (yearOut) return { ...base, state: 'year_out', model: read[0] || '' };
  return { ...base, state: read.length ? 'no_models' : 'unreadable', model: read[0] || '' };
}

const years = v => (v.from && v.to ? (v.from === v.to ? `in ${v.from}` : `from ${v.from} to ${v.to}`) : '');
const some = list => (list.length > 6 ? `${list.slice(0, 6).join(', ')} and ${list.length - 6} more` : list.join(', '));

/**
 * What the shopper reads: { tone: "likely" | "possible" | "plain", title, text }. Never "safe".
 * `owner`: said to the person who owns the item, not to a buyer.
 */
export function labelCopy(v, { owner = false } = {}) {
  switch (v.state) {
    case 'recalled':
      return { tone: 'likely', title: 'The label matches the recall',
        text: `Model ${v.model} is one of the models in the notice${v.yearOut ? `, though the label's year (${v.year}) is outside the years the notice gives` : ''}. ${owner ? "Don't sell it or give it away unless the recall's fix was done." : "Don't buy it unless the seller shows the recall's fix was done."}` };
    case 'near':
      return { tone: 'possible', title: 'One character from a recalled model',
        text: `The label reads ${v.model}; the notice recalls ${v.twin}. Labels are easy to misread, by people and by models: ${owner ? 'look at the label yourself before you pass it on.' : 'look at the label yourself, or ask for a sharper photo, before you buy.'}` };
    case 'disagree':
      return { tone: 'possible', title: 'The label is hard to read',
        text: `Two readings of the label disagree (${v.other} and ${v.model}), so this can't rule the recall out. ${owner ? 'Take' : 'Ask for'} a closer, sharper photo of the label.` };
    case 'read_once':
      return { tone: 'possible', title: 'Read once, on this device: not ruled out',
        text: `${v.was === 'year_out' ? `The label is dated ${v.year}; the notice covers units sold ${years(v)}.` : `The label reads ${v.model}; the notice lists ${some(v.listed)}.`} That would point away from this recall, but the label was read only once, by the model on this device, and it can misread a label. Compare the label with the notice yourself before you rely on it.` };
    case 'list_cut':
      return { tone: 'possible', title: 'Check this model against the notice',
        text: `The label reads ${v.model}. This notice lists many model numbers, more than are kept here (${some(v.listed)}, and others), so look for ${v.model} in the notice itself before you rely on this.` };
    case 'not_listed':
      return { tone: 'plain', title: 'Model not listed in this recall',
        text: `The label reads ${v.model}. The notice lists ${some(v.listed)}.${v.year && v.from ? ` It covers units sold ${years(v)}; this one is dated ${v.year}.` : ''} Some notices recall by date or serial number too, and other recalls may still apply: check the notice before you rely on this.` };
    case 'year_out':
      return { tone: 'plain', title: 'Dated outside this recall',
        text: `The label is dated ${v.year}. The notice covers units sold ${years(v)}. No model number could be read to compare.` };
    case 'no_models':
      return { tone: 'possible', title: 'The notice lists no model numbers',
        text: `The label reads ${v.model}${v.year ? `, dated ${v.year}` : ''}, but this notice doesn't recall by model number. Read "which units" in the notice.` };
    default:
      return { tone: 'possible', title: 'Couldn\'t read the label',
        text: 'No model number or date could be read. Try a closer, sharper photo of the label or tag.' };
  }
}
