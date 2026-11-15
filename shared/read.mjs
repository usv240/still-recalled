// The web page's first step: read a screenshot (or a photo of the item) into the same listing shape the extension
// reads from a marketplace page, so everything after it is the extension's own pipeline.
// Runs through hybrid inference: on the device when the browser has a built-in model, in the cloud otherwise.
import { clip } from './text.mjs';

export const READ_SYSTEM = [
  'You read one screenshot of a secondhand listing, or one photo of an item. Report only what you can see or read; never guess a brand or model that is not visible.',
  'found: "listing" for a screenshot of a listing, "item_photo" for a photo of the item itself, "nothing" when no product is shown.',
  'title: the listing title exactly as written, or "" when there is none.',
  'brand: the brand named in the text or printed on the product, or "".',
  'model_numbers: model numbers or product codes that are visible, or [] when none are.',
  'product_kind: the kind of product, in at most five words, for example "infant lounger" or "space heater".',
  'what_is_for_sale: "the_product" for a whole product; "part_or_accessory" for a spare part, cover, insert or add-on; "toy_or_doll_version" for a toy or doll-size version; "unclear" otherwise.',
  'price: the price as written, or "".',
  'description: other text from the seller that describes the item, at most 300 characters, or "".',
].join('\n');

export const READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['found', 'title', 'brand', 'model_numbers', 'product_kind', 'what_is_for_sale', 'price', 'description'],
  properties: {
    found: { type: 'string', enum: ['listing', 'item_photo', 'nothing'] },
    title: { type: 'string' },
    brand: { type: 'string' },
    model_numbers: { type: 'array', items: { type: 'string' } },
    product_kind: { type: 'string' },
    what_is_for_sale: { type: 'string', enum: ['the_product', 'part_or_accessory', 'toy_or_doll_version', 'unclear'] },
    price: { type: 'string' },
    description: { type: 'string' },
  },
};

/** The read answer as a listing the engine takes. The title carries everything the word rules should see. */
export function listingFromRead(read, image) {
  const has = (hay, needle) => needle && String(hay).toLowerCase().includes(String(needle).toLowerCase());
  const title = clip(read.title || '', 200);
  const extra = [
    has(title, read.brand) ? '' : read.brand,
    has(title, read.product_kind) ? '' : read.product_kind,
    ...(read.model_numbers || []).filter(m => !has(title, m)),
  ].filter(Boolean);
  return {
    id: 'check',
    site: 'web',
    title: [title, ...extra].filter(Boolean).join(' ').trim() || read.product_kind || 'Unnamed item',
    description: clip(read.description || '', 300),
    price: read.price || '',
    image,
    url: '',
  };
}

/** Typed text ("Fisher-Price Rock 'n Play") as a listing, for people without a screenshot. */
export function listingFromText(text) {
  return { id: 'check', site: 'web', title: clip(String(text || '').trim(), 200), description: '', price: '', image: '', url: '' };
}
