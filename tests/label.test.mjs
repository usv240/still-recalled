import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeLabel, settleReadings, labelCopy } from '../shared/label.mjs';

const card = { codes: ['615573'], from: 2009, to: 2014 };
const read = (...models) => ({ readable: true, model_numbers: models, manufacture_date: '', year: 0, brand: '' });

test('a label one character from a recalled model is not ruled out', () => {
  // A real misread of a CPSC label photo (Little Tikes swing, recall 17096): the cloud read 615573 as 315573.
  const v = judgeLabel(read('315573'), card);
  assert.equal(v.state, 'near');
  assert.equal(v.twin, '615573');
  assert.match(labelCopy(v).title, /One character/);
  assert.notEqual(labelCopy(v).tone, 'plain');
});

test('a clearly different model is not among the listed ones', () => {
  assert.equal(judgeLabel(read('720004'), card).state, 'not_listed');
  assert.equal(judgeLabel(read('615573'), card).state, 'recalled');
  // Short codes never count as near: too many models differ by one character.
  assert.equal(judgeLabel(read('1375'), { codes: ['1374'] }).state, 'not_listed');
});

test('device and cloud readings that disagree cannot clear a listing', () => {
  const v = settleReadings(read('S16578'), read('720004'), card);
  assert.equal(v.state, 'disagree');
  assert.match(labelCopy(v).text, /S16578/);
  // When they agree, the answer stands.
  assert.equal(settleReadings(read('720004'), read('720004'), card).state, 'not_listed');
  // A cloud reading of the recalled model wins over the device's misread.
  assert.equal(settleReadings(read('S16578'), read('615573'), card).state, 'recalled');
  // A device reading one character off is kept even when the cloud read something else.
  assert.equal(settleReadings(read('615578'), read('720004'), card).state, 'near');
});
