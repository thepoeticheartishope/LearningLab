// Mastery's page: five tabs. PRACTISE runs Mastery (adapted from
// DungeonCrawler js/masteryview.js, v416) on the facts picked, one
// question after another; PICK chooses which facts are in; LOG shows each
// picked fact's tier and the latest answers. Settles through mastery.js,
// saves the record and the picks in localStorage, and writes every answer
// to the Lab's shared answer log. STAGES walks any one fact through
// stages 1–5 (stagesview.js) without touching any of that. MAP
// (mapview.js) browses the bubble map of the facts past Recognition; a
// miss in PRACTISE shows the fact's map under the feedback (review only). With ?dev, buttons move the day on (to
// test rests) and move the question showing a tier up or down.
import { MASTERY, MASTERY_SET } from './config.js';
import { newMasteryRecord, masteryKey, masteryDay, masteryNext, masteryTier, masteryTask, masteryCredits, masteryCounts, settleMastery, evidenceCheck, shiftMasteryTier } from './mastery.js';
import { loadFactSet } from '../../shared/facts.js';
import { buildChoices } from '../../shared/choices.js';
import { logAnswer, readLog } from '../../shared/log.js';
import { answerKey, rightAnswers, escapeHtml } from '../../shared/text.js';
import { initStages, showStages, hideStages } from './stagesview.js';
import { initMap, showMap, hideMap, mountMissReview } from './mapview.js';
import { unlockedFacts } from '../../shared/termmap.js';
import { mountBubbles } from '../../shared/bubbles.js';

const isDev = new URLSearchParams(location.search).has('dev');
const letters = ['A', 'B', 'C', 'D'];
const TIER_NAMES = { 1: 'PRACTICING', 2: 'NEARLY MASTERED', 3: 'MASTERED CHECK', 4: 'MASTERED' };
const BET_NAMES = { 1: 'Low (1)', 2: 'Medium (2)', 3: 'High (3)' };
const EXP = 'mastery';
// Tier 1's answers as floating bubbles (shared/bubbles.js) or plain
// buttons; his pick is kept. Bubbles are calm when the device asks for
// reduced motion.
const ANSWER_MODES = { bubbles: 'Bubbles', buttons: 'Buttons' };
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

const box = document.getElementById('practise');
const pickBox = document.getElementById('pick');
const logBox = document.getElementById('log');
const stagesBox = document.getElementById('stages');
const mapBox = document.getElementById('map');

// Every fact the experiment knows (generated + hand-written with
// evidence), the record, the picked keys, and the question showing:
// its tier and task (kept, so the card still shows them after the answer
// moves the fact), options, bet (0 = none), evidence picked and checked,
// when it was shown, and once answered { given, right, events }.
const open = {
  all: [], record: newMasteryRecord(), picked: new Set(),
  q: null, tier: 1, task: 1, choices: [], bet: 0, answered: null, picked2: new Set(), checked: null, shownAt: 0,
  answerMode: 'bubbles', bub: null, bubHost: null, bubMarked: false, review: null,
};

// ---------- storage ----------

function loadJson(name, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(MASTERY.storageKey + name + '.' + MASTERY_SET) || 'null');
    return v ?? fallback;
  } catch { return fallback; }
}

function saveJson(name, value) {
  try { localStorage.setItem(MASTERY.storageKey + name + '.' + MASTERY_SET, JSON.stringify(value)); } catch { /* blocked */ }
}

function save() { saveJson('record', open.record); }
function savePicked() { saveJson('picked', [...open.picked]); }
open.answerMode = ANSWER_MODES[loadJson('answers', 'bubbles')] ? loadJson('answers', 'bubbles') : 'bubbles';

// Stops the question's bubbles (a new question, another tab, buttons picked).
function dropBubbles() {
  dropReview();
  open.bub?.destroy();
  open.bub = null;
  open.bubHost = null;
  open.bubMarked = false;
}

// Stops the after-miss map.
function dropReview() {
  open.review?.destroy();
  open.review = null;
}

