// tools/data-check.mjs: the real fact sets have no errors, and broken
// data is caught. No DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FACT_SETS } from '../shared/config.js';
import { checkFactSet } from '../tools/data-check.mjs';

const scenarios = JSON.parse(readFileSync(new URL('../experiments/mastery/scenarios.json', import.meta.url), 'utf8'));

for (const set of FACT_SETS) {
  test(`${set.id}: data check finds no errors`, () => {
    const data = JSON.parse(readFileSync(new URL(`../data/facts/${set.id}.json`, import.meta.url), 'utf8'));
    const { errors } = checkFactSet(data, scenarios);
    assert.deepEqual(errors, []);
  });
}

test('data check catches broken data and counts gaps', () => {
  const data = {
    entities: [
      { id: 'a', name: 'A', type: 'protocol' }, { id: 'b', name: 'B', type: 'protocol' },
      { id: 'a', name: 'A again', type: 'protocol' }, { id: 'c', name: 'b', type: 'protocol' },
    ],
    templates: [{ predicate: 'uses_port', ask_object: 'Port for {subject}?' }],
    facts: [
      { subject: 'a', predicate: 'uses_port', object: 1, source: '220-1201 2.1' },
      { subject: 'a', predicate: 'uses_port', object: 1, source: '220-1201 2.1' },
      { subject: 'b', predicate: 'no_template', object: 2 },
    ],
  };
  const { errors, warnings, gaps } = checkFactSet(data);
  assert.ok(errors.some(e => e.includes('used twice')));
  assert.ok(errors.some(e => e.includes('listed twice')));
  assert.ok(errors.some(e => e.includes('no template')));
  assert.ok(errors.some(e => e.includes('no source')));
  assert.ok(warnings.some(w => w.includes('named "b"')));
  assert.equal(gaps.counts.termsUsed, 2);
});
