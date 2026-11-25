// Development check of yard-sale mode's Live flow without a phone: Firebase AI Logic's Live endpoint (Agent Platform,
// us-central1), App Check from the local debug token, the shared prompt and function (shared/live.mjs), and the
// lookup answered by the same code the phone runs. Words only: no picture or sound.
import { readFileSync } from 'node:fs';
import { buildIndex } from '../shared/shortlist.mjs';
import { LIVE_SYSTEM, LIVE_TOOL, liveLookup } from '../shared/live.mjs';

const say = process.argv[2] || 'On the table there is a pink Fisher-Price Rock n Play sleeper, and next to it a padded crib bumper set with no brand on it.';
const cards = JSON.parse(readFileSync('web/data/cards.json', 'utf8'));
const index = buildIndex(Array.isArray(cards) ? cards : cards.cards || Object.values(cards)[0]);
const dbg = (readFileSync('extension/src/appcheck-debug.local.js', 'utf8').match(/APPCHECK_DEBUG_TOKEN\s*=\s*'([^']+)'/) || [])[1];
const cfg = readFileSync('extension/src/firebase-config.js', 'utf8');
const appId = cfg.match(/appId:\s*'([^']+)'/)[1], apiKey = cfg.match(/apiKey:\s*'([^']+)'/)[1];
const tok = (await (await fetch(`https://firebaseappcheck.googleapis.com/v1/projects/still-recalled/apps/${appId}:exchangeDebugToken?key=${apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ debugToken: dbg }) })).json()).token;

const loc = 'us-central1', model = 'gemini-live-2.5-flash-native-audio';
const ws = new WebSocket(`wss://firebasevertexai.googleapis.com/ws/google.firebase.vertexai.v1beta.LlmBidiService/BidiGenerateContent/locations/${loc}?key=${apiKey}`, { headers: { 'X-Firebase-AppCheck': tok } });
const t0 = Date.now();
const log = s => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${s}`);
let said = '';
const done = new Promise(res => {
  const stop = setTimeout(() => { log('time limit'); ws.close(); res(); }, 45000);
  ws.onopen = () => ws.send(JSON.stringify({ setup: {
    model: `projects/still-recalled/locations/${loc}/publishers/google/models/${model}`,
    generationConfig: { responseModalities: ['AUDIO'], temperature: 0.3 },
    outputAudioTranscription: {},
    systemInstruction: { parts: [{ text: LIVE_SYSTEM }] },
    tools: [{ functionDeclarations: [LIVE_TOOL] }],
  } }));
  ws.onmessage = async m => {
    const d = JSON.parse(typeof m.data === 'string' ? m.data : await m.data.text());
    if (d.setupComplete) { log('connected'); ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: `I am at a yard sale. ${say}` }] }], turnComplete: true } })); }
    if (d.toolCall) {
      const responses = d.toolCall.functionCalls.map(c => {
        const out = liveLookup(index, c.args || {});
        log(`lookup_recalls(${JSON.stringify(c.args)}) answered here: recalls ${out.shown.recalls.map(r => r.card.id).join(', ') || 'none'}; banned types ${out.shown.types.map(t => t.key).join(', ') || 'none'}`);
        return { id: c.id, name: c.name, response: out.response };
      });
      ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    }
    const t = d.serverContent && d.serverContent.outputTranscription && d.serverContent.outputTranscription.text;
    if (t) said += t;
    if (d.serverContent && d.serverContent.turnComplete && said) { log(`Gemini said: ${said.trim()}`); clearTimeout(stop); ws.close(); res(); }
  };
  ws.onclose = e => { if (e.code !== 1000 && e.code !== 1005) log(`closed ${e.code} ${e.reason}`); clearTimeout(stop); res(); };
});
await done;
