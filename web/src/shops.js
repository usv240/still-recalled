// The shops page: English or Spanish (?lang=es, then the visitor's last choice on this site, then the browser's).
import { mark } from '../../extension/src/ui/icons.js';
document.getElementById('mark').replaceWith(mark(20));
let lang = new URLSearchParams(location.search).get('lang');
if (lang !== 'es' && lang !== 'en') {
  try { lang = localStorage.getItem('sr-lang'); } catch { lang = null; }
  if (lang !== 'es' && lang !== 'en') lang = /^es\b/i.test(navigator.language || '') ? 'es' : 'en';
}
document.body.dataset.lang = lang;
document.documentElement.lang = lang;
document.title = lang === 'es' ? 'Still Recalled para tiendas de segunda mano' : 'Still Recalled for resale shops';
const other = document.getElementById('other');
other.href = lang === 'es' ? 'shops.html?lang=en' : 'shops.html?lang=es';
// The links into the tool keep the language.
if (lang === 'es') for (const a of document.querySelectorAll('a[href^="./"], a[href^="card.html"]')) {
  const u = new URL(a.getAttribute('href'), location.href);
  u.searchParams.set('lang', 'es');
  a.href = u.pathname.split('/').pop() + u.search;
}
