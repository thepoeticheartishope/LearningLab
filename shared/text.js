// Small text helpers. No DOM access here.

export function normalizeSpaces(s) {
  return String(s).trim().replace(/\s+/g, ' ');
}

// A case/space-insensitive key for comparing answers.
export function answerKey(s) {
  return normalizeSpaces(s).toLowerCase();
}

// Every right answer of question row `q` as answerKeys: its `answer` and
// any `acceptedAnswers`.
export function rightAnswers(q) {
  const keys = new Set([answerKey(q.answer ?? '')]);
  (q.acceptedAnswers || []).forEach(a => keys.add(answerKey(a)));
  return keys;
}

// `s` as a number when it is only a number ("443", "1,024"), else null.
export function plainNumber(s) {
  const t = normalizeSpaces(s ?? '').replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
