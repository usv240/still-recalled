// The printable card's language (?lang=es) and its print button. Both languages are in the page; one is shown.
const es = new URLSearchParams(location.search).get('lang') === 'es';
document.body.dataset.lang = es ? 'es' : 'en';
document.documentElement.lang = es ? 'es' : 'en';
if (es) document.title = 'Nunca compre estas de segunda mano: tarjeta de Still Recalled';
const other = document.getElementById('other');
if (other) other.href = es ? 'card.html' : 'card.html?lang=es';
document.getElementById('print').addEventListener('click', () => window.print());
