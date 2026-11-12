// Unit tests for the facts generator (shared/factgen.js), ported from
// DungeonCrawler tests/factgen.test.mjs (game-only tests left out). No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateQuestions } from '../shared/factgen.js';
import { FACT_QUESTIONS } from '../shared/config.js';

// Runs fn with Math.random fixed at `value`, then puts it back.
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}
const family = {
  entities: [
    { id: 'jesse', name: 'Jesse', type: 'name' },
    { id: 'david', name: 'David', type: 'name' },
    { id: 'saul', name: 'Saul', type: 'name' },
    { id: 'michal', name: 'Michal', type: 'name' },
    { id: 'amnon', name: 'Amnon', type: 'name' },
    { id: 'absalom', name: 'Absalom', type: 'name' },
    { id: 'solomon', name: 'Solomon', type: 'name', aliases: ['Jedidiah'] },
    { id: 'ruth', name: 'Ruth', type: 'name' },
    { id: 'boaz', name: 'Boaz', type: 'name' },
    { id: 'naomi', name: 'Naomi', type: 'name' },
    { id: 'bethlehem', name: 'Bethlehem', type: 'location' },
  ],
  facts: [
    { subject: 'jesse', predicate: 'father_of', object: 'david', source: 'Ruth 4:22' },
    { subject: 'david', predicate: 'father_of', object: 'amnon', source: '2 Sam 3:2' },
    { subject: 'david', predicate: 'father_of', object: 'absalom', source: '2 Sam 3:3' },
    { subject: 'david', predicate: 'father_of', object: 'solomon', source: '2 Sam 12:24' },
    { subject: 'saul', predicate: 'father_of', object: 'michal' },
    { subject: 'david', predicate: 'married', object: 'michal' },
    { subject: 'david', predicate: 'born_in', object: 'bethlehem' },
    { subject: 'boaz', predicate: 'married', object: 'ruth' },
    { subject: 'naomi', predicate: 'mother_in_law_of', object: 'ruth' },
  ],
  templates: [
    { predicate: 'father_of', ask_object: 'Name a child of {subject}.', ask_subject: 'Who was the father of {object}?', exhaustive: ['ask_subject'] },
    { predicate: 'born_in', ask_subject: 'Who was born in {object}?', category: 'OT', difficulty: 'hard' },
  ],
};

const ask = (rows, question) => rows.find(r => r.question === question);

test('ask_object groups by subject: one question per subject, all its answers accepted', () => {
  const rows = generateQuestions(family);
  const david = rows.filter(r => r.question === 'Name a child of David.');
  assert.equal(david.length, 1);
  assert.equal(david[0].answer, 'Amnon'); // the first fact in file order
  assert.deepEqual(david[0].acceptedAnswers, ['Amnon', 'Absalom', 'Solomon', 'Jedidiah']);
  assert.equal(david[0].source, '2 Sam 3:2; 2 Sam 3:3; 2 Sam 12:24');
  assert.equal(david[0].generated, true);
  assert.equal(david[0].answerType, 'name');
});

test('ask_subject groups by object, and prompts use names, never ids', () => {
  const rows = generateQuestions(family);
  const q = ask(rows, 'Who was the father of Solomon?');
  assert.equal(q.answer, 'David');
  assert.ok(rows.every(r => !/\b(jesse|david|solomon|bethlehem)\b/.test(r.question)));
  assert.ok(!rows.some(r => r.question.includes('{')));
});

test('a generated row keeps the triples it came from (ids) and the side it asks', () => {
  const rows = generateQuestions(family);
  assert.deepEqual(ask(rows, 'Who was the father of Solomon?').fromFacts, [
    { subject: 'david', predicate: 'father_of', object: 'solomon', asks: 'subject' },
  ]);
  const david = ask(rows, 'Name a child of David.').fromFacts;
  assert.deepEqual(david.map(f => f.object), ['amnon', 'absalom', 'solomon']);
  assert.ok(david.every(f => f.subject === 'david' && f.asks === 'object'));
});

test('a predicate with no template, or a template with neither ask, makes no questions', () => {
  const rows = generateQuestions(family);
  assert.ok(!rows.some(r => /michal/i.test(r.question) && /wife/i.test(r.question)));
  const none = generateQuestions({ ...family, templates: [{ predicate: 'father_of', label: '{object}\'s father' }] });
  assert.deepEqual(none, []);
});

test('category and difficulty come from the template, else the defaults', () => {
  const rows = generateQuestions(family);
  const child = ask(rows, 'Name a child of David.');
  assert.equal(child.category, FACT_QUESTIONS.category);
  assert.equal(child.difficulty, FACT_QUESTIONS.difficulty);
  const born = ask(rows, 'Who was born in Bethlehem?');
  assert.equal(born.category, 'OT');
  assert.equal(born.difficulty, 'hard');
});

