// Stage walk (Timothy 2026-11-12): run one fact through the five stages of
// LEARNING-STYLE.md in order, 1 Association → 5 Free recall, to test the
// Lab in full. A walk never touches the mastery record or the answer log.
// No DOM access here.

export const STAGES = [
  { n: 1, name: 'Association', task: 'See the term and the fact. Nothing to answer.' },
  { n: 2, name: 'Recognition', task: 'Pick the answer.' },
  { n: 3, name: 'Reinforcement', task: 'See what the term links to. Tap a bubble to read the link.' },
  { n: 4, name: 'Analysis', task: 'Tap every phrase that is evidence for this answer.' },
  { n: 5, name: 'Free recall', task: 'Type the answer. No list, no hints.' },
];

const plain = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// The entity ids fact row `q` is about: the sides of its `fromFacts`
// (generated rows), else any entity whose name or alias is the answer
// (hand-written rows). `triples` is readTriples' { facts }.
export function factEntities(q, triples) {
  const ids = new Set();
  (q.fromFacts || []).forEach(f => {
    ids.add(f.subject);
    if (typeof f.object === 'string') ids.add(f.object);
  });
  if (!ids.size) {
    const want = plain(q.answer);
    triples.facts.forEach(f => [f.subject, f.object].forEach(side => {
      if (typeof side === 'number') return;
      if (plain(side.name) === want || (side.aliases || []).some(a => plain(a) === want)) ids.add(side.id);
    }));
  }
  return [...ids];
}

// One fact as a line: its template label with the subject filled in, then
// the object ("HTTPS port: 443"), or "subject predicate object" with no label.
export function factLine(f, labels) {
  const subject = f.subject.name;
  const object = typeof f.object === 'number' ? String(f.object) : f.object.name;
  const label = labels[f.predicate];
  return label ? label.replaceAll('{subject}', subject) + ': ' + object : subject + ' ' + f.predicate.replaceAll('_', ' ') + ' ' + object;
}

// Stage 3's lines: every other fact that shares an entity with `q` (either
// side), in file order. `q`'s own facts are left out.
export function relatedFacts(q, triples) {
  const ids = new Set(factEntities(q, triples));
  const own = new Set((q.fromFacts || []).map(f => f.subject + '|' + f.predicate + '|' + f.object));
  const idOf = side => (typeof side === 'number' ? null : side.id);
  return triples.facts
    .filter(f => ids.has(f.subject.id) || ids.has(idOf(f.object)))
    .filter(f => !own.has(f.subject.id + '|' + f.predicate + '|' + (idOf(f.object) ?? f.object)))
    .map(f => factLine(f, triples.labels));
}