// After a miss: the fact's bubble map under the feedback, review only.
function missReview() {
  if (!open.answered || open.answered.right) return;
  const unlocked = unlockedFacts(open.all, q => masteryTier(open.record, q) >= 2);
  open.review = mountMissReview(box, open.q, unlocked);
}

// Today's day number, moved on by DEV's skipped days.
function today() {
  return masteryDay(new Date()) + (open.record.dayShift || 0);
}

function pickedFacts() {
  return open.all.filter(q => open.picked.has(masteryKey(q)));
}

// ---------- tabs ----------

const tabs = [...document.querySelectorAll('[data-tab]')];
function showTab(name) {
  tabs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  box.hidden = name !== 'practise';
  pickBox.hidden = name !== 'pick';
  logBox.hidden = name !== 'log';
  stagesBox.hidden = name !== 'stages';
  mapBox.hidden = name !== 'map';
  if (name !== 'practise') dropBubbles();
  if (name !== 'map') hideMap();
  if (name !== 'stages') hideStages();
  if (name === 'practise') next();
  if (name === 'pick') drawPick();
  if (name === 'log') drawLog();
  if (name === 'stages') showStages(open.picked);
  if (name === 'map') showMap(unlockedFacts(open.all, q => masteryTier(open.record, q) >= 2), isDev);
}
tabs.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- practise ----------

function next() {
  const facts = pickedFacts();
  open.q = facts.length ? masteryNext(open.record, facts, today()) : null;
  show();
}

// Sets up the question in `open.q` at its tier, fresh, and draws it.
function show() {
  dropBubbles();
  open.tier = open.q ? masteryTier(open.record, open.q) : 1;
  open.task = open.q ? masteryTask(open.record, open.q) : 1;
  open.bet = 0;
  open.answered = null;
  open.picked2 = new Set();
  open.checked = null;
  open.choices = open.task === 1 && open.q ? buildChoices(open.q) : [];
  open.shownAt = Date.now();
  draw();
}

function answer(given) {
  if (open.answered) return;
  settle(given, rightAnswers(open.q).has(answerKey(given)));
}

// Settles the answer, logs it and draws what happened. A fact with an
// evidence scenario has a tier 2 to move up to and drop back to.
function settle(given, right) {
  const ms = Date.now() - open.shownAt;
  const events = settleMastery(open.record, open.q, { bet: open.bet, right }, today(), !!open.q.evidence);
  open.answered = { given, right, events };
  save();
  const moved = events.find(e => e.type !== 'masteryAnswered');
  logAnswer({
    exp: EXP, set: MASTERY_SET, key: masteryKey(open.q), given, right, ms,
    tier: open.tier, task: open.task, bet: open.bet || null,
    answers: open.task === 1 ? open.answerMode : null,
    day: today(), change: moved ? moved.type.replace('mastery', '').toLowerCase() : null,
  });
  draw();
}

