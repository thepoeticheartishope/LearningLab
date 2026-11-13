// The MAP tab (bubble map plan step A): browse the terms you know. A
// term's link only shows once its fact is past Recognition (Mastery tier
// 2 or higher); locked links are not drawn at all, and a term with no
// unlocked link is not in the list. With ?dev, a box shows every link.
// Also mountMapPanel(), the map + its tap panel, which the Stages tab's
// stage 3 uses too. FILL THE GAP (plan step C) is the tab's other mode:
// one unlocked link is blank, loose bubbles float near it, drag or tap the
// right one in. It is extra practice: it never changes the record (no
// tiers move), but every answer goes to the shared log as
// { exp: 'mastery', task: 'gap', key (fact key), given, right, ms, sentence }.
// Browsing writes nothing.
import { mountBubbleMap } from '../../shared/bubblemap.js';
import { mapFor, mapTerms, sentencesFor, missMap, gapTask } from '../../shared/termmap.js';
import { readTriples, tripleTemplates } from '../../shared/factgen.js';
import { logAnswer } from '../../shared/log.js';
import { MASTERY_SET } from './config.js';

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

const box = document.getElementById('map');
const MODES = { look: 'Look around', gap: 'Fill the gap' };
const st = { facts: [], templates: new Map(), term: null, showAll: false, panel: null, mode: 'look', gap: null, lastGap: null };

export function initMap(data) {
  st.facts = readTriples(data).facts;
  st.templates = tripleTemplates(data);
}

