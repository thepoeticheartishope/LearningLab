// The answer log (shared/log.js) with a fake store. No DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readLog, logAnswer, clearLog, exportLog, logSummary } from '../shared/log.js';
import { LOG_KEY } from '../shared/config.js';

function fakeStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
const when = new Date('2026-11-12T10:00:00Z');

test('an empty store reads as an empty log', () => {
  assert.deepEqual(readLog(fakeStore()), []);
  assert.deepEqual(readLog(null), []);
});

test('logAnswer adds entries in order and fills in the time', () => {
  const s = fakeStore();
  logAnswer({ exp: 'mastery', key: 'Q1', given: 'a', right: true }, s, when);
  logAnswer({ exp: 'mastery', key: 'Q2', given: 'b', right: false, at: 'kept' }, s, when);
  const log = readLog(s);
  assert.equal(log.length, 2);
  assert.equal(log[0].at, '2026-11-12T10:00:00.000Z');
  assert.equal(log[1].at, 'kept');
  assert.equal(log[1].right, false);
});

test('a broken stored log reads as empty instead of throwing', () => {
  const s = fakeStore();
  s.setItem(LOG_KEY, '{not json');
  assert.deepEqual(readLog(s), []);
  s.setItem(LOG_KEY, '{"a":1}');
  assert.deepEqual(readLog(s), []);
});

test('export holds every entry; clear empties it', () => {
  const s = fakeStore();
  logAnswer({ exp: 'x', key: 'Q' }, s, when);
  const out = JSON.parse(exportLog(s, when));
  assert.equal(out.exported, '2026-11-12T10:00:00.000Z');
  assert.equal(out.entries.length, 1);
  clearLog(s);
  assert.deepEqual(readLog(s), []);
});

test('summary counts per experiment', () => {
  assert.deepEqual(logSummary([{ exp: 'a' }, { exp: 'a' }, { exp: 'b' }, {}]), { total: 4, byExp: { a: 2, b: 1, '?': 1 } });
});
