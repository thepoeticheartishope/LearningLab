// Loading a fact set: data/facts/<id>.json → { id, name, data, questions }.
// `questions` are the generated rows (factgen.js), each with a stable `key`
// (its question text) so logs and experiments can track it across sessions.

import { FACT_SETS } from './config.js';
import { generateQuestions } from './factgen.js';

// The question rows of facts file `data`, each with its `key`.
export function questionsFrom(data) {
  return generateQuestions(data).map(q => ({ ...q, key: q.question }));
}

// Loads fact set `id` (one of FACT_SETS) with fetch, from the page's
// folder up to the repo root (`root`, default '' = same folder as the page).
export async function loadFactSet(id, root = '') {
  const set = FACT_SETS.find(s => s.id === id);
  if (!set) throw new Error('Unknown fact set: ' + id);
  const res = await fetch(root + 'data/facts/' + id + '.json');
  if (!res.ok) throw new Error('Could not load ' + id + ' (' + res.status + ')');
  const data = await res.json();
  return { ...set, data, questions: questionsFrom(data) };
}
