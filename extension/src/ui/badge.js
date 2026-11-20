// The badge on a flagged listing and its popover. Shared by the content script and the local preview page.
import { detailView } from './detail.js';
import { h } from './dom.js';
import { icon, mark } from './icons.js';
import uiCss from './ui.css';
import contentCss from './content.css';

/** One more than the highest z-index set inside a listing's card (at least 2), capped well below page chrome. */
function layerAbove(el) {
  let top = 1;
  for (const n of [el, ...el.querySelectorAll('*')].slice(0, 400)) {
    const z = parseInt(getComputedStyle(n).zIndex, 10);
    if (Number.isFinite(z) && z > top && z < 10000) top = z;
  }
  return top + 1;
}

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
  // Out of the photo component when the listing is a list item. eBay's photo carousel (November 2026) handles clicks
  // inside it from listeners on the page that run first, and a badge inside it could not be opened (end-to-end test,
  // 2026-11-18). On the listing's own row the badge sits over the same corner of the photo.
  const photo = anchor;
  const row = photo.closest('li');
  if (row && row !== photo && row.contains(photo)) {
    if (getComputedStyle(row).position === 'static') row.style.position = 'relative';
    const place = () => {
      const p = photo.getBoundingClientRect(), r = row.getBoundingClientRect();
      if (!p.width || !r.width) return;
      host.style.top = `${p.top - r.top + 8}px`;
      host.style.left = corner === 'right' ? 'auto' : `${p.left - r.left + 8}px`;
      host.style.right = corner === 'right' ? `${r.right - p.right + 8}px` : 'auto';
    };
    host.style.cssText = `position:absolute;z-index:${layerAbove(row)};`;
    row.prepend(host);
    place();
    host.place = place;   // content.js calls this when the window is resized
    return;
  }
  // Just above everything inside the listing, and below the site's own header. Craigslist scrolls its results under a
  // fixed header, and a top z-index drew the badges over it. The card opens in the top layer (a popover).
  host.style.cssText = `position:absolute;top:8px;${corner === 'right' ? 'right' : 'left'}:8px;z-index:${layerAbove(card.el)};`;
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

/**
 * A quiet pill on a listing that is still being checked, so the wait shows where the check is: the built-in model
 * looking at it on this computer, or the cloud comparing what the computer flagged with the recall notice. Not a
 * warning and not a button: there is nothing to open yet. `stage`: "device" | "cloud".
 */
export function buildPending(stage) {
  const host = document.createElement('still-recalled-badge');
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', {}, uiCss + contentCss));
  const text = h('span', {});
  // Hidden from screen readers: one pill per listing, changing as the page is checked, would be read out over and
  // over. The side panel's progress line says the same once.
  const pill = h('span', { class: 'badge is-pending', 'aria-hidden': 'true' }, h('span', { class: 'dot' }), text);
  host.setStage = s => {
    pill.dataset.stage = s;
    text.textContent = s === 'cloud' ? 'Checking in the cloud' : 'Looking on this computer';
    pill.title = s === 'cloud'
      ? 'Still Recalled: flagged on this computer. Gemini in the cloud is comparing it with the recall notice.'
      : 'Still Recalled: the built-in model is looking at this listing on this computer.';
  };
  host.setStage(stage);
  root.append(pill);
  return host;
}

/** A badge and its popover in a closed shadow root. `onOpenPanel` is called from the popover's panel link. */
export function buildBadge(r, { onOpenPanel, onLabel = null, watch = null, shadowMode = 'closed' } = {}) {
  const host = document.createElement('still-recalled-badge');
  const root = host.attachShadow({ mode: shadowMode });   // 'open' only on the local preview page, for testing
  root.append(h('style', {}, uiCss + contentCss));

  // "manual", with light dismiss done here: an "auto" popover closes whenever the page opens one of its own, and
  // eBay's photo carousel opens one on the same click, so the card never showed (end-to-end test, 2026-11-18).
  const pop = h('div', { class: 'pop', popover: 'manual', role: 'dialog', 'aria-label': `Still Recalled: ${r.badge}` });
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
      watch,
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
  // Light dismiss: a press outside the badge and the card, or Escape, closes it.
  const outside = e => { if (!e.composedPath().includes(host)) pop.hidePopover(); };
  const escape = e => { if (e.key === 'Escape') { pop.hidePopover(); badge.focus(); } };
  pop.addEventListener('toggle', e => {
    if (e.newState === 'open') {
      addEventListener('scroll', follow, { passive: true, capture: true });
      addEventListener('resize', follow);
      addEventListener('pointerdown', outside, true);
      addEventListener('keydown', escape, true);
    } else {
      removeEventListener('scroll', follow, { capture: true });
      removeEventListener('resize', follow);
      removeEventListener('pointerdown', outside, true);
      removeEventListener('keydown', escape, true);
    }
  });

  host.reveal = () => {
    badge.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => { if (!pop.matches(':popover-open')) pop.showPopover(); }, 450);
  };
  root.append(badge, pop);
  return host;
}