// Map of entity `id` from the loaded facts (`unlocked` = fact keys, or null = all).
export function mapOfTerm(id, unlocked) {
  return mapFor(id, st.facts, st.templates, unlocked);
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// The map of `map` in `host`, with a panel under it that shows a tapped
// bubble's links as sentences. `focus` = a node to ring and explain first.
// Returns { destroy }.
export function mountMapPanel(host, map, focus = null) {
  const panel = el('div', 'map-panel');
  panel.setAttribute('aria-live', 'polite');
  const show = (node) => {
    panel.innerHTML = '';
    panel.append(el('p', 'map-term', node.label));
    const ul = el('ul', 'm-whys');
    sentencesFor(map, node.id).forEach(s => ul.append(el('li', '', s)));
    panel.append(ul);
    m.select(node.id);
  };
  const m = mountBubbleMap(host, { map, onPick: show, calm: reducedMotion });
  host.append(panel);
  requestAnimationFrame(() => m.resize());
  const first = map.nodes.find(n => n.id === focus);
  if (first) show(first);
  else panel.append(el('p', 'muted small', 'Tap a bubble to read how it links. Drag one to move it.'));
  return { destroy() { m.destroy(); panel.remove(); } };
}

// After a miss in Practise (plan step B): the missed fact's term map,
// review only, nothing to answer. Shows the unlocked links plus the missed
// fact's own link, which is ringed and explained first. Appends to `box`
// and returns { destroy }, or null when the fact has no map.
export function mountMissReview(box, row, unlocked) {
  const r = missMap(row, st.facts, st.templates, unlocked);
  if (!r) return null;
  const wrap = el('div', 'm-review');
  const host = el('div', 'map-host');
  wrap.append(el('h3', '', 'How it connects'), host);
  box.append(wrap);
  const p = mountMapPanel(host, r.map, r.focus);
  return { destroy() { p.destroy(); wrap.remove(); } };
}

export function hideMap() {
  st.panel?.destroy();
  st.panel = null;
  st.gap = null;
}

function button(text, onClick, className = '') {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// The two modes of the tab.
function modeRow(unlocked, isDev) {
  const row = el('div', 'row');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Map mode');
  Object.entries(MODES).forEach(([mode, name]) => {
    const b = button(name, () => { if (st.mode !== mode) { st.mode = mode; showMap(unlocked, isDev); } }, 'small');
    b.setAttribute('aria-pressed', String(st.mode === mode));
    row.append(b);
  });
  return row;
}

// FILL THE GAP: a new task from the unlocked links, drawn with its loose
// bubbles. The first drop or tap answers; NEXT asks another.
function showGap(unlocked, keys) {
  const task = gapTask(st.facts, st.templates, keys, { lastKey: st.lastGap });
  if (!task) {
    box.append(el('p', 'muted', unlocked && !unlocked.size
      ? 'Nothing to fill yet. Answer facts in Practise until one moves past Recognition.'
      : 'Nothing to fill yet. The links you know have no wrong bubbles to mix in. Unlock more in Practise.'));
    return;
  }
  st.lastGap = task.key;
  const gap = { task, shownAt: Date.now(), answered: false };
  st.gap = gap;
  box.append(el('p', 'm-question', task.prompt));
  box.append(el('p', 'muted small', 'Drag the right bubble into the gap, or tap it.'));
  const host = el('div', 'map-host');
  const out = el('div', 'map-panel');
  out.setAttribute('aria-live', 'polite');
  box.append(host, out);
  const drop = (node) => {
    if (gap.answered || st.gap !== gap) return;
    gap.answered = true;
    const right = node.id === task.answer.id;
    logAnswer({ exp: 'mastery', set: MASTERY_SET, task: 'gap', key: task.key, given: node.label, right, ms: Date.now() - gap.shownAt, sentence: task.sentence });
    m.remove(task.answer.id);
    m.fillGap(task.answer.label, 'ok');
    if (!right) m.mark(node.id, 'bad');
    m.dimLoose();
    out.append(el('p', 'm-result ' + (right ? 'right' : 'wrong'), right ? 'Right.' : 'Not this time. It was ' + task.answer.label + '.'));
    out.append(el('p', '', task.sentence), el('p', 'muted small', 'Practice only: no tier moves.'));
    const nextB = button('Next', () => showMap(unlocked, st.isDev));
    out.append(nextB);
    setTimeout(() => nextB.focus(), 0);
  };
  const m = mountBubbleMap(host, { map: task.map, loose: task.loose, onDrop: drop, calm: reducedMotion });
  requestAnimationFrame(() => m.resize());
  st.panel = { destroy() { m.destroy(); } };
}

// Draws the tab. `unlocked` = the fact keys past Recognition.
// DEV only: a box that treats every link as unlocked.
function devAll(unlocked, isDev) {
  const label = el('label', 'small');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = st.showAll;
  cb.addEventListener('change', () => { st.showAll = cb.checked; showMap(unlocked, isDev); });
  label.append(cb, ' DEV: show every link (locked too)');
  return label;
}

export function showMap(unlocked, isDev) {
  hideMap();
  st.isDev = isDev;
  box.innerHTML = '';
  const keys = st.showAll ? null : unlocked;
  box.append(modeRow(unlocked, isDev));
  if (st.mode === 'gap') {
    box.append(el('p', 'muted small', 'Fill the gap in a link you know. Extra practice: it never moves a tier.'));
    if (isDev) box.append(devAll(unlocked, isDev));
    showGap(unlocked, keys);
    return;
  }
  const terms = mapTerms(st.facts, st.templates, keys);
  box.append(el('p', 'muted small', 'Check what you know. A link shows once its fact is past Recognition (tier 2) in Practise.'));
  if (isDev) box.append(devAll(unlocked, isDev));
  if (!terms.length) {
    box.append(el('p', 'muted', 'Nothing here yet. Answer facts in Practise until one moves past Recognition.'));
    return;
  }
  if (!terms.some(t => t.id === st.term)) st.term = terms[0].id;
  const select = el('select', 's-fact');
  select.setAttribute('aria-label', 'Term');
  terms.forEach((t) => {
    const o = el('option', '', t.label);
    o.value = t.id;
    select.append(o);
  });
  select.value = st.term;
  select.addEventListener('change', () => { st.term = select.value; showMap(unlocked, isDev); });
  box.append(select);
  const host = el('div', 'map-host');
  box.append(host);
  st.panel = mountMapPanel(host, mapFor(st.term, st.facts, st.templates, keys));
}
