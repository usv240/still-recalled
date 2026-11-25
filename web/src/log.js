// Every check made on this page, kept in this browser (IndexedDB), never sent anywhere.
//   - The last result can be opened again hours later, when the seller's label photo arrives, and the label check
//     still works on it (AI persona walkthroughs: the page forgot the result, so the label step was lost).
//   - A shop checking items at intake keeps a record: date, what was read, the result, the recall, the label reading,
//     and an optional batch name (a consignor, an intake number). It downloads as CSV or prints.
const DB = 'sr-log', STORE = 'checks', KEEP = 500;

let dbp = null;
const db = () => (dbp ||= new Promise((res, rej) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
}));
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
};

/** All saved checks, newest first. Resolves to [] when this browser keeps no storage. */
export async function allChecks() {
  try { return ((await tx('readonly', s => s.getAll())) || []).sort((a, b) => b.at.localeCompare(a.at)); } catch { return []; }
}

/** Saves one check; returns its id, or '' when it could not be saved. Keeps the newest 500 (the log page says so). */
export async function saveCheck(entry) {
  try {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    await tx('readwrite', s => s.put({ ...entry, id, at: new Date().toISOString() }));
    const all = await allChecks();
    if (all.length > KEEP) await tx('readwrite', s => { for (const c of all.slice(KEEP)) s.delete(c.id); });
    return id;
  } catch { return ''; }
}

/** Adds fields to a saved check (the label reading, when one is added later). */
export async function updateCheck(id, patch) {
  if (!id) return;
  try {
    const all = await allChecks();
    const c = all.find(x => x.id === id);
    if (c) await tx('readwrite', s => s.put({ ...c, ...patch }));
  } catch { /* the result on screen still stands */ }
}

export async function clearChecks() {
  try { await tx('readwrite', s => s.clear()); } catch { /* nothing to clear */ }
}

/** A small JPEG of the shopper's picture (object URL), so the photo pair still shows when the check is reopened. */
export async function thumbOf(url, max = 480) {
  if (!url) return '';
  try {
    const img = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.78);
  } catch { return ''; }
}

/** The batch name new checks are stamped with ("Consignor 482"), kept per browser. */
export const batch = {
  get() { try { return localStorage.getItem('sr-batch') || ''; } catch { return ''; } },
  set(v) { try { localStorage.setItem('sr-batch', String(v || '').slice(0, 60)); } catch { /* fine */ } },
};

const cell = v => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The log as CSV text, one row per check. `cols` gives the header in the page's language. */
export function toCsv(checks, cols) {
  const rows = checks.map(c => {
    const d = new Date(c.at);
    return [d.toLocaleDateString('en-CA'), d.toTimeString().slice(0, 5), c.batch, c.audience, c.title, c.resultText, c.recall, c.noticeUrl, c.action, c.label, c.data]
      .map(cell).join(',');
  });
  return [cols.map(cell).join(','), ...rows].join('\r\n');
}
