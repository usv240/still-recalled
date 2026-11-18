// Development only: the cloud calls the extension makes through Firebase AI Logic, made from Node, so test tools can
// run the real cloud step (same prompts and schemas, from shared/) without a browser. Uses the App Check debug token
// in extension/src/appcheck-debug.local.js, which never ships.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = readFileSync(path.join(root, 'extension/src/firebase-config.js'), 'utf8');
const key = cfg.match(/apiKey:\s*'([^']+)'/)[1], app = cfg.match(/appId:\s*'([^']+)'/)[1];
const debugToken = readFileSync(path.join(root, 'extension/src/appcheck-debug.local.js'), 'utf8').match(/['"]([0-9a-f-]{36})['"]/i)[1];
export const CLOUD_MODELS = ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'];

let token = '', tokenAt = 0;
async function appCheck() {
  if (Date.now() - tokenAt < 40 * 60 * 1000) return token;
  const r = await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/still-recalled/apps/${app}:exchangeDebugToken?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debugToken }) });
  if (!r.ok) throw new Error(`App Check exchange ${r.status}`);
  token = (await r.json()).token; tokenAt = Date.now();
  return token;
}

/** A photo as an inline part. Returns null when it can't be fetched. */
export async function imagePart(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0] || (/\.webp/.test(url) ? 'image/webp' : 'image/jpeg');
    if (!/^image\//.test(type)) return null;
    return { inlineData: { mimeType: type, data: Buffer.from(await res.arrayBuffer()).toString('base64') } };
  } catch { return null; }
}

/** One JSON answer. `parts`: strings and inlineData parts, as the browser SDK takes them. Returns { answer, model }. */
export async function cloudJson({ system, schema, parts, models = CLOUD_MODELS, temperature }) {
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts: parts.map(p => (typeof p === 'string' ? { text: p } : p)) }],
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, ...(temperature === undefined ? {} : { temperature }) },
  };
  let last = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const model of models) {
      const res = await fetch(`https://firebasevertexai.googleapis.com/v1beta/projects/still-recalled/locations/global/publishers/google/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, 'X-Firebase-AppCheck': await appCheck() },
        body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
      }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
      if (res.ok) {
        const j = await res.json();
        try { return { answer: JSON.parse(j.candidates[0].content.parts.map(p => p.text || '').join('')), model }; } catch { last = 'unreadable answer'; continue; }
      }
      last = `${res.status} ${(await res.text()).slice(0, 160)}`;
      if (![0, 429, 500, 502, 503, 504].includes(res.status)) throw new Error(last);
    }
    await new Promise(ok => setTimeout(ok, 2000 * 2 ** attempt));
  }
  throw new Error(last);
}
