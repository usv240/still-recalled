// Deploys web/ to Firebase Hosting (still-recalled.web.app) from a release build.
// Refuses to deploy if the App Check debug token appears in any file under web/. Restores the development build after.
// Usage: node scripts/deploy-web.mjs   (needs firebase login, or Application Default Credentials for the project)
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npx' && process.platform === 'win32', env: { ...process.env, ...env } });

// The site offers the packed extension for download. Deploy the one packed for this version, never an older copy
// (0.17.1 first went out with 0.17.0's zip still in web/download).
const version = async f => JSON.parse(await readFile(f, 'utf8')).version;
const want = await version('extension/manifest.json');
const packed = await version('dist/still-recalled-extension/manifest.json').catch(() => '');
if (packed !== want) throw new Error(`dist holds extension ${packed || 'nothing'}, the source is ${want}: run node scripts/pack-extension.mjs first`);
await mkdir('web/download', { recursive: true });
await copyFile('dist/still-recalled-extension.zip', 'web/download/still-recalled-extension.zip');
// The Android app offered on the site is the one a GitHub release must carry too: keep dist's copy the same file
// (0.17.1's release first went out with an older app from dist).
await copyFile('web/download/still-recalled-android.apk', 'dist/still-recalled-android.apk');

run(process.execPath, ['build.mjs'], { RELEASE: '1' });
let token = '';
try { token = ((await readFile('extension/src/appcheck-debug.local.js', 'utf8')).match(/'([0-9A-F-]{36})'/i) || [])[1] || ''; } catch {}
const files = [];
const walk = async dir => { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? (e.name !== 'src' && await walk(p)) : files.push(p); } };
await walk('web');
for (const f of files) if (token && (await readFile(f, 'latin1')).includes(token)) throw new Error(`debug token found in ${f}; not deploying`);
console.log(`${files.length} files checked: no debug token`);
try {
  run('npx', ['-y', 'firebase-tools@latest', 'deploy', '--only', 'hosting', '--project', 'still-recalled', '--non-interactive']);
} finally {
  run(process.execPath, ['build.mjs']);
}
