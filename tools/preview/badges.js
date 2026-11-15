// Development only: lays out a fixture's listings as a grid and attaches the real badges. ?fixture=mixed&open=<n>
import { addFonts, buildBadge, attachBadge } from '../../extension/src/ui/badge.js';

const q = new URLSearchParams(location.search);
const state = await (await fetch(`/tools/fixtures/${q.get('fixture') || 'mixed'}.json`)).json();
document.getElementById('h').textContent = `Results for “${state.scope}”`;
addFonts(p => `/extension/${p}`);

const grid = document.getElementById('grid');
const rows = Object.values(state.results).sort((a, b) => a.order - b.order);
const hosts = [];
for (const r of rows) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  // Real listing links, so a badge click that leaks through to the link shows up as a navigation.
  a.href = q.get('links') === 'off' ? '#' : (r.listing.url || '#');
  const frame = document.createElement('div');
  frame.className = 'img';
  const img = document.createElement('img');
  img.src = r.listing.image; img.alt = '';
  frame.append(img);
  const t = document.createElement('span'); t.className = 't'; t.textContent = r.listing.title;
  const p = document.createElement('span'); p.className = 'p'; p.textContent = r.listing.price;
  a.append(frame, t, p); li.append(a); grid.append(li);
  if (r.level === 'likely' || r.level === 'possible') {
    const host = buildBadge(r, { onOpenPanel: () => console.log('[preview] open panel for', r.id), shadowMode: 'open' });
    attachBadge(host, { el: li, inline: false });
    hosts.push(host);
  }
}
const open = q.get('open');
if (open != null && hosts[Number(open)]) setTimeout(() => hosts[Number(open)].reveal(), 300);
