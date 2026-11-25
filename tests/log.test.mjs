// The intake log's CSV (web/src/log.js): one row per check, quoted where needed, and never a spreadsheet formula.
import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../web/src/log.js';

test('the CSV quotes commas and blocks formulas', () => {
  const csv = toCsv([{ at: '2026-11-25T15:04:00Z', batch: 'Consignor 482', audience: 'owner', title: '=HYPERLINK("x"), crib set', resultText: 'Padded crib bumper',
    recall: '', noticeUrl: '', action: "Don't sell it, or give it away.", label: '', data: '10,490 CPSC notices' }], ['Date', 'Time', 'Batch', 'Who', 'Item', 'Result', 'Recall', 'Notice', 'What to do', 'Label', 'List']);
  const [head, row] = csv.split('\r\n');
  assert.equal(head, 'Date,Time,Batch,Who,Item,Result,Recall,Notice,What to do,Label,List');
  assert.match(row, /^2026-11-25,/);
  assert.match(row, /"'=HYPERLINK\(""x""\), crib set"/);
  assert.match(row, /"Don't sell it, or give it away\."/);
});
