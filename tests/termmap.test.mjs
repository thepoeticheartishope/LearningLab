// Unit tests for shared/termmap.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readTriples, tripleTemplates } from '../shared/factgen.js';
import { questionsFrom } from '../shared/facts.js';
import { factKey, unlockedFacts, mapFor, mapTerms, sentencesFor, missMap, gapTask, GAP_ID } from '../shared/termmap.js';

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

test('the full map: centre first, one relationship only, kinds from the template', () => {
  const m = mapFor('http', facts, templates);
  assert.deepEqual(m.centre, { id: 'http', label: 'HTTP', kind: 'core' });
  // HTTPS's own port and HTTPS–TCP are a second step away: not drawn.
  assert.deepEqual(m.nodes.map(n => n.label), ['HTTP', 'port 80', 'TCP', 'HTTPS']);
  assert.equal(m.nodes.find(n => n.id === 'https').kind, 'defence');
  assert.equal(m.links.length, 3);
  assert.deepEqual(sentencesFor(m, 'https'), ['HTTP replaced by HTTPS.']);
});

test('a fact\'s role shows on its line and in its sentence', () => {
  const withRole = {
    entities: [{ id: 'ftp', name: 'FTP', type: 'protocol' }],
    facts: [
      { subject: 'ftp', predicate: 'uses_port', object: 21, role: 'control' },
      { subject: 'ftp', predicate: 'uses_port', object: 20, role: 'data' },
    ],
    templates: [{ predicate: 'uses_port', map: { line: 'listens on', object: 'port {object}' } }],
  };
  const m = mapFor('ftp', readTriples(withRole).facts, tripleTemplates(withRole));
  assert.deepEqual(m.links.map(l => l.line), ['listens on (control)', 'listens on (data)']);
  assert.deepEqual(m.links.map(l => l.sentence), ['FTP listens on port 21 (control).', 'FTP listens on port 20 (data).']);
  assert.equal(factKey(readTriples(withRole).facts[1]), 'ftp|uses_port|20');
});

