// The badge on a flagged listing and its popover. Shared by the content script and the local preview page.
import { detailView } from './detail.js';
import { h } from './dom.js';
import { icon, mark } from './icons.js';
import uiCss from './ui.css';
import contentCss from './content.css';

/**
 * Place a badge on a card: over the photo's top-left corner, or above the title on an item page. Craigslist prints the
 * price in the photo's top-left corner, so there the badge takes the top-right one.
 */
export function attachBadge(host, card, { corner = 'left' } = {}) {
  if (card.inline) {
    host.style.cssText = 'display:block;margin:0 0 10px;';
    card.el.before(host);
    return;
  }
  let anchor = anchorFor(card);
  // Sit beside the listing's link, not inside it. Some sites (Craigslist) route link clicks from a capture-phase
  // listener that runs before any handler on the badge, so a badge inside the link would open the listing.
  const link = anchor.closest('a');
  if (link && link.parentElement && link.parentElement !== document.body) anchor = link.parentElement;
  if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
  // Just above the listing's photo, and below the site's own header: Craigslist scrolls its results under a fixed
  // header, and a top z-index drew the badges over it. The card opens in the top layer (a popover), so it needs none.
  host.style.cssText = `position:absolute;top:8px;${corner === 'right' ? 'right' : 'left'}:8px;z-index:2;`;
  anchor.prepend(host);
}

let fontsAdded = false;
/** Declare the face on the page: @font-face does not apply from inside a shadow root. */
export function addFonts(urlOf) {
  if (fontsAdded) return;
  fontsAdded = true;
  // @font-face does not apply from inside a shadow root, so the face is declared on the page under a private name.
  const face = (file, weight) => `@font-face{font-family:"SR Geist";src:url("${urlOf(`fonts/${file}`)}") format("woff2");font-weight:${weight};font-display:swap}`;
  document.head.append(h('style', { 'data-still-recalled': '' }, face('Geist-Regular.woff2', 400) + face('Geist-Medium.woff2', 500) + face('Geist-SemiBold.woff2', 600)));
}

/** The element the badge sits on: the listing photo's frame, or above the title on an item page. */
export function anchorFor(card) {
  if (card.inline) return card.el;
  let best = null, area = 0;
  for (const img of card.el.querySelectorAll('img')) {
    const r = img.getBoundingClientRect();
    if (r.width * r.height > area) { best = img; area = r.width * r.height; }
  }
  return (best && best.parentElement) || card.el;
}

/** A badge and its popover in a closed shadow root. `onOpenPanel` is called from the popover's panel link. */
export function buildBadge(r, { onOpenPanel, onLabel = null, shadowMode = 'closed' } = {}) {
  const host = document.createElement('still-recalled-badge');
  const root = host.attachShadow({ mode: shadowMode });   // 'open' only on the local preview page, for testing
  root.append(h('style', {}, uiCss + contentCss));

  const pop = h('div', { class: 'pop', popover: 'auto', role: 'dialog', 'aria-label': `Still Recalled: ${r.badge}` });
  const badge = h('button', { class: `badge ${r.level === 'likely' ? 'is-likely' : 'is-possible'}`, type: 'button', 'aria-haspopup': 'dialog' },
    icon('alert', { size: 14 }), r.badge);

  const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => pop.hidePopover());
  pop.append(
    h('div', { class: 'pop-head' }, h('span', { class: 'pop-brand' }, mark(16), 'Still Recalled'), close),
    detailView(r, {
      compact: true,
      onOpenPanel,
      onLabel,
    }),
  );

  // The badge sits inside the listing's link. Clicks on it, or on plain text in the popover, must not open the
  // listing; clicks on the popover's own links and buttons keep their behaviour.
  // Chrome still follows the surrounding link when a button inside it is clicked (tested on the preview page), so
  // every click in here cancels the default action, except on the popover's own links, which open in a new tab.
  // Stopping propagation keeps the page's own handlers (card tracking, script navigation) out of it.
  const ownLink = e => e.composedPath().some(n => n instanceof Element && n.tagName === 'A' && root.contains(n));
  const guard = e => {
    e.stopPropagation();
    if (e.type === 'click' && !ownLink(e)) e.preventDefault();
  };
  // The badge stays the popover's invoker, so light dismiss treats it as inside the popover; the toggle itself is
  // done here because cancelling the click also cancels the built-in one.
  badge.popoverTargetElement = pop;
  for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'auxclick']) {
    badge.addEventListener(type, guard);
    pop.addEventListener(type, guard);
  }
  badge.addEventListener('click', () => pop.togglePopover());

  function place() {
    const b = badge.getBoundingClientRect();
    const w = Math.min(344, innerWidth - 24);
    const left = Math.max(12, Math.min(b.left, innerWidth - w - 12));
    const below = innerHeight - b.bottom - 12;
    const above = b.top - 12;
    const upward = below < 360 && above > below;
    pop.style.width = `${w}px`;
    pop.style.left = `${left}px`;
    pop.style.top = upward ? 'auto' : `${b.bottom + 8}px`;
    pop.style.bottom = upward ? `${innerHeight - b.top + 8}px` : 'auto';
    pop.style.maxHeight = `${Math.min(600, (upward ? above : below) - 8)}px`;
    pop.style.setProperty('--origin', `${b.left - left + 12}px ${upward ? '100%' : '0'}`);
  }
  let raf = 0;
  const follow = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
  pop.addEventListener('beforetoggle', e => { if (e.newState === 'open') place(); });
  pop.addEventListener('toggle', e => {
    if (e.newState === 'open') {
      addEventListener('scroll', follow, { passive: true, capture: true });
      addEventListener('resize', follow);
    } else {
      removeEventListener('scroll', follow, { capture: true });
      removeEventListener('resize', follow);
    }
  });

  host.reveal = () => {
    badge.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => { if (!pop.matches(':popover-open')) pop.showPopover(); }, 450);
  };
  root.append(badge, pop);
  return host;
}
