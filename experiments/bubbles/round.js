// Bubble answers' round logic, no DOM. The same engine runs both modes
// (BUBBLES and BUTTONS); only how the answers are shown differs.
//
// A round: { items (question rows), i (showing), score (right on the
// first try), missed (rows answered wrong at least once), tries (wrong
// taps on the one showing), solved, over }.

import { shuffle } from '../../shared/random.js';
import { answerKey, rightAnswers } from '../../shared/text.js';

export const MODES = ['bubbles', 'buttons'];

export function otherMode(mode) {
  return mode === 'bubbles' ? 'buttons' : 'bubbles';
}

// The question rows made from facts with `predicate`.
export function rowsFor(questions, predicate) {
  return questions.filter(q => (q.fromFacts || []).some(f => f.predicate === predicate));
}

// A new round of up to `size` rows from `rows`, in a shuffled order.
export function newRound(rows, size) {
  return { items: shuffle(rows).slice(0, size), i: 0, score: 0, missed: [], tries: 0, solved: false, over: false };
}

// A round of the rows `round` missed (all of them, shuffled).
export function retryRound(round) {
  return newRound(round.missed, round.missed.length);
}

export function current(round) {
  return round.over ? null : round.items[round.i];
}

// Settles `given` for the question showing. Returns { right, firstTry },
// or null when nothing can be answered (solved already or round over).
export function answer(round, given) {
  const q = current(round);
  if (!q || round.solved) return null;
  const right = rightAnswers(q).has(answerKey(given));
  const firstTry = round.tries === 0;
  if (right) {
    round.solved = true;
    if (firstTry) round.score++;
  } else {
    round.tries++;
    if (round.tries === 1) round.missed.push(q);
  }
  return { right, firstTry };
}

// Moves to the next question; past the last one the round is over.
export function nextQuestion(round) {
  round.i++;
  round.tries = 0;
  round.solved = false;
  if (round.i >= round.items.length) round.over = true;
}

// The fact a wrong answer belongs to, for "Telnet uses port 23.": among
// `facts` (readTriples' facts) with `predicate`, the one whose subject
// name/alias or object matches `given`. { name, value } or null.
export function factFor(facts, predicate, given) {
  const k = answerKey(given);
  const f = facts.find((x) => {
    if (x.predicate !== predicate) return false;
    const s = x.subject || {};
    const names = [s.name, ...(s.aliases || [])].filter(Boolean).map(answerKey);
    const obj = typeof x.object === 'object' && x.object ? x.object.name : x.object;
    return names.includes(k) || answerKey(obj ?? '') === k;
  });
  if (!f) return null;
  return { name: f.subject.name, value: typeof f.object === 'object' ? f.object.name : f.object };
}

// Per-mode summary from the answer log (this experiment's entries):
// { bubbles: { questions, firstTryPct, avgMs }, buttons: … }. Only first
// taps count: first-try % is how many of them were right, avgMs their
// average time. A mode with no answers gives questions 0 and nulls.
export function modeSummary(entries) {
  const out = {};
  MODES.forEach((mode) => {
    const first = entries.filter(e => e.exp === 'bubbles' && e.mode === mode && e.firstTry);
    const timed = first.filter(e => typeof e.ms === 'number');
    out[mode] = {
      questions: first.length,
      firstTryPct: first.length ? Math.round(100 * first.filter(e => e.right).length / first.length) : null,
      avgMs: timed.length ? Math.round(timed.reduce((t, e) => t + e.ms, 0) / timed.length) : null,
    };
  });
  return out;
}
