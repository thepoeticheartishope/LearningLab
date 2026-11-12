// Multiple-choice options for a question row: its answer plus up to
// count - 1 wrong ones, in a shuffled order. Wrong ones come from the row's
// own `options` first (a hand-written row), then its `wrongTiers` (a
// generated row, best tier first; each tier shuffled so the same three
// don't always show). Never a right answer, never one twice. A small
// stand-in for DungeonCrawler's quiz.js buildChoices (no word banks).
// No DOM access here.

import { shuffle } from './random.js';
import { answerKey, rightAnswers } from './text.js';

export function buildChoices(q, count = 4) {
  const right = rightAnswers(q);
  const seen = new Set();
  const wrong = [];
  const take = (list) => {
    list.forEach((w) => {
      const k = answerKey(w);
      if (wrong.length >= count - 1 || !k || right.has(k) || seen.has(k)) return;
      seen.add(k);
      wrong.push(String(w).trim());
    });
  };
  take(shuffle(Array.isArray(q.options) ? q.options : []));
  (Array.isArray(q.wrongTiers) ? q.wrongTiers : []).forEach(tier => take(shuffle(tier)));
  return shuffle([q.answer, ...wrong]);
}
