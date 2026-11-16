// Packs the extension for release: dist/still-recalled-extension/ (load unpacked) and a .zip of it.
// Release build: no App Check debug token, no developer pages, no localhost permission. Ends by checking that the
// token from src/appcheck-debug.local.js appears in no packed file, then restores the development build.
// Usage: node scripts/pack-extension.mjs [--store]
//   --store  the Chrome Web Store upload: dist/still-recalled-store.zip, without the manifest "key" (the store assigns
//            its own ID and rejects a key). Add that ID to extensionIds in src/firebase-config.js and to the
//            frame-ancestors header in firebase.json, then redeploy the site, so the store copy gets App Check tokens.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const src = path.resolve('extension');
const out = path.resolve(process.argv.includes('--store') ? 'dist/still-recalled-store' : 'dist/still-recalled-extension');
const zip = path.resolve(process.argv.includes('--store') ? 'dist/still-recalled-store.zip' : 'dist/still-recalled-extension.zip');
const build = env => execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit', env: { ...process.env, ...env } });

build({ RELEASE: '1' });
await rm(out, { recursive: true, force: true });
await rm(zip, { force: true });
await mkdir(out, { recursive: true });

const manifest = JSON.parse(await readFile(path.join(src, 'manifest.json'), 'utf8'));
manifest.host_permissions = manifest.host_permissions.filter(h => !/localhost|127\.0\.0\.1/.test(h));
// Only the developer page (left out below) injects scripts; the release asks for no permission it does not use.
manifest.permissions = manifest.permissions.filter(p => p !== 'scripting' && p !== 'activeTab');
const store = process.argv.includes('--store');
if (store) delete manifest.key;
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));

const copy = (rel, opts) => cp(path.join(src, rel), path.join(out, rel), { recursive: true, ...opts });
await copy('panel.html');
await copy('offscreen.html');
for (const f of ['background.js', 'panel.js', 'offscreen.js', 'content.js']) await copy(`build/${f}`);
await copy('src/ui', { filter: s => !/\.js$/.test(s) || (s.endsWith('ui') && !s.endsWith('.js')) });
await copy('fonts');
await copy('icons');
await copy('data/cards.json');
await copy('data/meta.json');

// The token must not be anywhere in the package.
let token = '';
try { token = ((await readFile(path.join(src, 'src/appcheck-debug.local.js'), 'utf8')).match(/'([0-9A-F-]{36})'/i) || [])[1] || ''; } catch {}
const files = [];
const walk = async dir => { for (const e of await readdir(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? await walk(p) : files.push(p); } };
await walk(out);
for (const f of files) if (token && (await readFile(f, 'latin1')).includes(token)) throw new Error(`debug token found in ${f}`);
console.log(`${files.length} files packed; debug token ${token ? 'checked: absent' : 'not configured'}`);

// Windows ships bsdtar, which writes .zip with -a; elsewhere use zip.
if (process.platform === 'win32') {
  execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', out, '.'], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: out, stdio: 'inherit' });
}
console.log(path.relative(process.cwd(), zip));
build({});   // back to the development build for local work
