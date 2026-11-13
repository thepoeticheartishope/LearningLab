// Bubble answers' page: rounds of port questions, answered either by
// tapping floating bubbles (shared/bubbles.js) or plain buttons. The round
// engine (round.js), choices, feedback and review are the same in both
// modes. After a round the Next button suggests the other mode, so rounds
// alternate unless he switches. Every tap goes to the shared answer log
// with its mode, so the summary line can compare the two.
import { BUBBLES } from './config.js';
import { otherMode, rowsFor, newRound, retryRound, current, answer, nextQuestion, factFor, modeSummary } from './round.js';
import { loadFactSet } from '../../shared/facts.js';
import { readTriples } from '../../shared/factgen.js';
import { buildChoices } from '../../shared/choices.js';
import { logAnswer, readLog } from '../../shared/log.js';
import { mountBubbles } from '../../shared/bubbles.js';

const EXP = 'bubbles';
const $ = id => document.getElementById(id);
const modeButtons = [...document.querySelectorAll('[data-mode]')];

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

// rows: the port questions; facts: the set's facts (for the wrong-tap
// note); choices + marks (answer → 'ok' | 'bad') of the question showing;
// shownAt: when it was shown; bubbles: the mounted bubbles, if any.
const st = {
  rows: [], facts: [], round: null, mode: 'bubbles', calm: reduced,
  choices: [], marks: new Map(), shownAt: 0, bubbles: null,
};

// ---------- answers area ----------

function unmountAnswers() {
  st.bubbles?.destroy();
  st.bubbles = null;
  $('answers').innerHTML = '';
}

function drawAnswers() {
  unmountAnswers();
  if (!current(st.round)) return;
  if (st.mode === 'bubbles') {
    st.bubbles = mountBubbles($('answers'), { answers: st.choices, onPick: pick, calm: st.calm });
    st.marks.forEach((m, a) => st.bubbles.mark(a, m));
    if (st.round.solved) st.bubbles.dim();
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'b-buttons';
  st.choices.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a;
    b.dataset.answer = a;
    b.addEventListener('click', () => pick(a));
    grid.appendChild(b);
  });
  $('answers').appendChild(grid);
  markButtons();
}

function markButtons() {
  document.querySelectorAll('.b-buttons button').forEach((b) => {
    const m = st.marks.get(b.dataset.answer);
    b.classList.toggle('ok', m === 'ok');
    b.classList.toggle('bad', m === 'bad');
    b.classList.toggle('faded', st.round.solved && m !== 'ok');
    b.disabled = !!m || st.round.solved;
  });
}

// ---------- a tap ----------

function pick(given) {
  if (st.marks.has(given)) return;          // tapped already
  const q = current(st.round);
  const res = answer(st.round, given);
  if (!res) return;
  logAnswer({
    exp: EXP, set: BUBBLES.set, key: q.key, given, right: res.right,
    ms: Math.round(performance.now() - st.shownAt), mode: st.mode, firstTry: res.firstTry, calm: st.calm,
  });
  st.marks.set(given, res.right ? 'ok' : 'bad');
  if (res.right) {
    feedback('Correct: ' + q.answer + '.', 'right');
    st.bubbles?.mark(given, 'ok');
    st.bubbles?.dim();
    showNext(st.round.i + 1 >= st.round.items.length ? 'See results' : 'Next question');
  } else {
    const f = factFor(st.facts, BUBBLES.predicate, given);
    feedback('Not quite. ' + (f ? BUBBLES.note(f.name, f.value) + ' ' : '') + 'Try another.', 'wrong');
    st.bubbles?.mark(given, 'bad');
  }
  markButtons();
  drawTop();
  drawSummary();
}

// ---------- screens ----------

function feedback(text, kind = '') {
  $('feedback').textContent = text;
  $('feedback').className = 'b-feedback' + (kind ? ' ' + kind : '');
}

function showNext(label) {
  $('next').textContent = label;
  $('next').hidden = false;
}

function drawTop() {
  const r = st.round;
  $('progress').textContent = r.over ? 'Round complete' : 'Question ' + (r.i + 1) + ' of ' + r.items.length;
  $('score').textContent = 'First try: ' + r.score + (r.over ? ' of ' + r.items.length : '');
  $('bar').style.width = (r.over ? 100 : (r.i / r.items.length) * 100) + '%';
}

function drawModes() {
  modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
  $('calm').setAttribute('aria-pressed', String(st.calm));
  $('calm').disabled = st.mode !== 'bubbles';
}

function showQuestion() {
  const q = current(st.round);
  st.choices = buildChoices(q, BUBBLES.choices);
  st.marks = new Map();
  $('question').textContent = q.question;
  $('next').hidden = true;
  $('retry').hidden = true;
  $('review').hidden = true;
  feedback('Tap the answer you think is right.');
  drawTop();
  drawAnswers();
  st.shownAt = performance.now();
}

function finish() {
  const r = st.round;
  unmountAnswers();
  drawTop();
  const next = otherMode(st.mode).toUpperCase();
  $('question').textContent = r.missed.length ? 'Review these ' + r.missed.length + ':' : 'All right on the first try.';
  feedback('');
  $('review').innerHTML = '';
  r.missed.forEach((q) => {
    const li = document.createElement('li');
    const b = document.createElement('strong');
    b.textContent = q.answer;
    li.append(q.question + ' ', b);
    $('review').appendChild(li);
  });
  $('review').hidden = !r.missed.length;
  showNext('Next round (' + next + ')');
  $('retry').textContent = 'Retry missed (' + next + ')';
  $('retry').hidden = !r.missed.length;
}

function startRound(round) {
  st.round = round;
  drawModes();
  showQuestion();
}

function drawSummary() {
  const s = modeSummary(readLog());
  const line = (name, m) => name + ': ' + (m.questions
    ? m.firstTryPct + '% first try, ' + (m.avgMs == null ? '?' : (m.avgMs / 1000).toFixed(1) + ' s') + ' average (' + m.questions + (m.questions === 1 ? ' question)' : ' questions)')
    : 'no answers yet');
  $('summary').textContent = line('Bubbles', s.bubbles) + ' · ' + line('Buttons', s.buttons);
}

// ---------- controls ----------

$('next').addEventListener('click', () => {
  if (st.round.over) {
    st.mode = otherMode(st.mode);
    startRound(newRound(st.rows, BUBBLES.roundSize));
    return;
  }
  nextQuestion(st.round);
  if (st.round.over) finish(); else showQuestion();
});

$('retry').addEventListener('click', () => {
  st.mode = otherMode(st.mode);
  startRound(retryRound(st.round));
});

modeButtons.forEach(b => b.addEventListener('click', () => {
  if (st.mode === b.dataset.mode) return;
  st.mode = b.dataset.mode;
  drawModes();
  drawAnswers();
}));

$('calm').addEventListener('click', () => {
  st.calm = !st.calm;
  st.bubbles?.setCalm(st.calm);
  drawModes();
});

// ---------- start ----------

loadFactSet(BUBBLES.set, '../../').then((set) => {
  st.rows = rowsFor(set.questions, BUBBLES.predicate);
  st.facts = readTriples(set.data).facts;
  drawSummary();
  startRound(newRound(st.rows, BUBBLES.roundSize));
}).catch((err) => {
  $('question').textContent = 'Could not load the facts: ' + err.message;
});

