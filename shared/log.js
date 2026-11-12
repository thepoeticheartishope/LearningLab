// The answer log: every answer any experiment records, kept in
// localStorage so the play-test log can back up how it felt. Export gives
// one JSON file to keep or hand to Claude. No DOM access except download().
//
// An entry: { at (ISO time), exp (experiment id), set (fact set id),
// key (question key), given (what was answered), right (true/false),
// ms (time to answer, optional), ...anything else the experiment adds }.

import { LOG_KEY } from './config.js';

// The browser's localStorage, or null when it is blocked.
function defaultStore() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function readLog(store = defaultStore()) {
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(LOG_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

// Adds `entry` (with `at` filled in when missing) and returns it.
export function logAnswer(entry, store = defaultStore(), now = new Date()) {
  const row = { at: now.toISOString(), ...entry };
  if (!store) return row;
  const list = readLog(store);
  list.push(row);
  try { store.setItem(LOG_KEY, JSON.stringify(list)); } catch { /* full or blocked: the row is lost */ }
  return row;
}

export function clearLog(store = defaultStore()) {
  if (store) try { store.removeItem(LOG_KEY); } catch { /* blocked */ }
}

// The whole log as pretty JSON, with when it was exported.
export function exportLog(store = defaultStore(), now = new Date()) {
  return JSON.stringify({ exported: now.toISOString(), entries: readLog(store) }, null, 2);
}

// Counts for the menu: entries, and per experiment.
export function logSummary(list) {
  const byExp = {};
  list.forEach((e) => { byExp[e.exp || '?'] = (byExp[e.exp || '?'] || 0) + 1; });
  return { total: list.length, byExp };
}

// Browser only: saves exportLog() as a file.
export function downloadLog(store = defaultStore(), now = new Date()) {
  const blob = new Blob([exportLog(store, now)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'learninglab-log-' + now.toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
