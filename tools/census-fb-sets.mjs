// Builds the two listing sets of docs/accuracy.md, section 34, from the Facebook Marketplace census: every listing the
// photo review called an inclined sleeper among those the word rules left open (census-fb-inclined), and a fixed random
// 20 of the "baby rocker sleeper" results it called something else (census-fb-rockers). Also a blind sheet of both,
// shuffled, for a second reviewer. Usage: node tools/census-fb-sets.mjs [E:/sr-census-fb]
import { readFileSync, writeFileSync } from 'node:fs';
const read = f => JSON.parse(readFileSync(f, 'utf8'));
const census = read('tools/census-facebook.json'), { labels } = read('tools/census-facebook-open-labels.json');
const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)(34);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const row = (id, search) => { const l = census.listings[id]; return { id, site: 'facebook', url: l.url, title: l.title.replace(/^Just listed,\s*/i, ''), price: l.price || '', image: l.image, search }; };
const ids = Object.keys(labels).sort();
const inclined = ids.filter(id => labels[id].type === 'inclined_sleeper');
const others = shuffle(ids.filter(id => labels[id].is_it === 'no' && census.listings[id].searches.some(s => s.endsWith(': baby rocker sleeper')))).slice(0, 20);
writeFileSync('tools/census-fb-inclined-listings.json', JSON.stringify({ 'census facebook: inclined, left open by words': inclined.map(id => row(id, 'census facebook: inclined, left open by words')) }, null, 1));
writeFileSync('tools/census-fb-rockers-listings.json', JSON.stringify({ 'census facebook: other rockers': others.map(id => row(id, 'census facebook: other rockers')) }, null, 1));
writeFileSync('tools/census-fb-blind.json', JSON.stringify({ order: shuffle([...inclined, ...others]) }, null, 1));
console.log(`${inclined.length} inclined, ${others.length} others`);