// Tier 2's CHECK: only the first check settles (right = every clue, no
// false mark); a check after TRY AGAIN only shows the marks.
function checkEvidence() {
  open.checked = evidenceCheck(open.q.evidence, open.picked2);
  if (open.answered) draw();
  else settle(null, open.checked.perfect);
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(text, onClick, className = '') {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function draw() {
  dropReview();
  box.innerHTML = '';
  if (!pickedFacts().length) {
    box.append(el('p', 'muted', 'No facts picked yet.'), button('Pick facts', () => showTab('pick')));
    return;
  }
  if (!open.q) {
    box.append(el('p', '', 'Every fact is resting. Come back tomorrow.'), statusLine());
    if (isDev) box.append(devRow());
    return;
  }
  const q = open.q;
  const task = open.task;
  const head = el('div', 'm-head');
  head.append(el('span', 'm-tier tier-' + open.tier, TIER_NAMES[open.tier]), el('span', 'muted', 'Score ' + open.record.score));
  box.append(head);
  if (open.tier < 4) box.append(creditBar());
  box.append(el('p', 'muted small', 'How sure are you? Optional.'), betRow());
  box.append(el('p', 'm-question', q.question));
  if (task === 2) box.append(el('p', 'm-answer', 'Answer: ' + q.answer));
  box.append(el('p', 'muted small', { 1: 'Pick the answer.', 2: 'Tap every phrase that is evidence for this answer.', 3: 'Type the answer.' }[task]));
  if (task === 2) {
    box.append(evidenceScene());
    if (open.answered) box.append(...resultLines());
    if (open.checked) box.append(...evidenceLines());
    missReview();
    box.append(evidenceButtons());
  } else {
    box.append(task === 1 ? optionList() : typedRow());
    if (open.answered) box.append(...resultLines());
    missReview();
    if (open.answered) box.append(nextRow());
  }
  box.append(statusLine());
  if (isDev) box.append(devRow());
  open.bub?.resize();
}

// The fact's credits on the tier it was asked at: a full bar once the
// answer moved it up (the record has already started the next tier at 0).
function creditBar() {
  const movedUp = open.answered && open.answered.events.some(e => e.type === 'masteryMovedUp');
  const n = movedUp ? MASTERY.bar : masteryCredits(open.record, open.q);
  const wrap = el('div', 'm-credits');
  const bar = el('div', 'm-bar');
  const fill = el('div', 'm-fill');
  fill.style.width = Math.min(100, (n / MASTERY.bar) * 100) + '%';
  bar.append(fill);
  wrap.append(el('span', 'muted small', 'Credits ' + n + ' / ' + MASTERY.bar), bar);
  return wrap;
}

// The three bets; tapping the picked one again takes it back. Locked once answered.
function betRow() {
  const row = el('div', 'row');
  row.setAttribute('role', 'group');
  MASTERY.bets.forEach(bet => {
    const b = button(BET_NAMES[bet], () => { open.bet = open.bet === bet ? 0 : bet; draw(); }, 'bet');
    b.disabled = !!open.answered;
    b.setAttribute('aria-pressed', String(open.bet === bet));
    row.append(b);
  });
  return row;
}

// Tier 1's switch: answers as bubbles or plain buttons.
function answerModeRow() {
  const row = el('div', 'row m-answer-mode');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Answers as');
  row.append(el('span', 'muted small', 'Answers as'));
  Object.entries(ANSWER_MODES).forEach(([mode, name]) => {
    const b = button(name, () => {
      if (open.answerMode === mode) return;
      open.answerMode = mode;
      saveJson('answers', mode);
      dropBubbles();
      draw();
    }, 'small');
    b.setAttribute('aria-pressed', String(open.answerMode === mode));
    row.append(b);
  });
  return row;
}

// Tier 1 as bubbles: mounted once per question and moved back in on every
// redraw, so they keep floating. Once answered the right one turns green,
// a wrong pick red, and the rest fade.
function bubbleList() {
  if (!open.bub) {
    open.bubHost = el('div', 'm-bubbles');
    open.bub = mountBubbles(open.bubHost, { answers: open.choices, onPick: answer, calm: reducedMotion });
  }
  if (open.answered && !open.bubMarked) {
    open.bubMarked = true;
    const right = rightAnswers(open.q);
    open.choices.forEach((opt) => {
      if (right.has(answerKey(opt))) open.bub.mark(opt, 'ok');
      else if (opt === open.answered.given) open.bub.mark(opt, 'bad');
    });
    open.bub.dim();
  }
  const wrap = el('div');
  wrap.append(answerModeRow(), open.bubHost);
  return wrap;
}

// Tier 1: the options; once answered the right one is marked, a wrong pick struck.
function optionList() {
  if (open.answerMode === 'bubbles') return bubbleList();
  const list = el('div', 'm-options');
  open.choices.forEach((opt, i) => {
    const b = button('', () => answer(opt), 'm-option');
    b.innerHTML = '<span class="letter">' + letters[i] + '</span> ' + escapeHtml(opt);
    if (open.answered) {
      b.disabled = true;
      const isRight = rightAnswers(open.q).has(answerKey(opt));
      if (isRight) b.classList.add('opt-right');
      else if (opt === open.answered.given) b.classList.add('opt-struck');
    }
    list.append(b);
  });
  const wrap = el('div');
  wrap.append(answerModeRow(), list);
  return wrap;
}

// Tiers 3 and 4: type the answer; Enter or CHECK settles it.
function typedRow() {
  const row = el('div', 'row');
  const input = el('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Type the answer');
  const b = button('Check', () => go());
  if (open.answered) {
    input.value = open.answered.given;
    input.disabled = b.disabled = true;
  }
  const go = () => { if (input.value.trim()) answer(input.value); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  row.append(input, b);
  if (!open.answered) setTimeout(() => input.focus(), 0);
  return row;
}

// Tier 2: the scenario, its phrases tappable in the flow of the text.
// Once checked, each phrase shows its mark: found, missed or false mark.
function evidenceScene() {
  const scene = el('p', 'm-scene');
  const marks = open.checked;
  open.q.evidence.forEach((part, i) => {
    if (typeof part === 'string') { scene.append(part); return; }
    const phrase = el('span', 'm-phrase', part.clue || part.tap);
    phrase.setAttribute('role', 'button');
    phrase.setAttribute('aria-pressed', String(open.picked2.has(i)));
    if (marks) {
      phrase.setAttribute('aria-disabled', 'true');
      const mark = markOf(marks, i);
      if (mark) phrase.classList.add('mark-' + mark);
      scene.append(phrase);
      return;
    }
    phrase.tabIndex = 0;
    const flip = () => {
      if (open.picked2.has(i)) open.picked2.delete(i);
      else open.picked2.add(i);
      draw();
      const again = box.querySelectorAll('.m-phrase')[[...scene.querySelectorAll('.m-phrase')].indexOf(phrase)];
      if (again) again.focus();
    };
    phrase.addEventListener('click', flip);
    phrase.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      flip();
    });
    scene.append(phrase);
  });
  return scene;
}

function markOf(marks, i) {
  if (marks.found.includes(i)) return 'found';
  if (marks.missed.includes(i)) return 'missed';
  if (marks.falseMarks.includes(i)) return 'false';
  return null;
}

// Tier 2's buttons: CHECK EVIDENCE before a check; after one, TRY AGAIN
// (another go that scores nothing) and, once settled, NEXT.
function evidenceButtons() {
  const row = el('div', 'row');
  if (!open.checked) {
    row.append(button('Check evidence', checkEvidence));
    return row;
  }
  row.append(button('Try again', () => { open.picked2 = new Set(); open.checked = null; draw(); }));
  if (open.answered) row.append(...nextRow().children);
  return row;
}

const MARK_NAMES = { found: 'FOUND', missed: 'MISSED', false: 'FALSE MARK' };

function evidenceLines() {
  const marks = open.checked;
  const lines = [el('p', 'm-change', marks.found.length + ' of ' + marks.clues + ' clues found, ' + plural(marks.falseMarks.length, 'false mark') + '.')];
  const list = el('ul', 'm-whys');
  open.q.evidence.forEach((part, i) => {
    const mark = markOf(marks, i);
    if (!mark) return;
    const item = el('li');
    item.append(el('span', 'mark-' + mark, MARK_NAMES[mark] + ' ' + (part.clue || part.tap) + ':'), ' ' + part.why);
    list.append(item);
  });
  lines.push(list);
  return lines;
}

// The answer's lines: right or wrong with its credits, the note, then a
// move up, a kept mastery or a drop.
function resultLines() {
  const lines = [];
  open.answered.events.forEach(e => {
    if (e.type === 'masteryAnswered') {
      const n = Math.abs(e.credits);
      lines.push(el('p', 'm-result ' + (e.right ? 'right' : 'wrong'), e.right
        ? 'Right. +' + plural(n, 'credit') + '.'
        : open.task === 2
          ? 'Not this time. -' + plural(n, 'credit') + '.'
          : 'Not this time. -' + plural(n, 'credit') + '. It was ' + open.q.answer + '.'));
      if (open.q.note) lines.push(el('p', 'muted', open.q.note));
    }
    if (e.type === 'masteryMovedUp') lines.push(el('p', 'm-change', 'Moved up to ' + TIER_NAMES[e.tier] + '. Back after ' + plural(e.questions, 'question') + ' and ' + plural(e.days, 'day') + '.'));
    if (e.type === 'masteryKept') lines.push(el('p', 'm-change', 'Still mastered. Back after ' + plural(e.questions, 'question') + ' and ' + plural(e.days, 'day') + '.'));
    if (e.type === 'masteryDropped') lines.push(el('p', 'm-change', 'Dropped to ' + TIER_NAMES[e.tier] + '.'));
  });
  return lines;
}

function nextRow() {
  const row = el('div', 'row');
  const b = button('Next', next);
  row.append(b);
  setTimeout(() => b.focus(), 0);
  return row;
}

function statusLine() {
  const c = masteryCounts(open.record, pickedFacts(), today());
  return el('p', 'muted small m-status', `${c.learning} learning, ${c.resting} resting, ${c.mastered} mastered, ${c.fresh} new`);
}

// DEV only: move the question showing a tier down or up, and move the day on.
function devRow() {
  const row = el('div', 'row m-dev');
  const shift = step => () => {
    shiftMasteryTier(open.record, open.q, step, today(), !!open.q.evidence);
    save();
    show();
  };
  if (open.q) row.append(button('DEV: tier down', shift(-1)), button('DEV: tier up', shift(1)));
  row.append(button('DEV: next day', () => {
    open.record.dayShift = (open.record.dayShift || 0) + 1;
    save();
    if (!open.q || open.answered) next();
    else draw();
  }), el('span', 'muted small', 'Day +' + (open.record.dayShift || 0)));
  return row;
}

// ---------- pick ----------

// Every fact, grouped by its source tag, each with a tick box. Ticking
// saves at once. A fact already practised keeps its record when unticked.
function drawPick() {
  pickBox.innerHTML = '';
  const top = el('div', 'row');
  const count = el('span', 'muted', '');
  const setCount = () => { count.textContent = open.picked.size + ' of ' + open.all.length + ' picked'; };
  top.append(
    button('Pick all', () => { open.all.forEach(q => open.picked.add(masteryKey(q))); savePicked(); drawPick(); }),
    button('Pick none', () => { open.picked.clear(); savePicked(); drawPick(); }),
    count,
  );
  pickBox.append(el('p', 'muted', 'Tick the facts to practise (about 30 you don\'t know cold). ★ = has an evidence scenario.'), top);
  const groups = new Map();
  open.all.forEach(q => {
    const g = q.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(q);
  });
  groups.forEach((list, name) => {
    pickBox.append(el('h3', '', name));
    const ul = el('ul', 'pick-list');
    list.forEach(q => {
      const key = masteryKey(q);
      const li = el('li');
      const label = el('label');
      const box2 = el('input');
      box2.type = 'checkbox';
      box2.checked = open.picked.has(key);
      box2.addEventListener('change', () => {
        if (box2.checked) open.picked.add(key);
        else open.picked.delete(key);
        savePicked();
        setCount();
      });
      const seen = open.record.facts[key];
      label.append(box2, ' ' + (q.evidence ? '★ ' : '') + q.question + ' ', el('span', 'muted', '— ' + q.answer));
      if (seen) label.append(' ', el('span', 'tag', TIER_NAMES[seen.tier]));
      li.append(label);
      ul.append(li);
    });
    pickBox.append(ul);
  });
  setCount();
}

// ---------- log ----------

// Each picked fact's tier, credits and rest, with its right / wrong count
// from the shared log; then the latest answers.
function drawLog() {
  logBox.innerHTML = '';
  const day = today();
  const entries = readLog().filter(e => e.exp === EXP);
  const tally = new Map();
  entries.forEach(e => {
    const t = tally.get(e.key) || { right: 0, wrong: 0 };
    t[e.right ? 'right' : 'wrong']++;
    tally.set(e.key, t);
  });
  const facts = pickedFacts();
  logBox.append(el('h3', '', 'Picked facts'));
  if (!facts.length) logBox.append(el('p', 'muted', 'None picked.'));
  else {
    const table = el('table', 'm-table');
    table.innerHTML = '<thead><tr><th>Fact</th><th>Tier</th><th>Credits</th><th>Rest</th><th>✓ / ✗</th></tr></thead>';
    const body = el('tbody');
    const sorted = facts.slice().sort((a, b) => masteryTier(open.record, b) - masteryTier(open.record, a));
    sorted.forEach(q => {
      const key = masteryKey(q);
      const entry = open.record.facts[key];
      const t = tally.get(key) || { right: 0, wrong: 0 };
      let rest = entry ? 'ready' : 'new';
      if (entry && (entry.restQuestions > 0 || day < entry.restDay)) {
        const parts = [];
        if (entry.restQuestions > 0) parts.push(plural(entry.restQuestions, 'question'));
        if (day < entry.restDay) parts.push(plural(entry.restDay - day, 'day'));
        rest = parts.join(' + ');
      }
      const tr = el('tr');
      tr.append(
        el('td', '', q.question),
        el('td', 'tier-' + (entry ? entry.tier : 1), entry ? TIER_NAMES[entry.tier] : '—'),
        el('td', '', entry && entry.tier < 4 ? entry.credits + '/' + MASTERY.bar : ''),
        el('td', '', rest),
        el('td', '', t.right + ' / ' + t.wrong),
      );
      body.append(tr);
    });
    table.append(body);
    logBox.append(table);
  }
  logBox.append(el('h3', '', 'Latest answers'));
  const byKey = new Map(open.all.map(q => [masteryKey(q), q]));
  const latest = entries.slice(-30).reverse();
  if (!latest.length) logBox.append(el('p', 'muted', 'No answers yet.'));
  const ul = el('ul', 'm-latest');
  latest.forEach(e => {
    const q = byKey.get(e.key);
    const li = el('li');
    const when = new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    li.append(
      el('span', e.right ? 'right' : 'wrong', e.right ? '✓ ' : '✗ '),
      (q ? q.question : e.key) + ' ',
      el('span', 'muted small', `${TIER_NAMES[e.task] || ''} · bet ${e.bet || '—'} · ${Math.round((e.ms || 0) / 100) / 10}s · ${when}${e.change ? ' · ' + e.change : ''}${e.given && !e.right ? ' · gave "' + e.given + '"' : ''}`),
    );
    ul.append(li);
  });
  logBox.append(ul, el('p', 'muted small', 'The full log (every experiment) exports from the Lab menu.'));
}

// ---------- start ----------

async function start() {
  try {
    const set = await loadFactSet(MASTERY_SET, '../../');
    const res = await fetch('scenarios.json');
    const scenarios = res.ok ? await res.json() : [];
    const scenarioKeys = new Set(scenarios.map(masteryKey));
    open.all = [
      ...scenarios.map(q => ({ ...q, group: 'With evidence scenarios' })),
      ...set.questions.filter(q => !scenarioKeys.has(masteryKey(q))).map(q => ({ ...q, group: groupOf(q) })),
    ];
    initStages(open.all, set.data);
    initMap(set.data);
  } catch (err) {
    box.textContent = 'Could not load the facts: ' + err.message;
    return;
  }
  const saved = loadJson('record', null);
  if (saved && saved.facts && Array.isArray(saved.log)) open.record = saved;
  open.picked = new Set(loadJson('picked', []));
  showTab(open.picked.size ? 'practise' : 'pick');
}

// A generated row's group on the Pick screen: by the predicate it asks.
const GROUPS = {
  'pin_count:object': 'Connector pins',
  'module_pins:object': 'Memory module pins',
  'uses_port:object': 'Port of a protocol',
  'uses_port:subject': 'Protocol on a port',
  'used_on:object': 'Cable for a connector',
  'used_on:subject': 'Connector for a cable',
  'runs_over:object': 'Transport of a protocol',
  'runs_over:subject': 'Protocol over a transport',
  'secure_version:object': 'Secure replacement',
  'secure_version:subject': 'Older plain-text protocol',
  'mail_sent_by:object': 'Mail sending protocol',
};
function groupOf(q) {
  const f = q.fromFacts && q.fromFacts[0];
  if (!f) return 'Other numbers';
  return GROUPS[f.predicate + ':' + f.asks] || 'Other numbers';
}

start();
