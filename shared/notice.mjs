// The full government recall notice for one recall, fetched live from the CPSC recall API when the cloud check needs it.
// Recall cards (cards.mjs) keep only what matching needs; the notice carries the details that settle a match:
// which models and dates are affected, where the label is, and the recall's own photos.
import { clip } from './text.mjs';

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

/** Fetch one notice by recall number. `fetchImpl` lets tests and pages pass their own fetch. */
export async function fetchNotice(id, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}?format=json&RecallNumber=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`recall API ${res.status}`);
  const list = await res.json();
  const r = Array.isArray(list) && list.find(x => String(x.RecallNumber) === String(id));
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
