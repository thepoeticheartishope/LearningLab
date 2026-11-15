// Which fact set the experiments run on. A `?set=<id>` in the page address
// wins (and is remembered), then the last pick, then the first of
// FACT_SETS. setPicker() is the drop-down each page shows; picking a set
// reloads the page on it.

import { FACT_SETS, SET_KEY } from './config.js';

function defaultStore() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const known = id => FACT_SETS.some(s => s.id === id);

// The id of the set to use. `search` is the page's query string.
export function chosenSetId(search = globalThis.location?.search || '', store = defaultStore()) {
  const fromUrl = new URLSearchParams(search).get('set');
  if (known(fromUrl)) { pickSet(fromUrl, store); return fromUrl; }
  let saved = null;
  try { saved = store?.getItem(SET_KEY) ?? null; } catch { /* blocked */ }
  return known(saved) ? saved : FACT_SETS[0].id;
}

// Remembers `id` as the picked set (unknown ids are ignored).
export function pickSet(id, store = defaultStore()) {
  if (!known(id)) return;
  try { store?.setItem(SET_KEY, id); } catch { /* blocked: the pick lasts this page only */ }
}

// Browser only: a labelled drop-down of the sets with `current` selected.
// Changing it remembers the pick and calls `onPick(id)` (default: reload
// the page without any ?set=).
export function setPicker(current, onPick = () => { location.search = ''; }) {
  const label = document.createElement('label');
  label.className = 'set-picker';
  label.textContent = 'Fact set ';
  const select = document.createElement('select');
  FACT_SETS.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name; o.selected = s.id === current;
    select.append(o);
  });
  select.onchange = () => { pickSet(select.value); onPick(select.value); };
  label.append(select);
  return label;
}
