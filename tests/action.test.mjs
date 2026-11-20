// The card's "what to do" line and the no-match line: every flag ends in an action, and nothing reads as an all-clear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionLine, noMatchLine, isPractice, present } from '../shared/present.mjs';

const listing = { id: 'x', title: 'Thing', url: 'https://www.ebay.com/itm/123456789012' };

test('a likely flag says what to do, and a whole-product recall says every unit', () => {
  assert.match(actionLine({ kind: 'recall', level: 'likely', recall: { all: true } }), /^Don't buy it\. Every unit/);
  assert.match(actionLine({ kind: 'recall', level: 'likely', recall: { all: false } }), /unless the seller's label/);
  assert.match(actionLine({ kind: 'banned', level: 'likely', banned: { key: 'crib_bumper' } }), /^Skip this one/);
  assert.match(actionLine({ kind: 'banned', level: 'likely', banned: { key: 'in_bed_sleeper' } }), /^Never use it for sleep/);
  assert.match(actionLine({ kind: 'banned', level: 'possible', banned: { key: 'crib_bumper' } }), /^Ask the seller/);
});

test('present() carries the action line, and type advice leads with the sleep rule', () => {
  const r = present(listing, { level: 'likely', kind: 'banned', banned: { key: 'in_bed_sleeper', label: 'lounger' } });
  assert.ok(r.action);
  assert.match(r.banned.advice, /^Never use it for sleep/);
  assert.doesNotMatch(r.banned.advice, /If you buy it/);
});

test('the no-match line never reads as safe', () => {
  const s = noMatchLine('10,089', 'January 1973');
  assert.match(s, /doesn't mean it's safe/);
  assert.doesNotMatch(s, /doesn't look like a risky/);
});

test('practice listings are recognised, so the card never opens the real CPSC form for them', () => {
  assert.equal(isPractice({ listing: { url: 'https://still-recalled.web.app/try/item/crib-bumper.html' } }), true);
  assert.equal(isPractice({ listing }), false);
});
