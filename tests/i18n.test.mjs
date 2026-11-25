// English and Spanish results (0.16.0): the same decisions, the same rules, in either language; never "safe".
import test from 'node:test';
import assert from 'node:assert/strict';
import { setLang, getLang, monthYearOf } from '../shared/i18n.mjs';
import { present, noMatchView, ownerView, sleepLine, cpscReport } from '../shared/present.mjs';
import { labelCopy } from '../shared/label.mjs';

const withLang = (l, fn) => { const was = getLang(); setLang(l); try { return fn(); } finally { setLang(was); } };
const lounger = { id: '1', title: 'Nido para bebé recién nacido' };
const rnp = { id: '2', title: 'Fisher Price Rock n Play' };
const card = { id: '23088', product: 'Rock n Play Sleepers', date: '2023-01-09', all: true, brands: [], codes: [], url: 'https://www.cpsc.gov/x' };

test('Spanish results say the same things', () => withLang('es', () => {
  const a = present(lounger, { level: 'likely', kind: 'banned', banned: { key: 'in_bed_sleeper', label: 'x' } });
  assert.equal(a.badge, 'Nido o cojín para bebé');
  assert.match(a.action, /^No lo compre\./);
  assert.match(a.sleep, /^No es para dormir/);
  // A Spanish listing gets the seller question in Spanish.
  assert.match(a.question, /^Hola, antes de comprarlo/);
  const b = present(rnp, { level: 'likely', kind: 'recall', card });
  assert.equal(b.badge, 'Retirado del mercado');
  assert.match(b.verdict, /enero de 2023/);
  assert.match(b.action, /Todas las unidades/);
  // An English listing keeps the seller question in English: the seller reads it.
  assert.match(b.question, /^Hi, before I buy/);
  // The report to CPSC stays in English.
  const c = present(lounger, { level: 'likely', kind: 'banned', banned: { key: 'crib_bumper', label: 'x' } });
  assert.match(cpscReport(c), /padded crib bumper/i);
  const v = noMatchView({ level: 'none' }, { title: 'Cuna de madera' }, { count: 10490, since: '1973-01-01' });
  assert.equal(v.pill, 'Sin coincidencias');
  assert.ok(v.lines.some(l => /28 de junio de 2011/.test(l)));
  assert.match(ownerView(b).action, /^No lo venda ni lo regale/);
  assert.match(labelCopy({ state: 'recalled', model: 'ST31D11A' }).title, /La etiqueta coincide/);
  assert.equal(monthYearOf('2026-07-01'), 'julio de 2026');
  for (const t of [a.action, a.sleep, b.action, v.line, sleepLine('cuna')]) assert.doesNotMatch(t, /\bes seguro\b/);
}));

test('English stays the default', () => {
  const a = present(lounger, { level: 'likely', kind: 'banned', banned: { key: 'in_bed_sleeper', label: 'x' } });
  assert.equal(a.badge, 'Infant lounger or nest');
});

test('accented Spanish words match (0.16.1)', async () => {
  const { buildIndex } = await import('../shared/shortlist.mjs');
  const { triage } = await import('../shared/triage.mjs');
  const { readFileSync } = await import('node:fs');
  const idx = buildIndex(JSON.parse(readFileSync(new URL('../extension/data/cards.json', import.meta.url), 'utf8')).cards);
  assert.match(sleepLine('Cojín para bebé'), /Not for sleep/);
  assert.match(sleepLine('Moisés para bebé'), /alone, on their back/);
  assert.deepEqual(triage(idx, { title: 'Juego de cuna con protectores acolchados' }).hints.map(h => h.key), ['crib_bumper']);
});
