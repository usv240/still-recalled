// The field guide's prompt: Gemini reads one CPSC recall notice and writes a short "spotter card" (the brand a seller
// would type, the product line, the kind of product, the models and years, and how to tell a recalled unit).
// Used twice: once at build time for every notice since 1973 (scripts/build-spotter.mjs), and by the installed
// extension for each notice CPSC publishes after the build (extension/src/engine.js, refreshRecalls).
const names = list => (Array.isArray(list) ? list.map(x => x && x.Name).filter(Boolean).join('; ') : '');
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1) + '…'; };

export const SPOTTER_SYSTEM = [
  'You read one U.S. CPSC recall notice and fill in a short card used to match secondhand listings (eBay, Craigslist) to it.',
  'Use only what the notice says. Write names the way a seller would type them in a listing title.',
  'brands: the brand names on the recalled product (for example "Fisher-Price", "Graco", "IKEA"). A store counts only when the product is its own brand. Not a manufacturer nobody would name in a listing. Empty if the notice names no brand.',
  'lines: distinctive product line or model names (for example "Rock \'n Play", "MamaRoo", "MALM"). Not everyday words like "deluxe" or "portable", and not the kind of product. Empty if none.',
  'kind: the kind of product in one to three everyday words, singular (for example "stroller", "crib", "space heater", "infant lounger").',
  'other_names: up to four other everyday names sellers use for the same kind of product (for example "play yard": "playpen", "playard", "pack n play").',
  'models: model, style or item numbers the notice lists, exactly as written. At most twelve.',
  'sold_from and sold_to: the first and last year the recalled units were sold or made, as four-digit years. 0 when the notice does not say.',
  'all_units: true when the recall covers every unit of the named product or line; false when only certain models, colours, dates or serial numbers are recalled.',
  'tell: one sentence, at most 35 words, on how a shopper can tell a recalled unit from one that is not: which models, colours, dates or markings, and where the label is. If all units are recalled, say so.',
  'for_children: true when the product is made for babies or children.',
].join('\n');

export const SPOTTER_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['brands', 'lines', 'kind', 'other_names', 'models', 'sold_from', 'sold_to', 'all_units', 'tell', 'for_children'],
  properties: {
    brands: { type: 'array', items: { type: 'string' } },
    lines: { type: 'array', items: { type: 'string' } },
    kind: { type: 'string' },
    other_names: { type: 'array', items: { type: 'string' } },
    models: { type: 'array', items: { type: 'string' } },
    sold_from: { type: 'integer' }, sold_to: { type: 'integer' },
    all_units: { type: 'boolean' },
    tell: { type: 'string' },
    for_children: { type: 'boolean' },
  },
};

/** One raw CPSC record as the text the model reads. */
export const noticeText = r => [
  `Recall ${r.RecallNumber}, ${String(r.RecallDate || '').slice(0, 10)}`,
  `Title: ${clip(r.Title, 300)}`,
  names(r.Products) ? `Products: ${clip(names(r.Products), 300)}` : '',
  `Description: ${clip(r.Description, 2200)}`,
  names(r.Manufacturers) ? `Manufacturer: ${clip(names(r.Manufacturers), 160)}` : '',
  names(r.Importers) ? `Importer: ${clip(names(r.Importers), 160)}` : '',
  names(r.Distributors) ? `Distributor: ${clip(names(r.Distributors), 160)}` : '',
  names(r.Retailers) ? `Sold at: ${clip(names(r.Retailers), 400)}` : '',
  (r.Images || []).length ? `Photo captions: ${clip((r.Images || []).map(i => i.Caption).filter(Boolean).join('; '), 400)}` : '',
].filter(Boolean).join('\n');
