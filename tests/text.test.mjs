import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rightAnswers, plainNumber, answerKey } from '../shared/text.js';

test('rightAnswers holds the answer and every accepted answer, case and spaces aside', () => {
  const keys = rightAnswers({ answer: 'Amnon', acceptedAnswers: ['Absalom', '  Jedidiah '] });
  assert.ok(keys.has('amnon') && keys.has('absalom') && keys.has('jedidiah'));
  assert.equal(rightAnswers({ answer: 'Ruth' }).size, 1);
});

test('plainNumber reads bare numbers only', () => {
  assert.equal(plainNumber('443'), 443);
  assert.equal(plainNumber(' 1,024 '), 1024);
  assert.equal(plainNumber(8), 8);
  assert.equal(plainNumber('1 Corinthians'), null);
  assert.equal(plainNumber(''), null);
});

test('answerKey ignores case and extra spaces', () => {
  assert.equal(answerKey('  Fiber   Optic '), 'fiber optic');
});
