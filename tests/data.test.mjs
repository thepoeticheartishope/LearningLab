// The fact sets in data/facts load and make sound questions. No DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FACT_SETS } from '../shared/config.js';
import { questionsFrom } from '../shared/facts.js';
import { rightAnswers } from '../shared/text.js';

for (const set of FACT_SETS) {
  test(`${set.id}: every fact names known entities, and questions come out`, () => {
    const data = JSON.parse(readFileSync(new URL(`../data/facts/${set.id}.json`, import.meta.url), 'utf8'));
    const ids = new Set(data.entities.map(e => e.id));
    data.facts.forEach((f) => {
      assert.ok(ids.has(f.subject), 'unknown subject ' + f.subject);
      assert.ok(typeof f.object === 'number' || ids.has(f.object), 'unknown object ' + f.object);
    });
    const qs = questionsFrom(data);
    assert.ok(qs.length > 0);
    const keys = new Set(qs.map(q => q.key));
    assert.equal(keys.size, qs.length, 'question keys are unique');
    qs.forEach((q) => {
      assert.ok(!q.question.includes('{'), q.question);
      const right = rightAnswers(q);
      assert.ok(q.wrongTiers.flat().every(w => !right.has(w.toLowerCase())), q.question);
    });
  });
}
