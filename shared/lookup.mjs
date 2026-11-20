// The cloud asks the device. Sellers often leave the product's name out ("baby rocker sleeper, pink"), so the word
// rules on the device find no recall to check, only a risky type. The cloud model can often name the product from the
// photo, but it does not know which recall, if any, covers it: the field guide of every CPSC recall since 1973 lives
// on the device. So the cloud's confirmation call carries one function, lookup_recalls, and Firebase AI Logic hands
// its call back to the device, where the same plain code that shortlists listings answers it. The cloud then judges
// the listing against the notice the device found.
//
// The device stays the authority on which recalls exist: a recall the cloud names counts only when it is one the
// device returned (confirm.mjs decideFinal), and the match is made by the shortlist's code, not by a model.
import { shortlist } from './shortlist.mjs';
import { noticeForPrompt } from './notice.mjs';
import { clip } from './text.mjs';

/** The function declaration, in the JSON Schema shape both Firebase AI Logic SDKs take. */
export const LOOKUP_TOOL = {
  name: 'lookup_recalls',
  description: 'Search the recall field guide kept on the shopper\'s device (every U.S. CPSC recall since 1973) for recalls of one brand and product that the listing\'s words do not name. Returns the matching recall notices, or none.',
  parameters: {
    type: 'object',
    properties: {
      brand: { type: 'string', description: 'The brand or maker, as a seller would type it, for example "Fisher-Price".' },
      product: { type: 'string', description: 'The product line and kind of product, for example "Rock \'n Play sleeper".' },
      model_number: { type: 'string', description: 'A model number the listing shows, if any.' },
    },
    required: ['brand', 'product'],
  },
};

/** Added to the confirmation's system prompt when the function is offered. */
export const LOOKUP_SYSTEM = [
  'lookup_recalls: the device has already searched its field guide with the listing\'s own words; the RECALL NOTICE given, if any, is what that search found. Call lookup_recalls once, and only when you can name a brand or product line that the listing\'s words do not state: you recognise it in the photo, read it on the product or its label in the photo, or know the product by a name the seller did not use. Do not call it for a brand or product the title or description already names, and do not call it when you cannot name a brand.',
  'recall_id: when lookup_recalls returned a recall of the product for sale, its recall number, and answer matches_recall for that recall. Otherwise empty.',
].join('\n');

const str = v => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').trim().slice(0, 80);

/** What the cloud asked, cleaned: plain short strings only. */
export function lookupArgs(args) {
  const a = args && typeof args === 'object' ? args : {};
  return { brand: str(a.brand), product: str(a.product), model_number: str(a.model_number) };
}

/**
 * The device's answer to the cloud's question: the shortlist, run on the brand and product the cloud named.
 * `exclude` is the recall the confirmation already has in hand. Returns the shortlist's candidates (at most two).
 */
export function lookupCards(index, args, { exclude = '' } = {}) {
  const a = lookupArgs(args);
  if (!a.brand || !a.product) return [];
  // The cloud may spell a brand another way than the notice does ("Kids II" for "Kids2", "Fisher Price"): when the
  // name as given finds nothing, try it with "II" as "2", and with its words run together.
  const spellings = [...new Set([a.brand, a.brand.replace(/\s+II$/i, '2'), a.brand.replace(/[\s-]+/g, '')])];
  for (const brand of spellings) {
    const found = shortlist(index, `${brand} ${a.product} ${a.model_number}`, 4).filter(c => c.card.id !== String(exclude)).slice(0, 2);
    if (found.length) return found;
  }
  return [];
}

/**
 * The function's response. `notices` holds the full CPSC notice for each candidate where it could be fetched (same
 * order); without one, the card's own lines stand in.
 */
export function lookupResponse(candidates, notices = []) {
  if (!candidates.length) return { recalls: [], note: 'The field guide has no recall for that brand and product. Answer from the listing alone.' };
  return {
    recalls: candidates.map(({ card, strength }, i) => ({
      recall_id: card.id,
      matched_by: { code: 'a model number', line: 'the product line', brand: 'the brand and kind of product' }[strength],
      which_units: clip(card.tell || '', 300),
      every_unit_recalled: !!card.all,
      notice: notices[i] ? noticeForPrompt(notices[i]) : `Recall ${card.id}, ${card.date}: ${clip(card.title || card.product, 220)}${card.hazard ? `\nHazard: ${clip(card.hazard, 300)}` : ''}`,
    })),
  };
}
