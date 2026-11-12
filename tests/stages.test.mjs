// Unit tests for experiments/mastery/stages.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readTriples } from '../shared/factgen.js';
import { STAGES, factEntities, factLine, relatedFacts } from '../experiments/mastery/stages.js';

const data = {
  entities: [
    { id: 'https', name: 'HTTPS', type: 'protocol' },
    { id: 'tls', name: 'TLS', type: 'protocol', aliases: ['SSL/TLS'] },
    { id: 'rj45', name: 'RJ45', type: 'connector' },
  ],
  facts: [
    { subject: 'https', predicate: 'uses_port', object: 443 },
    { subject: 'https', predicate: 'wraps', object: 'tls' },
    { subject: 'rj45', predicate: 'pin_count', object: 8 },
  ],
  templates: [{ predicate: 'uses_port', label: '{subject} port' }],
};
const triples = readTriples(data);
const httpsPort = { question: 'Which port does HTTPS use by default?', answer: '443', fromFacts: [{ subject: 'https', predicate: 'uses_port', object: 443, asks: 'object' }] };

test('five stages in order', () => {
  assert.deepEqual(STAGES.map(s => s.n), [1, 2, 3, 4, 5]);
});

test('entities come from fromFacts, else the answer name or alias', () => {
  assert.deepEqual(factEntities(httpsPort, triples), ['https']);
  assert.deepEqual(factEntities({ question: 'x', answer: 'tls' }, triples), ['tls']);
  assert.deepEqual(factEntities({ question: 'x', answer: 'ssl/tls' }, triples), ['tls']);
  assert.deepEqual(factEntities({ question: 'x', answer: 'nothing' }, triples), []);
});

test('a fact line uses the template label, else the predicate', () => {
  assert.equal(factLine(triples.facts[0], triples.labels), 'HTTPS port: 443');
  assert.equal(factLine(triples.facts[1], triples.labels), 'HTTPS wraps TLS');
});

test('related facts share an entity and leave out the fact itself', () => {
  assert.deepEqual(relatedFacts(httpsPort, triples), ['HTTPS wraps TLS']);
  assert.deepEqual(relatedFacts({ question: 'x', answer: 'TLS' }, triples), ['HTTPS wraps TLS']);
  assert.deepEqual(relatedFacts({ question: 'x', answer: 'nothing' }, triples), []);
});
