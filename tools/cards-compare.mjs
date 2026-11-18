// Compares two recall card sets on the test listings, with the word rules alone: which listings get a recall
// candidate, how strong, and which recall. Shows what a change to the recall data does before any model runs.
// The old side runs the code and cards of the last release, saved in a folder (shared/*.mjs and cards.json).
// Usage: node tools/cards-compare.mjs <old folder> <new cards.json>
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildIndex, shortlist } from '../shared/shortlist.mjs';
import { notTheProduct } from '../shared/banned.mjs';

const [oldFile, newFile] = process.argv.slice(2);
const old = { ...(await import(pathToFileURL(`${oldFile}/shared/shortlist.mjs`).href)), ...(await import(pathToFileURL(`${oldFile}/shared/banned.mjs`).href)) };
const A = old.buildIndex(JSON.parse(readFileSync(`${oldFile}/cards.json`, 'utf8')).cards);
const B = buildIndex(JSON.parse(readFileSync(newFile, 'utf8')).cards);
const listings = ['eval', 'fresh', 'third'].filter(s => existsSync(`tools/${s}-listings.json`))
  .flatMap(s => Object.values(JSON.parse(readFileSync(`tools/${s}-listings.json`, 'utf8'))).flat());
const top = (idx, l) => (idx === A ? (old.notTheProduct(l.title) ? null : old.shortlist(A, l.title)[0] || null) : (notTheProduct(l.title) ? null : shortlist(idx, l.title)[0] || null));
const lost = [];
const count = { old: {}, new: {} };
const gained = [];
for (const l of listings) {
  const a = top(A, l), b = top(B, l);
  if (a) count.old[a.strength] = (count.old[a.strength] || 0) + 1;
  if (b) count.new[b.strength] = (count.new[b.strength] || 0) + 1;
  if (a && !b) lost.push(`${a.strength} ${a.card.id} ${a.card.product.slice(0, 50)} <- ${l.title.slice(0, 60)}`);
  if (b && (!a || a.card.id !== b.card.id)) gained.push({ title: l.title, was: a && `${a.strength} ${a.card.id}`, now: `${b.strength} ${b.card.id} ${b.card.date.slice(0, 4)} ${b.card.product.slice(0, 60)}` });
}
console.log(`${listings.length} listings | with a recall candidate: old ${JSON.stringify(count.old)} new ${JSON.stringify(count.new)}`);
console.log(`${gained.length} listings get a different or new candidate:`);
for (const g of gained.slice(0, Number(process.env.SHOW || 60))) console.log(`  ${g.now.padEnd(78)} <- ${g.title.slice(0, 60)}${g.was ? `  (was ${g.was})` : ''}`);
console.log(`${lost.length} listings lose their candidate:`);
for (const x of lost) console.log('  ' + x);
