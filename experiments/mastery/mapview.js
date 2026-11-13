// The MAP tab (bubble map plan step A): browse the terms you know. A
// term's link only shows once its fact is past Recognition (Mastery tier
// 2 or higher); locked links are not drawn at all, and a term with no
// unlocked link is not in the list. With ?dev, a box shows every link.
// Also mountMapPanel(), the map + its tap panel, which the Stages tab's
// stage 3 uses too. Nothing here changes the record or writes to the log.
import { mountBubbleMap } from '../../shared/bubblemap.js';
import { mapFor, mapTerms, sentencesFor } from '../../shared/termmap.js';
import { readTriples, tripleTemplates } from '../../shared/factgen.js';

const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

const box = document.getElementById('map');
const st = { facts: [], templates: new Map(), term: null, showAll: false, panel: null };

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

export function hideMap() {
  st.panel?.destroy();
  st.panel = null;
}

// Draws the tab. `unlocked` = the fact keys past Recognition.
export function showMap(unlocked, isDev) {
  hideMap();
  box.innerHTML = '';
  const keys = st.showAll ? null : unlocked;
  const terms = mapTerms(st.facts, st.templates, keys);
  box.append(el('p', 'muted small', 'Check what you know. A link shows once its fact is past Recognition (tier 2) in Practise.'));
  if (isDev) {
    const label = el('label', 'small');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = st.showAll;
    cb.addEventListener('change', () => { st.showAll = cb.checked; showMap(unlocked, isDev); });
    label.append(cb, ' DEV: show every link (locked too)');
    box.append(label);
  }
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
