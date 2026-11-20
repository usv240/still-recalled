// CPSC safety warnings from CPSC's own file (shared/warnings.mjs): parsed into the recall API's record shape, so a
// warning published after the build gets a card the way a new recall does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { warningRecords, warningNotice, parseCsv } from '../shared/warnings.mjs';
import { liveCardsFromCpsc } from '../shared/cards.mjs';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { noticeFromCpsc } from '../shared/notice.mjs';

const HEAD = '"Product Safety Warning Number","Product Safety Warning Date","Product Safety Warning Title","Name of product",Description,"Hazard Description","Consumer Action","Original Product Safety Warning Announcement",Units,Incidents,"Sold At Label","Sold At",Importers,Manufacturers,Distributors,"Manufactured In","Custom Label","Custom Field"';
const row = (n, date, product, extra = '') => `${n},"${date}","CPSC Warns Consumers to Stop Using ${product} Immediately","${product}","<p>The loungers have &quot;Zzzbaby&quot; on a tag, ${extra}</p>","Suffocation hazard","Stop using them, and dispose of them.",,"About 1,000",None,,Amazon,,"Zzzbaby, of China",,China,,`;
const csv = `﻿${HEAD}\n${row('27-099', 'November 19, 2026', 'Zzzbaby Infant Loungers', 'sold in grey')}\n${row('bad', 'November 19, 2026', 'Nothing')}\n`;

test('the warnings file becomes records in the recall API\'s shape', () => {
  assert.equal(parseCsv('a,"b ""c"", d"\ne,f\n')[0][1], 'b "c", d');
  const records = warningRecords(csv);
  assert.equal(records.length, 1);
  const r = records[0];
  assert.equal(r.RecallNumber, 'W27-099');
  assert.equal(r.RecallDate, '2026-11-19');
  assert.equal(r.Products[0].Name, 'Zzzbaby Infant Loungers');
  assert.match(r.Description, /^The loungers have "Zzzbaby" on a tag/);
  assert.equal(r.Remedies[0].Name, 'Stop using them, and dispose of them.');
  assert.equal(warningRecords('').length, 0);
});

test('a warning published after the build is matched on the device, and the cloud check has its text', () => {
  const [record] = warningRecords(csv);
  const spots = new Map([['W27-099', { brands: ['Zzzbaby'], lines: [], kind: 'infant lounger', other_names: ['baby lounger', 'baby nest'], models: [], tell: 'All units.', sold_from: 2025, sold_to: 2026, all_units: true }]]);
  const cards = liveCardsFromCpsc([record], spots, []).map(c => ({ ...c, warning: true, notice: warningNotice(record) }));
  assert.equal(cards.length, 1);
  const hit = shortlist(buildIndex(cards), 'Zzzbaby baby lounger, grey, used twice')[0];
  assert.equal(hit.card.id, 'W27-099');
  assert.equal(hit.card.warning, true);
  const notice = noticeFromCpsc(hit.card.notice);
  assert.equal(notice.id, 'W27-099');
  assert.match(notice.hazard, /Suffocation/);
});
