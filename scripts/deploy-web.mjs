// Deploys web/ to Firebase Hosting (still-recalled.web.app) from a release build.
// Refuses to deploy if the App Check debug token appears in any file under web/. Restores the development build after.
// Usage: node scripts/deploy-web.mjs   (needs firebase login, or Application Default Credentials for the project)
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npx' && process.platform === 'win32', env: { ...process.env, ...env } });

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
