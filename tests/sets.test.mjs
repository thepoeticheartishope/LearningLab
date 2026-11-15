// shared/sets.js: which fact set the experiments run on. No DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FACT_SETS, SET_KEY } from '../shared/config.js';
import { chosenSetId, pickSet } from '../shared/sets.js';

function memStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const first = FACT_SETS[0].id;

test('no pick: the first set', () => {
  assert.equal(chosenSetId('', memStore()), first);
  assert.equal(chosenSetId('', null), first);
});

test('a ?set= in the address wins and is remembered', () => {
  const s = memStore();
  s.setItem(SET_KEY, 'nonsense');
  assert.equal(chosenSetId('?set=' + first, s), first);
  assert.equal(s.getItem(SET_KEY), first);
});

test('an unknown id is ignored, in the address and when picked', () => {
  const s = memStore();
  assert.equal(chosenSetId('?set=nope', s), first);
  pickSet('nope', s);
  assert.equal(s.getItem(SET_KEY), null);
});

test('a remembered pick is used', () => {
  const s = memStore();
  pickSet(first, s);
  assert.equal(chosenSetId('', s), first);
});

test('a blocked store does not throw', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(chosenSetId('', bad), first);
  assert.doesNotThrow(() => pickSet(first, bad));
});

test('every set has a source format with an area group and a matching example', () => {
  for (const s of FACT_SETS) {
    const m = s.source.pattern.exec(s.source.example);
    assert.ok(m && m[1], s.id + ': example does not match its pattern');
  }
});
