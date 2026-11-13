// The STAGES tab: pick any fact and walk it through stages 1–5 of
// LEARNING-STYLE.md (stages.js), one after another or by jumping to a
// stage. For testing the Lab in full: nothing here changes the mastery
// record or writes to the answer log.
import { STAGES, factEntities, relatedFacts } from './stages.js';
import { evidenceCheck, masteryKey } from './mastery.js';
import { buildChoices } from '../../shared/choices.js';
import { readTriples } from '../../shared/factgen.js';
import { answerKey, rightAnswers, escapeHtml } from '../../shared/text.js';
import { mapOfTerm, mountMapPanel } from './mapview.js';

const PICTURE = ['svg', 'png', 'webp'];
const SOUND = ['mp3', 'ogg', 'wav'];
const letters = ['A', 'B', 'C', 'D'];

const box = document.getElementById('stages');

// The facts, the file's triples, the fact and stage showing, and the
// stage's own state: options, the answer given, evidence picked / checked.
const walk = { all: [], triples: { facts: [], labels: {} }, i: 0, stage: 1, choices: [], given: null, picked: new Set(), checked: null, map: null };

// Stops stage 3's map (a redraw, another tab).
export function hideStages() {
  walk.map?.destroy();
  walk.map = null;
}

export function initStages(all, data) {
  walk.all = all;
  walk.triples = readTriples(data);
}

// Draws the tab, starting on the first fact in `pickedKeys` if there is one.
export function showStages(pickedKeys) {
  if (!walk.drawn) {
    const first = walk.all.findIndex(q => pickedKeys.has(masteryKey(q)));
    walk.i = Math.max(0, first);
    walk.drawn = true;
    goTo(1);
  } else draw();
}

function goTo(stage) {
  walk.stage = stage;
  walk.given = null;
  walk.picked = new Set();
  walk.checked = null;
  walk.choices = stage === 2 ? buildChoices(walk.all[walk.i]) : [];
  draw();
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
  hideStages();
  box.innerHTML = '';
  if (!walk.all.length) { box.append(el('p', 'muted', 'No facts loaded.')); return; }
  const q = walk.all[walk.i];
  box.append(el('p', 'muted small', 'Walk one fact through all five stages. Practice only: nothing here changes tiers or the log.'));
  box.append(factPicker());
  const bar = el('div', 'row s-bar');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Stage');
  STAGES.forEach(s => {
    const b = button(s.n + ' ' + s.name, () => goTo(s.n));
    b.setAttribute('aria-pressed', String(walk.stage === s.n));
    bar.append(b);
  });
  box.append(bar);
  const stage = STAGES[walk.stage - 1];
  box.append(el('p', 'm-tier', 'STAGE ' + stage.n + ' · ' + stage.name.toUpperCase()), el('p', 'muted small', stage.task));
  ({ 1: association, 2: recognition, 3: reinforcement, 4: analysis, 5: recall })[walk.stage](q);
  const nav = el('div', 'row s-nav');
  if (walk.stage > 1) nav.append(button('← Stage ' + (walk.stage - 1), () => goTo(walk.stage - 1)));
  if (walk.stage < 5) nav.append(button('Stage ' + (walk.stage + 1) + ' →', () => goTo(walk.stage + 1)));
  else nav.append(button('Next fact →', () => { walk.i = (walk.i + 1) % walk.all.length; goTo(1); }));
  box.append(nav);
}

// Every fact, grouped as on the Pick screen; ★ = has an evidence scenario.
function factPicker() {
  const select = el('select', 's-fact');
  select.setAttribute('aria-label', 'Fact');
  const groups = new Map();
  walk.all.forEach((q, i) => {
    if (!groups.has(q.group)) {
      const g = el('optgroup');
      g.label = q.group;
      groups.set(q.group, g);
      select.append(g);
    }
    const o = el('option', '', (q.evidence ? '★ ' : '') + q.question + ' — ' + q.answer);
    o.value = String(i);
    groups.get(q.group).append(o);
  });
  select.value = String(walk.i);
  select.addEventListener('change', () => { walk.i = Number(select.value); goTo(1); });
  return select;
}

