// A term's bubble map from a facts file, no DOM (bubble map plan step A,
// ~/ByClaude/LearningLab/bubblemap-plan.md; LEARNING-STYLE.md stage 3).
//
//   mapFor(entityId, facts, templates, unlocked) → { centre, nodes, links }
//
// `facts` are readTriples' facts (entities looked up), `templates`
// tripleTemplates' map. Only facts whose template has a `map` entry are
// drawn: { line: 'listens on', kind?: 'info' | 'risk' | 'defence',
// object?: 'port {object}' } (`object` = how a number reads in its bubble).
// `unlocked` = a Set of fact keys (factKey) the learner may see, or null
// for every fact. A locked fact is not drawn at all.
//
// One relationship only (Timothy 2026-11-13): the map is the centre and
// its own links. A neighbour's links (UDP → DHCP on DNS's map) and links
// between neighbours are not drawn.

const KINDS = ['info', 'risk', 'defence'];

// A fact's key: "subject|predicate|object" by ids (the object may be a
// number). Same shape as a question row's fromFacts entry.
export function factKey(f) {
  const side = s => (s && typeof s === 'object' ? s.id ?? s : s);
  return side(f.subject) + '|' + f.predicate + '|' + side(f.object);
}

// The keys of every fact behind a question row that passes `isUnlocked(q)`
// (Mastery: tier ≥ 2), from the rows' fromFacts.
export function unlockedFacts(questions, isUnlocked) {
  const keys = new Set();
  questions.forEach((q) => {
    if (!q.fromFacts || !q.fromFacts.length || !isUnlocked(q)) return;
    q.fromFacts.forEach(f => keys.add(factKey(f)));
  });
  return keys;
}

// A fact's map entry from its template, or null when it is not drawn.
function mapOf(f, templates) {
  const tp = templates.get(f.predicate);
  const m = tp && tp.map;
  if (!m || typeof m.line !== 'string' || !m.line.trim()) return null;
  return { line: m.line.trim(), kind: KINDS.includes(m.kind) ? m.kind : 'info', object: typeof m.object === 'string' ? m.object : '{object}' };
}

// A side's node id and label. A number's id carries its predicate, so
// "8 pins" and "port 8" never share a bubble.
function nodeOf(side, f, m) {
  if (typeof side === 'number') return { id: '#' + f.predicate + ':' + side, label: m.object.replaceAll('{object}', String(side)), number: true };
  return { id: side.id, label: side.name };
}

// The drawable facts of `facts`, each with its map entry, its key and its
// two node ids.
function drawable(facts, templates, unlocked) {
  const out = [];
  facts.forEach((f) => {
    const m = mapOf(f, templates);
    if (!m) return;
    const key = factKey(f);
    if (unlocked && !unlocked.has(key)) return;
    const a = nodeOf(f.subject, f, m), b = nodeOf(f.object, f, m);
    out.push({ f, m, key, a, b, sentence: a.label + ' ' + m.line + ' ' + b.label + '.' });
  });
  return out;
}

// The map around entity `entityId`: { centre: { id, label }, nodes:
// [{ id, label, kind }], links: [{ key, from, to, line, kind, sentence }] }
// (node ids; `from` is always the fact's subject). No drawable fact gives
// null.
export function mapFor(entityId, facts, templates, unlocked = null) {
  const all = drawable(facts, templates, unlocked);
  const touches = (d, id) => d.a.id === id || d.b.id === id;
  const own = all.filter(d => touches(d, entityId));
  if (!own.length) return null;
  const centreNode = own[0].a.id === entityId ? own[0].a : own[0].b;

  const nodes = new Map([[entityId, { id: entityId, label: centreNode.label, kind: 'core' }]]);
  const addNode = (n, kind) => { if (!nodes.has(n.id)) nodes.set(n.id, { id: n.id, label: n.label, kind }); };
  own.forEach(d => addNode(d.a.id === entityId ? d.b : d.a, d.m.kind));

  const links = own
    .map(d => ({ key: d.key, from: d.a.id, to: d.b.id, line: d.m.line, kind: d.m.kind, sentence: d.sentence }));
  return { centre: nodes.get(entityId), nodes: [...nodes.values()], links };
}

// The entities that have a map: every entity on a drawable, unlocked fact,
// { id, label }, sorted by label. Numbers are never a centre.
export function mapTerms(facts, templates, unlocked = null) {
  const out = new Map();
  drawable(facts, templates, unlocked).forEach((d) => {
    [d.a, d.b].forEach((n) => { if (!n.number && !out.has(n.id)) out.set(n.id, { id: n.id, label: n.label }); });
  });
  return [...out.values()].sort((x, y) => x.label.localeCompare(y.label));
}

// The sentences of every link touching node `id` in `map`, in link order
// ("DNS listens on port 53."). The panel under a map shows these on a tap.
export function sentencesFor(map, id) {
  return map ? map.links.filter(l => l.from === id || l.to === id).map(l => l.sentence) : [];
}

// The review map after a miss (bubble map plan step B): the map of the
// missed row's own fact, centred on its subject (or its object when the
// subject has no map), with the unlocked links plus the missed fact's own
// link (its answer was just shown, so it is no secret). `focus` = the
// node on the far end of that link, to ring and explain first. A row with
// no fromFacts, or no drawable fact, gives null.
export function missMap(row, facts, templates, unlocked = null) {
  const own = (row && row.fromFacts || [])[0];
  if (!own) return null;
  const ownKey = factKey(own);
  const keys = unlocked ? new Set([...unlocked, ownKey]) : null;
  const ids = [own.subject, own.object].filter(s => typeof s === 'string');
  for (const id of ids) {
    const map = mapFor(id, facts, templates, keys);
    if (!map || !map.links.some(l => l.key === ownKey)) continue;
    const link = map.links.find(l => l.key === ownKey);
    return { map, focus: link.from === id ? link.to : link.from };
  }
  return null;
}
