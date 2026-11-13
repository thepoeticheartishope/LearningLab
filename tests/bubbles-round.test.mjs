// Unit tests for experiments/bubbles/round.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { otherMode, rowsFor, newRound, retryRound, current, answer, nextQuestion, factFor, modeSummary } from '../experiments/bubbles/round.js';
import { BUBBLES } from '../experiments/bubbles/config.js';
import { questionsFrom } from '../shared/facts.js';
import { readTriples } from '../shared/factgen.js';
import { buildChoices } from '../shared/choices.js';

const data = JSON.parse(readFileSync(new URL('../data/facts/comptia-aplus.json', import.meta.url)));
const rows = rowsFor(questionsFrom(data), BUBBLES.predicate);
const facts = readTriples(data).facts;

test('the port rows: 24, both directions, four real choices each', () => {
  assert.equal(rows.length, 24);
  assert.equal(rows.filter(q => q.fromFacts[0].asks === 'object').length, 12);
  assert.equal(rows.filter(q => q.fromFacts[0].asks === 'subject').length, 12);
  rows.forEach((q) => {
    const c = buildChoices(q, BUBBLES.choices);
    assert.equal(c.length, 4);
    assert.ok(c.includes(q.answer));
  });
});

test('a round: first-try score, missed once only, then over', () => {
  const r = newRound(rows, 8);
  assert.equal(r.items.length, 8);
  const q0 = current(r);
  assert.deepEqual(answer(r, q0.answer), { right: true, firstTry: true });
  assert.equal(answer(r, q0.answer), null);          // solved already
  nextQuestion(r);
  const q1 = current(r);
  assert.deepEqual(answer(r, 'nope'), { right: false, firstTry: true });
  assert.deepEqual(answer(r, 'nope 2'), { right: false, firstTry: false });
  assert.deepEqual(answer(r, ' ' + q1.answer.toLowerCase() + ' '), { right: true, firstTry: false });
  assert.equal(r.score, 1);
  assert.deepEqual(r.missed, [q1]);
  for (let i = 2; i < 8; i++) { nextQuestion(r); assert.ok(current(r)); }
  nextQuestion(r);
  assert.equal(r.over, true);
  assert.equal(current(r), null);
  assert.equal(answer(r, 'x'), null);
  const retry = retryRound(r);
  assert.deepEqual(retry.items, [q1]);
  assert.equal(retry.score, 0);
});

test('modes alternate', () => {
  assert.equal(otherMode('bubbles'), 'buttons');
  assert.equal(otherMode('buttons'), 'bubbles');
});

test('the wrong-tap note finds the tapped answer\'s own fact, both ways', () => {
  assert.deepEqual(factFor(facts, 'uses_port', '23'), { name: 'Telnet', value: 23 });
  assert.deepEqual(factFor(facts, 'uses_port', 'telnet'), { name: 'Telnet', value: 23 });
  assert.equal(factFor(facts, 'uses_port', '9999'), null);
  assert.equal(BUBBLES.note('Telnet', 23), 'Telnet uses port 23.');
});

test('per-mode summary: first taps only, % right and average ms', () => {
  const log = [
    { exp: 'bubbles', mode: 'bubbles', firstTry: true, right: true, ms: 1000 },
    { exp: 'bubbles', mode: 'bubbles', firstTry: true, right: false, ms: 3000 },
    { exp: 'bubbles', mode: 'bubbles', firstTry: false, right: true, ms: 9000 },
    { exp: 'mastery', mode: 'buttons', firstTry: true, right: true, ms: 1 },
  ];
  const s = modeSummary(log);
  assert.deepEqual(s.bubbles, { questions: 2, firstTryPct: 50, avgMs: 2000 });
  assert.deepEqual(s.buttons, { questions: 0, firstTryPct: null, avgMs: null });
});
