// Unit tests for shared/choices.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildChoices } from '../shared/choices.js';
import { questionsFrom } from '../shared/facts.js';

test('four choices: the answer and three wrong ones, none twice, none right', () => {
  const q = { question: 'Q?', answer: 'DNS', acceptedAnswers: ['Domain Name System'], options: ['DHCP', 'dns', 'NTP', 'Domain Name System', 'DHCP', 'SNMP'] };
  for (let i = 0; i < 20; i++) {
    const c = buildChoices(q);
    assert.equal(c.length, 4);
    assert.ok(c.includes('DNS'));
    assert.deepEqual(c.filter(x => x !== 'DNS').sort(), ['DHCP', 'NTP', 'SNMP']);
  }
});

test('a generated row takes its best wrong tier first, then the next', () => {
  const q = { question: 'Q?', answer: '8', wrongTiers: [['7'], ['9', '10'], ['11', '12', '13']] };
  for (let i = 0; i < 20; i++) {
    const c = buildChoices(q);
    assert.ok(c.includes('7') && c.includes('9') && c.includes('10'));
  }
});

test('fewer wrong answers than asked for gives fewer choices, not repeats', () => {
  assert.deepEqual(buildChoices({ question: 'Q?', answer: 'A', wrongTiers: [['B']] }).sort(), ['A', 'B']);
});

test('every CompTIA question gets four choices', () => {
  const data = JSON.parse(readFileSync(new URL('../data/facts/comptia-aplus.json', import.meta.url), 'utf8'));
  questionsFrom(data).forEach(q => assert.equal(buildChoices(q).length, 4, q.question));
});
