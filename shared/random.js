// A shuffled copy of `list` (Fisher-Yates); the list itself is untouched.
// Uses Math.random, so tests that fix it get the same order every time.
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
