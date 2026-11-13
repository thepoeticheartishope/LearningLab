// Unit tests for shared/termmap.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readTriples, tripleTemplates } from '../shared/factgen.js';
import { questionsFrom } from '../shared/facts.js';
import { factKey, unlockedFacts, mapFor, mapTerms, sentencesFor, TERM_MAP } from '../shared/termmap.js';

const data = {
  entities: [
    { id: 'http', name: 'HTTP', type: 'protocol' },
    { id: 'https', name: 'HTTPS', type: 'protocol' },
    { id: 'tcp', name: 'TCP', type: 'protocol' },
    { id: 'rj45', name: 'RJ45', type: 'connector' },
  ],
  facts: [
    { subject: 'http', predicate: 'uses_port', object: 80 },
    { subject: 'https', predicate: 'uses_port', object: 443 },
    { subject: 'http', predicate: 'runs_over', object: 'tcp' },
    { subject: 'https', predicate: 'runs_over', object: 'tcp' },
    { subject: 'http', predicate: 'secure_version', object: 'https' },
    { subject: 'rj45', predicate: 'pin_count', object: 8 },
  ],
  templates: [
    { predicate: 'uses_port', map: { line: 'listens on', object: 'port {object}' } },
    { predicate: 'runs_over', map: { line: 'runs over' } },
    { predicate: 'secure_version', map: { line: 'replaced by', kind: 'defence' } },
    { predicate: 'pin_count' },   // no map entry: never drawn
  ],
};
const facts = readTriples(data).facts;
const templates = tripleTemplates(data);

test('a fact key is subject|predicate|object by ids', () => {
  assert.equal(factKey(facts[0]), 'http|uses_port|80');
  assert.equal(factKey({ subject: 'http', predicate: 'runs_over', object: 'tcp' }), 'http|runs_over|tcp');
});

test('the full map: centre first, kinds from the template, numbers read through map.object', () => {
  const m = mapFor('http', facts, templates);
  assert.deepEqual(m.centre, { id: 'http', label: 'HTTP', kind: 'core' });
  assert.deepEqual(m.nodes.map(n => n.label), ['HTTP', 'port 80', 'TCP', 'HTTPS', 'port 443']);
  assert.equal(m.nodes.find(n => n.id === 'https').kind, 'defence');
  // HTTPS–TCP joins two bubbles already on the map, so it is drawn too.
  assert.equal(m.links.length, 5);
  assert.deepEqual(sentencesFor(m, 'https'), ['HTTPS listens on port 443.', 'HTTPS runs over TCP.', 'HTTP replaced by HTTPS.']);
});

test('locked links are not drawn; ring 2 needs its ring-1 link', () => {
  const only = new Set(['http|uses_port|80']);
  const m = mapFor('http', facts, templates, only);
  assert.deepEqual(m.nodes.map(n => n.id), ['http', '#uses_port:80']);
  assert.equal(m.links.length, 1);
  // HTTPS's own facts are unlocked, but the HTTP → HTTPS link is not.
  const m2 = mapFor('http', facts, templates, new Set(['http|uses_port|80', 'https|uses_port|443']));
  assert.ok(!m2.nodes.some(n => n.id === '#uses_port:443'));
  assert.equal(mapFor('http', facts, templates, new Set()), null);
});

test('a template with no map entry is never drawn', () => {
  assert.equal(mapFor('rj45', facts, templates), null);
  assert.ok(!mapTerms(facts, templates).some(t => t.id === 'rj45'));
});

test('map terms: entities on unlocked facts only, never numbers, sorted', () => {
  assert.deepEqual(mapTerms(facts, templates).map(t => t.label), ['HTTP', 'HTTPS', 'TCP']);
  assert.deepEqual(mapTerms(facts, templates, new Set(['https|uses_port|443'])).map(t => t.id), ['https']);
});

test('unlocked facts come from the rows that pass, through fromFacts', () => {
  const rows = [
    { question: 'a', fromFacts: [{ subject: 'http', predicate: 'uses_port', object: 80, asks: 'object' }], tier: 2 },
    { question: 'b', fromFacts: [{ subject: 'https', predicate: 'uses_port', object: 443, asks: 'object' }], tier: 1 },
    { question: 'c', tier: 4 },   // hand-written: no facts behind it
  ];
  assert.deepEqual([...unlockedFacts(rows, q => q.tier >= 2)], ['http|uses_port|80']);
});

test('real set: a hub is not opened up, a small ring is', () => {
  const real = JSON.parse(readFileSync(new URL('../data/facts/comptia-aplus.json', import.meta.url), 'utf8'));
  const f = readTriples(real).facts, t = tripleTemplates(real);
  const dns = mapFor('dns', f, t);
  assert.ok(dns.nodes.some(n => n.id === 'tcp'));
  assert.ok(dns.nodes.some(n => n.id === 'dhcp'), 'UDP is small, so its DHCP shows');
  assert.ok(!dns.nodes.some(n => n.id === 'ssh'), 'TCP is a hub, so its protocols stay out');
  const tcp = mapFor('tcp', f, t);
  assert.ok(tcp.nodes.length - 1 > TERM_MAP.ringTwoUpTo);
  assert.ok(!tcp.nodes.some(n => n.id.startsWith('#')), 'a big ring 1 gets no ring 2');
  // Every fact a question row asks about has a map.
  questionsFrom(real).forEach(q => assert.ok(mapFor(q.fromFacts[0].subject, f, t), q.question));
});
