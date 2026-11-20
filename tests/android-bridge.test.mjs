// The Android app's rules engine (android/app/src/main/assets/engine.js, built by build.mjs), run the way the app runs
// it: one script, then the card chunks, then calls with JSON in and JSON strings out. The model answers are written
// here by hand; the app gets them from Firebase AI Logic.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const assets = new URL('../android/app/src/main/assets/', import.meta.url);
const ctx = vm.createContext({});
const call = (expr) => JSON.parse(vm.runInContext(expr, ctx));
const lit = v => JSON.stringify(v);

before(() => {
  assert.ok(existsSync(new URL('engine.js', assets)), 'run node build.mjs first');
  vm.runInContext(readFileSync(new URL('engine.js', assets), 'utf8'), ctx);
  for (const f of readdirSync(new URL('cards/', assets)).sort()) vm.runInContext(`SR.addCards(${readFileSync(new URL(`cards/${f}`, assets), 'utf8')})`, ctx);
});

test('every card chunk stays well under the sandbox limit for one evaluation', () => {
  for (const f of readdirSync(new URL('cards/', assets))) assert.ok(readFileSync(new URL(`cards/${f}`, assets)).length < 400_000, f);
  assert.ok(call('SR.counts()').base > 10_000);
});

test('a Rock n Play listing: words, the device look, the cloud confirmation, the result', () => {
  const listing = call(`SR.listingFromText(${lit("Fisher-Price Rock 'n Play sleeper, pink")})`);
  const t = call(`SR.triage(${lit(listing)})`);
  assert.ok(t.needsEyes);
  assert.ok(t.candidate, 'a recall candidate from the words');
  assert.match(t.words, /Possible match/);
  const prompt = call(`SR.judgeText(${lit(listing)}, ${lit(t)})`);
  assert.match(prompt, /Rock 'n Play/);

  const device = { what_is_for_sale: 'the_product', product_kind: 'infant sleeper', same_kind_as_recalled: true, recalled_unit: 'cannot_tell', banned_type: 'inclined_sleeper' };
  const look = call(`SR.afterLook(${lit(device)}, ${lit(t)}, { secondOpinion: true })`);
  assert.equal(look.needsCloud, true);

  const parts = call(`SR.confirmParts(${lit(listing)}, null, false, false)`);
  assert.ok(parts.every(p => typeof p === 'string'));
  assert.ok(!parts.some(p => p.startsWith('\u0000')), 'no photo slots without photos');

  const cloud = { what_is_for_sale: 'the_product', matches_recall: 'yes', banned_type: 'inclined_sleeper', evidence: 'An inclined sleeper.', check_before_buying: 'Check the label.', where: [] };
  const how = { device: true, deviceLevel: look.deviceLevel, cloud: { model: 'test', answer: cloud } };
  const r = call(`SR.finish(${lit(listing)}, ${lit(look.device)}, ${lit(cloud)}, ${lit(t.hints)}, ${lit(how)})`);
  assert.ok(['likely', 'possible'].includes(r.level));
  assert.ok(r.badge && r.verdict && r.question);
});

test('photo slots come back in order when there are photos', () => {
  const listing = call(`SR.listingFromText(${lit('Graco baby swing')})`);
  const record = { RecallNumber: '00001', RecallDate: '2020-01-01', Title: 'Test recall', Products: [{ Name: 'Swing' }], Description: 'A swing.', Images: [{ URL: 'https://www.cpsc.gov/x.jpg' }], URL: 'https://www.cpsc.gov/x' };
  const parts = call(`SR.confirmParts(${lit(listing)}, ${lit(record)}, true, true)`);
  assert.deepEqual(parts.filter(p => p.startsWith('\u0000')), ['\u0000LISTING_PHOTO', '\u0000RECALL_PHOTO']);
  assert.equal(call(`SR.noticeImage(${lit(record)})`), 'https://www.cpsc.gov/x.jpg');
});

test('an ordinary listing needs no model', () => {
  const listing = call(`SR.listingFromText(${lit('Wooden building blocks, painted')})`);
  const t = call(`SR.triage(${lit(listing)})`);
  assert.equal(t.needsEyes, false);
  assert.equal(call(`SR.wordsOnly(${lit(listing)}, ${lit(t)})`).level, 'none');
});

test('label: a reading of a recalled model stands; the device cannot clear on its own', () => {
  const recall = { codes: ['80271'], from: 2018, to: 2020 };
  const v = call(`SR.judgeLabel(${lit({ readable: true, model_numbers: ['80271'], manufacture_date: '', year: 2019, brand: '' })}, ${lit(recall)})`);
  assert.equal(v.state, 'recalled');
  assert.ok(call(`SR.labelCopy(${lit(v)})`).title);
});

test('live recalls and the watch', () => {
  const records = JSON.parse(readFileSync(new URL('./fixtures/cpsc-2026-11-12.json', import.meta.url), 'utf8'));
  const huffy = { brands: ['Huffy', 'Buzz Bicycles'], lines: ['Cerana T2'], kind: 'e-trike', other_names: ['electric trike'], models: ['E4004'], sold_from: 2023, sold_to: 2026, all_units: false, tell: 'Model E4004.', for_children: false };
  // As if built before these: none of the bundled cards is dropped here, so take a record the bundle cannot know.
  const fake = { ...records.find(r => String(r.RecallNumber) === '27086'), RecallNumber: 'X27086' };
  const unknown = call(`SR.unknown(${lit([fake])})`);
  assert.equal(unknown.length, 1);
  assert.match(call(`SR.noticeText(${lit(fake)})`), /E4004/);
  const cards = call(`SR.liveCards(${lit(unknown)}, ${lit({ X27086: huffy })})`);
  assert.equal(cards.length, 1);
  call(`SR.setLive(${lit(cards)})`);
  const hits = call(`SR.watchHits(${lit([{ id: 'a', title: 'Buzz Bicycles Cerana T2 e-trike E4004' }, { id: 'b', title: 'Wooden blocks' }])}, ${lit(['X27086'])})`);
  assert.deepEqual(hits, { a: 'X27086' });
  assert.ok(call('SR.recentInfant(6)').length === 6);
  call('SR.setLive([])');
});

test('the example listing (made up, VEVOR lounger) is matched by its words to recall 26591, which covers every unit', () => {
  const listing = call(`SR.listingFromText(${lit('VEVOR baby lounger nest, snow deer print. Portable newborn lounger with pillow.')})`);
  const t = call(`SR.triage(${lit(listing)})`);
  assert.ok(t.needsEyes);
  assert.equal(t.candidate?.card?.id, '26591');
  assert.equal(t.candidate.card.all, true);
});
