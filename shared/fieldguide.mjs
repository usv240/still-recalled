// The shared field guide. Each recall CPSC publishes after the build needs a field-guide entry (shared/spotter.mjs),
// and Gemini in the cloud writes it. Without sharing, every phone, extension and web page writes its own entry for the
// same notice: the same call, paid again on every device. With it, the first device that sees a new notice writes the
// entry and stores it in Cloud Firestore under the notice's number; every other device reads it.
//
// A shared entry is data another device wrote, so it is never trusted as it is. Firestore's security rules check its
// shape (firestore.rules). This file checks what the rules cannot: that the entry fits the notice this device fetched
// from CPSC itself. Every brand, product line and model number in it must appear in the notice's own text, and its
// years must be possible. An entry that does not fit is ignored: this device writes its own, for itself only (the
// shared one is never overwritten). An entry only puts a recall on the shortlist: the cloud check still reads the
// official notice before anything is flagged, so a wrong entry can cost a match but cannot invent one.

import { noticeText } from './spotter.mjs';

export const COLLECTION = 'fieldGuide';
export const ENTRY_VERSION = 1;
const MAX = { list: 12, item: 80, kind: 60, tell: 400, model: 40 };

/** The document id for a notice: its recall number (or "W" warning number), or '' when it can't be one. */
export function entryId(recallNumber) {
  const id = String(recallNumber || '').trim();
  return /^[A-Za-z0-9-]{2,20}$/.test(id) ? id : '';
}

const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const strings = (list, n, len) => Array.isArray(list) && list.length <= n && list.every(x => typeof x === 'string' && x.length <= len);
const year = y => Number.isInteger(y) && (y === 0 || (y >= 1950 && y <= new Date().getFullYear() + 1));

/** The entry has the field guide's shape (shared/spotter.mjs SPOTTER_SCHEMA), within the sizes the rules allow. */
export function validEntry(spot) {
  if (!spot || typeof spot !== 'object' || Array.isArray(spot)) return false;
  const keys = ['brands', 'lines', 'kind', 'other_names', 'models', 'sold_from', 'sold_to', 'all_units', 'tell', 'for_children'];
  if (Object.keys(spot).some(k => !keys.includes(k)) || keys.some(k => !(k in spot))) return false;
  return strings(spot.brands, MAX.list, MAX.item) && strings(spot.lines, MAX.list, MAX.item) && strings(spot.other_names, MAX.list, MAX.item)
    && strings(spot.models, MAX.list, MAX.model)
    && typeof spot.kind === 'string' && spot.kind.length <= MAX.kind
    && typeof spot.tell === 'string' && spot.tell.length <= MAX.tell
    && typeof spot.all_units === 'boolean' && typeof spot.for_children === 'boolean'
    && year(spot.sold_from) && year(spot.sold_to) && (!spot.sold_from || !spot.sold_to || spot.sold_from <= spot.sold_to);
}

/**
 * Whether a shared entry fits the notice this device fetched itself. Returns '' when it fits, else the reason.
 * Names must come from the notice: a brand, line or model number the notice never mentions is how a wrong or planted
 * entry would show itself. An entry that names nothing at all fits only a notice that names no brand either (the
 * device's plain-code card would find none), so an emptied entry cannot hide a branded recall.
 */
export function fitsNotice(spot, record) {
  if (!validEntry(spot)) return 'shape';
  const text = ` ${fold(noticeText(record))} `;
  const squeezed = text.replace(/ /g, '');
  const inNotice = s => { const f = fold(s); return !!f && (text.includes(` ${f} `) || squeezed.includes(f.replace(/ /g, ''))); };
  for (const b of spot.brands) if (!inNotice(b)) return `brand not in notice: ${b.slice(0, 40)}`;
  for (const l of spot.lines) if (!inNotice(l)) return `line not in notice: ${l.slice(0, 40)}`;
  for (const m of spot.models) if (!inNotice(m)) return `model not in notice: ${m.slice(0, 40)}`;
  const named = [...(record.Manufacturers || []), ...(record.Importers || []), ...(record.Distributors || [])].map(x => x && x.Name).filter(Boolean);
  if (!spot.brands.length && !spot.lines.length && named.length) return 'names nothing, but the notice names a firm';
  return '';
}

/** The document a device stores: the entry, which model wrote it, and who (an anonymous Firebase Auth id). */
export function entryDoc(spot, { model = '', uid = '' } = {}) {
  return { v: ENTRY_VERSION, spot, model: String(model).slice(0, 60), by: uid };
}