// Stage 1: the term(s) and the fact, with a picture or sound for each
// entity that has one in data/media/.
function association(q) {
  const ids = factEntities(q, walk.triples);
  const names = ids.map(id => nameOf(id)).filter(Boolean);
  box.append(el('p', 'm-question', names.length ? names.join(' · ') : q.answer));
  box.append(el('p', '', q.question), el('p', 'm-answer', q.answer));
  const media = el('div', 'row s-media');
  const none = el('p', 'muted small', ids.length ? 'Checking for a picture or sound…' : 'No entity found for this fact, so no picture or sound.');
  box.append(media, none);
  if (!ids.length) return;
  findMedia(ids).then(found => {
    if (!box.contains(media)) return;
    found.forEach(m => {
      if (m.kind === 'picture') {
        const img = el('img', 's-pic');
        img.src = m.url;
        img.alt = nameOf(m.id) || m.id;
        media.append(img);
      } else {
        const audio = el('audio');
        audio.controls = true;
        audio.src = m.url;
        media.append(audio);
      }
    });
    none.textContent = found.length ? '' : 'No picture or sound yet (data/media/<entity-id>.svg or .mp3).';
  });
}

function nameOf(id) {
  for (const f of walk.triples.facts) {
    if (f.subject.id === id) return f.subject.name;
    if (typeof f.object !== 'number' && f.object.id === id) return f.object.name;
  }
  return null;
}

async function findMedia(ids) {
  const tries = ids.flatMap(id => [
    ...PICTURE.map(ext => ({ id, kind: 'picture', url: '../../data/media/' + id + '.' + ext })),
    ...SOUND.map(ext => ({ id, kind: 'sound', url: '../../data/media/' + id + '.' + ext })),
  ]);
  const ok = await Promise.all(tries.map(t => fetch(t.url, { method: 'HEAD' }).then(r => r.ok, () => false)));
  const found = tries.filter((t, i) => ok[i]);
  // One picture and one sound per entity at most.
  const seen = new Set();
  return found.filter(t => !seen.has(t.id + t.kind) && seen.add(t.id + t.kind));
}

function noteLine(q) {
  if (q.note) box.append(el('p', 'muted', q.note));
}

// Stage 2: pick from four.
function recognition(q) {
  box.append(el('p', 'm-question', q.question));
  const list = el('div', 'm-options');
  walk.choices.forEach((opt, i) => {
    const b = button('', () => { if (walk.given === null) { walk.given = opt; draw(); } }, 'm-option');
    b.innerHTML = '<span class="letter">' + letters[i] + '</span> ' + escapeHtml(opt);
    if (walk.given !== null) {
      b.disabled = true;
      if (rightAnswers(q).has(answerKey(opt))) b.classList.add('opt-right');
      else if (opt === walk.given) b.classList.add('opt-struck');
    }
    list.append(b);
  });
  box.append(list);
  if (walk.given !== null) {
    resultLine(q, rightAnswers(q).has(answerKey(walk.given)));
    noteLine(q);
  }
}

function resultLine(q, right) {
  box.append(el('p', 'm-result ' + (right ? 'right' : 'wrong'), right ? 'Right.' : 'Not this time. It was ' + q.answer + '.'));
}

