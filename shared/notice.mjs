// The full government recall notice for one recall, fetched live from the CPSC recall API when the cloud check needs it.
// Recall cards (cards.mjs) keep only what matching needs; the notice carries the details that settle a match:
// which models and dates are affected, where the label is, and the recall's own photos.
import { clip } from './text.mjs';
import { mirrorRecalls } from './mirror.mjs';

const API = 'https://www.saferproducts.gov/RestWebServices/Recall';
const names = list => (Array.isArray(list) ? list.map(x => x && x.Name).filter(Boolean).join('; ') : '');

/** Shape one raw CPSC record into the parts the cloud prompt uses. */
export function noticeFromCpsc(r) {
  return {
    id: String(r.RecallNumber || ''),
    date: String(r.RecallDate || '').slice(0, 10),
    title: r.Title || '',
    product: names(r.Products),
    units: (r.Products && r.Products[0] && r.Products[0].NumberOfUnits) || '',
    description: r.Description || '',
    hazard: names(r.Hazards),
    remedy: names(r.Remedies),
    soldAt: names(r.Retailers),
    upcs: (r.ProductUPCs || []).map(u => u && u.UPC).filter(Boolean).slice(0, 12),
    // Product photos first; label close-ups ("label", "tag", "model number") are useful but show less of the product.
    images: (r.Images || []).map(i => i && i.URL).filter(Boolean)
      .sort((a, b) => /label|tag|model|date|code/i.test(a) - /label|tag|model|date|code/i.test(b)),
    url: r.URL || '',
  };
}

/**
 * A stand-in notice made from the recall card on the device, for when the CPSC recall API does not answer. The cloud
 * check then still runs, on less text, where it used to give up and leave the device's flag standing unconfirmed
 * (six listings in one test run, while the API was timing out).
 */
export function noticeFromCard(c) {
  return {
    id: String(c.id || ''),
    date: c.date || '',
    title: c.title || c.product || '',
    product: c.product || '',
    units: '',
    description: [
      c.all ? 'Every unit of this product is recalled.' : '',
      c.tell ? `Which units are recalled: ${c.tell}` : '',
      c.from && c.to ? `Sold ${c.from === c.to ? `in ${c.from}` : `from ${c.from} to ${c.to}`}.` : '',
      c.codes && c.codes.length ? `Model numbers in the notice: ${c.codes.join(', ')}${c.more ? ', and others' : ''}.` : '',
      '(The full notice could not be fetched; this is the short record kept on the device.)',
    ].filter(Boolean).join(' '),
    hazard: c.hazard || '',
    remedy: '',
    soldAt: '',
    upcs: [],
    images: c.image ? [c.image] : [],
    url: c.url || '',
    fromCard: true,
  };
}

/** Fetch one notice by recall number. `fetchImpl` lets tests and pages pass their own fetch. */
export async function fetchNotice(id, fetchImpl = fetch) {
  // A recall API that stops answering must not hold a listing at "checking": give up after 15 s, and the flag
  // stands unconfirmed.
  let r;
  try {
    const res = await fetchImpl(`${API}?format=json&RecallNumber=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`recall API ${res.status}`);
    const list = await res.json();
    r = Array.isArray(list) && list.find(x => String(x.RecallNumber) === String(id));
  } catch (e) {
    // CPSC can't be reached: the recall mirror has the last 180 days, unchanged (shared/mirror.mjs). Older notices
    // fall to the caller's stand-in from the card.
    r = await mirrorRecalls('1973-01-01', { fetchImpl }).then(all => all.find(x => String(x.RecallNumber) === String(id)), () => null);
    if (!r) throw e;
  }
  if (!r) throw new Error(`recall ${id} not found`);
  return noticeFromCpsc(r);
}

/** The notice as prompt text, clipped to keep the cloud request small. */
export function noticeForPrompt(n) {
  return [
    `Recall ${n.id}, ${n.date}: ${clip(n.title, 220)}`,
    n.product ? `Recalled product: ${clip(n.product, 160)}${n.units ? ` (${n.units} units)` : ''}` : '',
    `Description: ${clip(n.description, 1600)}`,
    n.hazard ? `Hazard: ${clip(n.hazard, 300)}` : '',
    n.soldAt ? `Sold at: ${clip(n.soldAt, 300)}` : '',
    n.upcs.length ? `UPCs: ${n.upcs.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}