test('wrong answers are never right, never linked to the subject, and keep to its type', () => {
  const rows = generateQuestions(family);
  const q = ask(rows, 'Name a child of David.');
  const wrong = q.wrongTiers.flat();
  // Michal is linked to David (his wife), Jesse is his father: neither is offered.
  assert.ok(!wrong.includes('Michal'));
  assert.ok(!wrong.includes('Jesse'));
  assert.ok(!wrong.some(w => q.acceptedAnswers.includes(w)));
  assert.ok(!wrong.includes('Bethlehem'));
  // Same predicate first: David is a father_of object, but linked; Ruth comes second.
  assert.deepEqual(q.wrongTiers[0], []);
  assert.deepEqual(q.wrongTiers[1], ['Saul', 'Ruth', 'Boaz', 'Naomi']);
});

test('an entity no fact uses (a word for wrong choices) is never a generated wrong answer', () => {
  // Jonathan is a word only: the file knows nothing about him, and he is
  // in fact a child of Saul, so the open list must not call him wrong.
  const withWord = { ...family, entities: [...family.entities, { id: 'jonathan', name: 'Jonathan', type: 'name' }] };
  const rows = generateQuestions(withWord);
  assert.ok(rows.every(r => !r.wrongTiers.flat().includes('Jonathan')));
  assert.deepEqual(ask(rows, 'Name a child of David.').wrongTiers, ask(generateQuestions(family), 'Name a child of David.').wrongTiers);
});

test('a generated row is an open list unless its template calls that way exhaustive', () => {
  const rows = generateQuestions(family);
  assert.equal(ask(rows, 'Name a child of David.').openList, true);
  assert.equal(ask(rows, 'Who was born in Bethlehem?').openList, true);
  assert.equal(ask(rows, 'Who was the father of Solomon?').openList, undefined);
});

test('an open list with fewer than openMinWrong wrong answers from its file is left out', () => {
  const few = {
    entities: [{ id: 'saul', name: 'Saul', type: 'name' }, { id: 'michal', name: 'Michal', type: 'name' }, { id: 'ruth', name: 'Ruth', type: 'name' }],
    facts: [{ subject: 'saul', predicate: 'father_of', object: 'michal' }],
    templates: [{ predicate: 'father_of', ask_object: 'Name a child of {subject}.', ask_subject: 'Who was the father of {object}?', exhaustive: ['ask_subject'] }],
  };
  const rows = generateQuestions(few);
  assert.ok(!rows.some(r => r.question === 'Name a child of Saul.'));
  // The closed way has no such floor: buildChoices may fill it from the set.
  assert.ok(rows.some(r => r.question === 'Who was the father of Michal?'));
});

test('a written question with the same text stays, and the generated one is left out', () => {
  const written = [{ question: 'Who was the father of David?', answer: 'Jesse' }];
  const rows = generateQuestions(family, written);
  assert.ok(!rows.some(r => r.question === 'Who was the father of David?'));
  assert.ok(rows.some(r => r.question === 'Who was the father of Solomon?'));
});

test('an old plain-array facts file, or no file, makes no questions', () => {
  assert.deepEqual(generateQuestions([{ fact: 'x', value: 3 }]), []);
  assert.deepEqual(generateQuestions(null), []);
});

const ports = {
  entities: [
    { id: 'https', name: 'HTTPS', type: 'protocol' },
    { id: 'http', name: 'HTTP', type: 'protocol' },
    { id: 'ssh', name: 'SSH', type: 'protocol' },
  ],
  facts: [
    { subject: 'https', predicate: 'uses_port', object: 443 },
    { subject: 'http', predicate: 'uses_port', object: 80 },
    { subject: 'ssh', predicate: 'uses_port', object: 22 },
  ],
  templates: [{ predicate: 'uses_port', max: 445, exhaustive: ['ask_subject'],
    ask_object: 'Which port does {subject} use by default?',
    ask_subject: 'Which protocol uses port {object} by default?' }],
};

test('number answers: real values of the predicate first, then the set\'s, made-up last', () => {
  const written = [{ question: 'How many pins?', answer: '8', answerType: 'number' }];
  const rows = generateQuestions(ports, written);
  const q = ask(rows, 'Which port does HTTPS use by default?');
  assert.equal(q.answer, '443');
  assert.equal(q.answerType, 'number');
  assert.deepEqual(q.wrongTiers[0], ['80', '22']);
  assert.deepEqual(q.wrongTiers[1], ['8']);
  const madeUp = q.wrongTiers[2].map(Number);
  assert.equal(madeUp.length, FACT_QUESTIONS.madeUpCount);
  assert.ok(madeUp.every(n => Number.isInteger(n) && n >= 1 && n <= 445 && n !== 443 && Math.abs(n - 443) <= 111));
  const back = ask(rows, 'Which protocol uses port 443 by default?');
  assert.equal(back.answer, 'HTTPS');
  assert.deepEqual([...back.wrongTiers[0]].sort(), ['HTTP', 'SSH']);
});

test('made-up numbers stay at 1 or more and within the template bounds', () => {
  const small = {
    entities: [{ id: 'a', name: 'A', type: 'name' }],
    facts: [{ subject: 'a', predicate: 'count', object: 1 }],
    templates: [{ predicate: 'count', ask_object: 'How many for {subject}?', max: 3, exhaustive: ['ask_object'] }],
  };
  const [q] = withRandom(0.5, () => generateQuestions(small));
  assert.deepEqual([...q.wrongTiers[2]].sort(), ['2']);
});
