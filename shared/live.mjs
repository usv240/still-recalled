// Yard-sale mode: the shopper walks a yard sale or a thrift store with the phone's camera on. Gemini Live (Firebase AI
// Logic's Live API) watches the camera and listens, and for each baby product it can name it calls lookup_recalls.
// That call comes back to the shopper's device, where the field guide of every CPSC recall since 1973 and the rules
// for the banned infant sleep types answer it in plain code (shortlist.mjs, banned.mjs). The device is the authority
// on which recalls exist: the screen shows what the lookup returned, not what the model said.
import { LOOKUP_TOOL, lookupArgs, lookupCards, lookupResponse } from './lookup.mjs';
import { bannedHints, notTheProduct } from './banned.mjs';

export const LIVE_TOOL = {
  ...LOOKUP_TOOL,
  // The brand is optional here: an unbranded lounger or bumper is still checked against the banned types.
  parameters: { ...LOOKUP_TOOL.parameters, required: ['product'] },
  description: 'Search the recall field guide kept on the shopper\'s phone (every U.S. CPSC recall since 1973, and the infant sleep product types banned from sale) for one product you can see. Returns the matching recall notices, or none, and any banned type the words name.',
};

export const LIVE_SYSTEM = [
  'You help a parent at a yard sale or thrift store check baby and children\'s products for U.S. CPSC recalls. You see their phone\'s camera and hear them.',
  'Call lookup_recalls once for each baby or children\'s product in view, before you say anything about it: the kind of product always, the brand and product line when you can read or recognise them (leave the brand empty otherwise), and a model number if you can read one. Do not call it again for the same product.',
  'Say only what lookup_recalls returned. If it returned a recall, say the brand and product, that it may be recalled, and what the notice says about which units, in one or two short sentences, and suggest checking the label. If it returned a banned type, say that type cannot legally be sold. If it returned nothing, say no recall was found in the list for it, which does not mean it is safe.',
  'Never say a product is safe or not recalled. Never name a recall number or product that lookup_recalls did not return.',
  'When you cannot read a brand, say what kind of product it is and ask the parent to show you the label or the brand.',
  'Speak in short, plain sentences. Do not describe people or anything that is not a product for sale.',
].join('\n');

/** What the parent's first turn says, so Gemini starts looking without waiting to be asked. */
export const LIVE_OPENING = 'I am at a yard sale. Look at what my camera shows and check the baby products you can name.';

/**
 * The device's answer to one lookup_recalls call from the Live session: the response sent back to the model, and what
 * the screen shows (made by code, from the field guide). `index` is the shortlist's index of every card.
 */
export function liveLookup(index, args) {
  const a = lookupArgs(args);
  const words = `${a.brand} ${a.product} ${a.model_number}`.trim();
  const found = notTheProduct(words) ? [] : lookupCards(index, a);
  const types = notTheProduct(words) ? [] : bannedHints(words).map(t => ({ key: t.key, label: t.label, basis: t.basis }));
  const response = { ...lookupResponse(found), banned_types: types.map(t => `${t.label}: cannot legally be sold (${t.basis})`) };
  if (!found.length && types.length) response.note = 'No recall notice for that brand and product, but its kind is banned from sale.';
  return {
    asked: a,
    response,
    shown: { recalls: found.map(({ card, strength }) => ({ card, strength })), types },
  };
}
