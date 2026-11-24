// The practice page without the extension: show the badges and cards a real run of the extension put on this page,
// recorded by the end-to-end test (tools/e2e.mjs writes try/recorded.json). A judge or a parent on a phone sees what
// the extension does without installing it. It says plainly that it is a recording, with its date and version, and it
// steps aside as soon as the real extension is on the page. No model is called here.
import { addFonts, buildBadge, attachBadge } from '../../extension/src/ui/badge.js';
import { h } from '../../extension/src/ui/dom.js';

const root = document.documentElement;
const extensionOn = () => root.dataset.stillRecalled === 'on';
const day = iso => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

async function start() {
  const slot = document.getElementById('sr-preview');
  if (!slot) return;
  const rec = await fetch('recorded.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null), () => null);
  if (!rec || !Array.isArray(rec.results) || !rec.results.length) return;

  const hosts = [];
  const button = h('button', { class: 'btn btn-secondary', type: 'button', 'aria-pressed': 'false' }, 'Show the badges without installing');
  const note = h('p', { class: 'note' },
    `A recording of the extension's own run on this page, ${day(rec.at)} (version ${rec.version}): ${rec.results.length} of the 17 listings flagged. Click a badge to open its card. Install the extension to see it check live.`);
  const show = () => {
    addFonts(p => `../${p}`);
    for (const r of rec.results) {
      const link = document.querySelector(`.item a.title[href$="/${r.listing.id}.html"]`);
      const card = link && link.closest('li');
      if (!card) continue;
      const host = buildBadge(r, { onOpenPanel: null });
      attachBadge(host, { el: card, inline: false });
      hosts.push(host);
    }
    button.textContent = 'Hide the recorded badges';
    button.setAttribute('aria-pressed', 'true');
  };
  const hide = () => {
    for (const host of hosts.splice(0)) host.remove();
    button.textContent = 'Show the badges without installing';
    button.setAttribute('aria-pressed', 'false');
  };
  button.addEventListener('click', () => (hosts.length ? hide() : show()));
  slot.replaceChildren(h('div', { class: 'preview' }, button, note));
  slot.hidden = false;

  // The real extension arrived: its badges are the ones that count.
  new MutationObserver(() => { if (extensionOn()) { hide(); slot.hidden = true; } })
    .observe(root, { attributes: true, attributeFilter: ['data-still-recalled'] });
  if (extensionOn()) slot.hidden = true;
}
start();