test('locked links are not drawn', () => {
  const m = mapFor('http', facts, templates, new Set(['http|uses_port|80']));
  assert.deepEqual(m.nodes.map(n => n.id), ['http', '#uses_port:80']);
  assert.equal(m.links.length, 1);
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

test('real set: DNS shows only its own links', () => {
  const real = JSON.parse(readFileSync(new URL('../data/facts/comptia-aplus.json', import.meta.url), 'utf8'));
  const f = readTriples(real).facts, t = tripleTemplates(real);
  const dns = mapFor('dns', f, t);
  assert.deepEqual(dns.nodes.map(n => n.label).sort(), ['DNS', 'TCP', 'UDP', 'port 53']);
  assert.ok(dns.links.every(l => l.from === 'dns' || l.to === 'dns'));
  // Every fact a question row asks about has a map.
  questionsFrom(real).forEach(q => assert.ok(mapFor(q.fromFacts[0].subject, f, t), q.question));
});

test('miss map: unlocked links plus the missed fact, focus on its far end', () => {
  const row = { fromFacts: [{ subject: 'http', predicate: 'runs_over', object: 'tcp' }] };
  const r = missMap(row, facts, templates, new Set(['http|uses_port|80']));
  assert.equal(r.map.centre.id, 'http');
  assert.deepEqual(r.map.links.map(l => l.key).sort(), ['http|runs_over|tcp', 'http|uses_port|80']);
  assert.equal(r.focus, 'tcp');
});

test('miss map: nothing unlocked still shows the missed link', () => {
  const row = { fromFacts: [{ subject: 'https', predicate: 'uses_port', object: 443 }] };
  const r = missMap(row, facts, templates, new Set());
  assert.deepEqual(r.map.links.map(l => l.key), ['https|uses_port|443']);
  assert.equal(r.focus, '#uses_port:443');
});

test('miss map: no fromFacts or an undrawn fact gives null', () => {
  assert.equal(missMap({ question: 'x' }, facts, templates, new Set()), null);
  assert.equal(missMap({ fromFacts: [{ subject: 'rj45', predicate: 'pin_count', object: 8 }] }, facts, templates, null), null);
});

// A fixed "random" that always takes the first choice.
const first = () => 0;

test('gap: asks only unlocked links, the gap bubble stands in for the far end', () => {
  const g = gapTask(facts, templates, new Set(['http|uses_port|80']), { rand: first });
  assert.equal(g.key, 'http|uses_port|80');
  assert.equal(g.map.centre.id, 'http');
  assert.deepEqual(g.map.nodes.map(n => n.id), ['http', GAP_ID]);
  assert.deepEqual(g.map.links.map(l => [l.from, l.to, l.gap]), [['http', GAP_ID, true]]);
  assert.equal(g.answer.label, 'port 80');
  assert.equal(g.sentence, 'HTTP listens on port 80.');
  assert.equal(g.prompt, 'HTTP listens on ?');
  // Wrong ones: the same predicate's other ports.
  assert.deepEqual(g.loose.map(n => n.label).sort(), ['port 443', 'port 80']);
});

test('gap: never offers a wrong bubble that is true for the term', () => {
  // HTTPS runs over TCP; "? runs over TCP" on TCP's map has only HTTP and
  // HTTPS, both true, so it is never asked; HTTP's "runs over ?" has no
  // other transport either. Nothing to ask.
  assert.equal(gapTask(facts, templates, new Set(['http|runs_over|tcp'])), null);
  assert.equal(gapTask(facts, templates, new Set()), null);
});

test('gap: other links to the answer are left out', () => {
  // HTTPS links to HTTP twice (made-up second link): asking "replaced by ?"
  // must not draw the other HTTPS line, or it gives the answer away.
  const more = { ...data, facts: [...data.facts, { subject: 'https', predicate: 'runs_over', object: 'http' }, { subject: 'ftp', predicate: 'secure_version', object: 'sftp' }],
    entities: [...data.entities, { id: 'ftp', name: 'FTP' }, { id: 'sftp', name: 'SFTP' }] };
  const f = readTriples(more).facts, t = tripleTemplates(more);
  const g = gapTask(f, t, new Set(['http|secure_version|https', 'https|runs_over|http', 'http|uses_port|80']), { rand: first });
  assert.equal(g.key, 'http|uses_port|80');
  const g2 = gapTask(f, t, new Set(['http|secure_version|https', 'https|runs_over|http']), { rand: first });
  assert.equal(g2.key, 'http|secure_version|https');
  assert.ok(!g2.map.nodes.some(n => n.id === 'https'));
  assert.ok(!g2.map.links.some(l => l.key === 'https|runs_over|http'));
  assert.deepEqual(g2.loose.map(n => n.id).sort(), ['https', 'sftp']);
});

test('gap: a gap on the subject side reads "? line term"', () => {
  const more = { ...data, entities: [...data.entities, { id: 'udp', name: 'UDP' }, { id: 'dhcp', name: 'DHCP' }],
    facts: [...data.facts, { subject: 'dhcp', predicate: 'runs_over', object: 'udp' }] };
  const f = readTriples(more).facts, t = tripleTemplates(more);
  // Askable: "? runs over TCP" (DHCP wrong), "DHCP runs over ?" (TCP wrong),
  // "HTTP runs over ?" (UDP wrong), "? runs over UDP" (HTTP wrong).
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(gapTask(f, t, new Set(['http|runs_over|tcp', 'dhcp|runs_over|udp'])).prompt);
  assert.ok(seen.has('? runs over TCP'), [...seen].join(', '));
  assert.ok(seen.has('DHCP runs over ?'), [...seen].join(', '));
});

test('gap: does not ask the same link twice in a row when another will do', () => {
  const keys = new Set(['http|uses_port|80', 'https|uses_port|443']);
  for (let i = 0; i < 20; i++) assert.notEqual(gapTask(facts, templates, keys, { lastKey: 'http|uses_port|80' }).key, 'http|uses_port|80');
});

test('gap: real set, every link with all unlocked gives at most 4 bubbles and one right one', () => {
  const real = JSON.parse(readFileSync(new URL('../data/facts/comptia-aplus.json', import.meta.url), 'utf8'));
  const f = readTriples(real).facts, t = tripleTemplates(real);
  for (let i = 0; i < 200; i++) {
    const g = gapTask(f, t, null);
    assert.ok(g.loose.length >= 2 && g.loose.length <= 4, g.key);
    assert.equal(g.loose.filter(n => n.id === g.answer.id).length, 1);
    assert.ok(!g.map.nodes.some(n => n.id === g.answer.id), g.key);
  }
});
