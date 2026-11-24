// Security rules test for the shared field guide (firestore.rules), on the Firestore emulator. Nothing touches the real
// database. Run: npm run test:rules (starts the emulator, runs this, stops it).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

let env;
const spot = {
  brands: ['Kidsview'], lines: [], kind: 'infant bouncer', other_names: ['baby bouncer'], models: ['KV-2201'],
  sold_from: 2022, sold_to: 2026, all_units: false, tell: 'Model KV-2201 on the label under the seat.', for_children: true,
};
const entry = uid => ({ v: 1, spot, model: 'gemini-3.5-flash-lite', by: uid, at: serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'still-recalled-rules-test', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

test('a signed-in device writes a new entry and others read it', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'fieldGuide/27092'), entry('a')));
  await assertSucceeds(getDoc(doc(as('b'), 'fieldGuide/27092')));
  await assertSucceeds(setDoc(doc(as('a'), 'fieldGuide/W26-742'), entry('a')));
});

test('no sign-in: no read, no write', async () => {
  await assertFails(setDoc(doc(as(null), 'fieldGuide/27092'), entry('x')));
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'fieldGuide/27092'), { v: 1 }));
  await assertFails(getDoc(doc(as(null), 'fieldGuide/27092')));
});

test('the first entry stands: no overwrite, update or delete, even by its writer', async () => {
  await assertSucceeds(setDoc(doc(as('a'), 'fieldGuide/27092'), entry('a')));
  await assertFails(setDoc(doc(as('b'), 'fieldGuide/27092'), entry('b')));
  await assertFails(setDoc(doc(as('a'), 'fieldGuide/27092'), entry('a')));
  await assertFails(updateDoc(doc(as('a'), 'fieldGuide/27092'), { model: 'x' }));
  await assertFails(deleteDoc(doc(as('a'), 'fieldGuide/27092')));
});

test('no listing the collection', async () => {
  await assertFails(getDocs(collection(as('a'), 'fieldGuide')));
});

test('writer id must be the caller, time must be the server\'s', async () => {
  await assertFails(setDoc(doc(as('a'), 'fieldGuide/1'), entry('someone-else')));
  await assertFails(setDoc(doc(as('a'), 'fieldGuide/2'), { ...entry('a'), at: new Date('2020-01-01') }));
});

test('wrong shapes are refused', async () => {
  const bad = [
    { ...entry('a'), extra: true },
    { ...entry('a'), v: 2 },
    { ...entry('a'), spot: { ...spot, brands: Array(13).fill('x') } },
    { ...entry('a'), spot: { ...spot, tell: 'x'.repeat(401) } },
    { ...entry('a'), spot: { ...spot, sold_from: 1800 } },
    { ...entry('a'), spot: { ...spot, injected: 'x' } },
    { ...entry('a'), spot: { ...spot, all_units: 'yes' } },
    { ...entry('a'), model: 'x'.repeat(61) },
  ];
  for (const [i, d] of bad.entries()) await assertFails(setDoc(doc(as('a'), `fieldGuide/${100 + i}`), d));
  await assertFails(setDoc(doc(as('a'), 'fieldGuide/has space'), entry('a')));
});

test('everything outside the field guide is closed', async () => {
  await assertFails(setDoc(doc(as('a'), 'users/a'), { x: 1 }));
  await assertFails(getDoc(doc(as('a'), 'anything/else')));
});
