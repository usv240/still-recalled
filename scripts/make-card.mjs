// The QR codes on the printable card (web/card.html): one to the English page, one to the Spanish page, each marked
// ?from=card so nothing else is needed to know a visit came from paper. SVG, so they print sharp at any size.
// Usage: node scripts/make-card.mjs
import QRCode from 'qrcode';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('web/card', { recursive: true });
for (const [lang, url] of [['en', 'https://still-recalled.web.app/?from=card'], ['es', 'https://still-recalled.web.app/?lang=es&from=card']]) {
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#111111', light: '#ffffff' } });
  writeFileSync(`web/card/qr-${lang}.svg`, svg);
  console.log(`web/card/qr-${lang}.svg -> ${url}`);
}
