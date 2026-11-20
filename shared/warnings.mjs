// CPSC safety warnings, read from CPSC's own file. When a firm will not recall a hazardous product, CPSC warns the
// public itself ("CPSC Warns Consumers to Stop Using ..."). Those notices are not in the recall API, so they are read
// from the CSV CPSC publishes and shaped like recall records, and the same card and notice code handles them.
// Used at build time (scripts/build-warnings.mjs) and by the installed extension for warnings published later
// (extension/src/engine.js refreshRecalls).

export const WARNINGS_CSV = 'https://www.cpsc.gov/s3fs-public/recall-data/product_safety_warning_listing.csv';
export const WARNINGS_PAGE = 'https://www.cpsc.gov/Warnings';

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const ENT = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', reg: '®', trade: '™', eacute: 'é' };
const plain = s => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? ' ')
  .replace(/https?:\/\/\S+\s+lang=\S*/g, ' ')
  .replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + '…');
const isoDate = s => { const d = new Date(`${s} UTC`); return Number.isNaN(+d) ? '' : d.toISOString().slice(0, 10); };

/** CPSC's warnings file as records in the recall API's shape. Ids are "W" plus CPSC's warning number ("W27-081"). */
export function warningRecords(csv) {
  const rows = parseCsv(String(csv || '').replace(/^﻿/, ''));
  const head = rows[0] || [];
  return rows.slice(1).filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, plain(r[i])]))).map(w => ({
    RecallNumber: `W${w['Product Safety Warning Number']}`,
    RecallDate: isoDate(w['Product Safety Warning Date']),
    Title: w['Product Safety Warning Title'],
    Description: cut(w.Description || '', 2400),
    URL: WARNINGS_PAGE,
    Products: [{ Name: w['Name of product'], NumberOfUnits: w.Units }],
    Hazards: [{ Name: w['Hazard Description'] }],
    Remedies: [{ Name: w['Consumer Action'] }],
    Retailers: w['Sold At'] ? [{ Name: w['Sold At'] }] : [],
    Manufacturers: w.Manufacturers ? [{ Name: w.Manufacturers }] : [],
    Importers: w.Importers ? [{ Name: w.Importers }] : [],
    Distributors: w.Distributors ? [{ Name: w.Distributors }] : [],
    Images: [],
    Warning: true,
  })).filter(r => /^W\d{2}-\d+$/.test(r.RecallNumber) && r.RecallDate && r.Title);
}

/** The record as kept beside a card for the cloud check to read (the recall API has no notice for a warning). */
export function warningNotice(record) {
  return { ...record, Description: cut(record.Description || '', 1700) };
}