// Stage 3: the fact, then its term's bubble map (every link, no unlock:
// the walk is for testing), with the fact's own link explained first. A
// fact with no map falls back to the plain list of related facts.
function reinforcement(q) {
  box.append(el('p', 'm-question', q.question), el('p', 'm-answer', q.answer));
  noteLine(q);
  box.append(el('h3', '', 'What it connects to'));
  const own = (q.fromFacts || [])[0];
  const centres = own ? [own.subject] : factEntities(q, walk.triples);
  const centre = centres.find(id => mapOfTerm(id, null));
  if (centre) {
    const map = mapOfTerm(centre, null);
    const focus = own ? (typeof own.object === 'number' ? '#' + own.predicate + ':' + own.object : own.object) : null;
    const host = el('div', 'map-host');
    box.append(host);
    walk.map = mountMapPanel(host, map, focus);
  } else {
    const lines = relatedFacts(q, walk.triples);
    if (!lines.length) box.append(el('p', 'muted', 'No related facts in the fact file yet.'));
    else {
      const ul = el('ul', 'm-whys');
      lines.forEach(line => ul.append(el('li', '', line)));
      box.append(ul);
    }
  }
  if (q.source) box.append(el('p', 'muted small', 'Source: ' + q.source));
}

// Stage 4: tap the evidence (only facts with a scenario, ★).
function analysis(q) {
  box.append(el('p', 'm-question', q.question), el('p', 'm-answer', 'Answer: ' + q.answer));
  if (!q.evidence) {
    box.append(el('p', 'muted', 'No scenario for this fact yet. Only ★ facts have one.'));
    return;
  }
  const scene = el('p', 'm-scene');
  q.evidence.forEach((part, i) => {
    if (typeof part === 'string') { scene.append(part); return; }
    const phrase = el('span', 'm-phrase', part.clue || part.tap);
    phrase.setAttribute('role', 'button');
    phrase.setAttribute('aria-pressed', String(walk.picked.has(i)));
    if (walk.checked) {
      phrase.setAttribute('aria-disabled', 'true');
      const mark = markOf(walk.checked, i);
      if (mark) phrase.classList.add('mark-' + mark);
    } else {
      phrase.tabIndex = 0;
      const flip = () => {
        if (walk.picked.has(i)) walk.picked.delete(i); else walk.picked.add(i);
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
    }
    scene.append(phrase);
  });
  box.append(scene);
  const row = el('div', 'row');
  if (!walk.checked) {
    row.append(button('Check evidence', () => { walk.checked = evidenceCheck(q.evidence, walk.picked); draw(); }));
    box.append(row);
    return;
  }
  const marks = walk.checked;
  box.append(el('p', 'm-change', marks.found.length + ' of ' + marks.clues + ' clues found, ' + marks.falseMarks.length + ' false mark' + (marks.falseMarks.length === 1 ? '' : 's') + '.'));
  const list = el('ul', 'm-whys');
  q.evidence.forEach((part, i) => {
    const mark = markOf(marks, i);
    if (!mark) return;
    const item = el('li');
    item.append(el('span', 'mark-' + mark, { found: 'FOUND', missed: 'MISSED', false: 'FALSE MARK' }[mark] + ' ' + (part.clue || part.tap) + ':'), ' ' + part.why);
    list.append(item);
  });
  box.append(list);
  row.append(button('Try again', () => { walk.picked = new Set(); walk.checked = null; draw(); }));
  box.append(row);
}

function markOf(marks, i) {
  if (marks.found.includes(i)) return 'found';
  if (marks.missed.includes(i)) return 'missed';
  if (marks.falseMarks.includes(i)) return 'false';
  return null;
}

// Stage 5: type it.
function recall(q) {
  box.append(el('p', 'm-question', q.question));
  const row = el('div', 'row');
  const input = el('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Type the answer');
  const go = () => { if (input.value.trim()) { walk.given = input.value; draw(); } };
  const b = button('Check', go);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  if (walk.given !== null) {
    input.value = walk.given;
    input.disabled = b.disabled = true;
  } else setTimeout(() => input.focus(), 0);
  row.append(input, b);
  box.append(row);
  if (walk.given !== null) {
    resultLine(q, rightAnswers(q).has(answerKey(walk.given)));
    noteLine(q);
    box.append(button('Try again', () => goTo(5)));
  }
}
