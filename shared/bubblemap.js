// A term's bubble map on a canvas (bubble map plan step A):
//
//   const m = mountBubbleMap(el, { map, onPick });   // later m.destroy()
//
// `map` is termmap.js mapFor's { centre, nodes, links }. Bubbles are held
// together by springs along their links; each line carries its label
// (from the template's `map.line`), upright and unscaled. onPick(node)
// runs on a tap (a press that moves less than 6 px; a longer move drags
// the bubble). Colour by kind: core = the term, info, risk (amber),
// defence (green), all from lab.css variables. A hidden button row
// mirrors the bubbles so the keyboard and screen readers can tap them too
// (it shows when focused). The loop pauses while the tab is hidden.
//
// m.select(id) rings one bubble; m.mark(id, 'ok' | 'bad' | null) colours
// one (for later steps); m.setMap(map) swaps the map.

import { makeBubble, stepBubbles, hitBubble, keepInBox } from './bubblephysics.js';

const TAP_PX = 6;
const CENTRE_R = 46;
const NODE_R = 36;
const HEIGHT = 380;
const TALL = 460;        // height for a map with more than TALL_FROM bubbles
const TALL_FROM = 8;
// The map's spacing (stepBubbles): longer springs than answer bubbles have,
// so a line has room for its label, more push and a softer pull to the middle.
const SPACING = { linkGap: 80, space: 1.9, pull: 0.0006 };

const STYLE = `
.lab-map { position: relative; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.lab-map canvas { display: block; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.lab-map-keys { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.lab-map-keys:focus-within { position: static; width: auto; height: auto; clip-path: none; display: flex; gap: 8px; flex-wrap: wrap; padding: 8px; border-top: 1px solid var(--line); }
`;

function addStyleOnce() {
  if (document.getElementById('lab-map-style')) return;
  const s = document.createElement('style');
  s.id = 'lab-map-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export function mountBubbleMap(el, { map = null, onPick = () => {}, calm = false } = {}) {
  addStyleOnce();
  const wrap = document.createElement('div');
  wrap.className = 'lab-map';
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  const keys = document.createElement('div');
  keys.className = 'lab-map-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Map bubbles');
  wrap.append(cv, keys);
  el.appendChild(wrap);
  const ctx = cv.getContext('2d');

  let W = 340, H = HEIGHT, list = [], pairs = [], lines = [], drag = null, moved = 0, last = null, raf = 0, dead = false, selected = null;
  const col = {};

  function size() {
    const dpr = window.devicePixelRatio || 1;
    W = wrap.clientWidth || 340;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    list.forEach(n => keepInBox(n, W, H));
  }

  function readColours() {
    const cs = getComputedStyle(wrap);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    const fill = v('--bg', '#f6f6f4'), fg = v('--fg', '#1d1d1b'), muted = v('--muted', '#6b6b66');
    col.core = [fill, v('--accent', '#2f5f8a'), fg];
    col.info = [fill, muted, fg];
    col.risk = [fill, v('--map-risk', '#a8661a'), v('--map-risk', '#a8661a')];
    col.defence = [fill, v('--map-defence', '#2e7d4f'), v('--map-defence', '#2e7d4f')];
    col.ok = [fill, v('--right', '#2e7d4f'), v('--right', '#2e7d4f')];
    col.bad = [fill, v('--wrong', '#b0413e'), v('--wrong', '#b0413e')];
    col.line = muted; col.card = v('--card', '#fff'); col.lineText = muted;
  }

  // How a label fits: its font, its lines (a long label with a space
  // splits into two near the middle) and a radius big enough to hold them.
  function fitLabel(label, base) {
    const size = base === CENTRE_R ? 18 : 14;
    const font = '600 ' + size + 'px system-ui, sans-serif';
    ctx.font = font;
    const width = t => ctx.measureText(t).width;
    let parts = [label];
    if (width(label) > 2 * base - 14 && label.includes(' ')) {
      const mid = label.length / 2;
      let cut = -1;
      for (let i = 0; i < label.length; i++) if (label[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
      parts = [label.slice(0, cut), label.slice(cut + 1)];
    }
    const lineH = size + 2;
    const w = Math.max(...parts.map(width));
    const need = Math.hypot(w / 2, (parts.length * lineH) / 2) + 6;
    return { font, parts, lineH, r: Math.min(Math.max(base, Math.ceil(need)), 64) };
  }

  const keyText = n => n.label + (n.id === selected ? ' (showing)' : n.st === 'ok' ? ' (right)' : n.st === 'bad' ? ' (wrong)' : '');

  function drawKeys() {
    keys.innerHTML = '';
    list.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = keyText(n);
      b.addEventListener('click', () => onPick(n.node));
      keys.appendChild(b);
    });
  }
  function updateKeys() {
    [...keys.children].forEach((b, i) => { if (list[i]) b.textContent = keyText(list[i]); });
  }

  // New bubbles for `next`: the centre in the middle, the rest on a ring
  // around it (the springs then pull each to its own links).
  function setMap(next) {
    map = next;
    selected = null;
    H = map && map.nodes.length > TALL_FROM ? TALL : HEIGHT;
    size();
    const nodes = map ? map.nodes : [];
    const byId = new Map();
    list = nodes.map((node, i) => {
      const base = i === 0 ? CENTRE_R : NODE_R;
      const fit = fitLabel(node.label, base);
      const n = makeBubble(node.label, node.id, fit.r, W, H);
      const a = ((i - 1) / Math.max(1, nodes.length - 1)) * Math.PI * 2;
      const ring = i === 0 ? 0 : Math.min(W, H) / 2 - fit.r - 8;
      n.x = W / 2 + Math.cos(a) * ring;
      n.y = H / 2 + Math.sin(a) * ring;
      keepInBox(n, W, H);
      Object.assign(n, { id: node.id, node, kind: node.kind, fit, st: null });
      byId.set(node.id, n);
      return n;
    });
    const links = map ? map.links : [];
    lines = links.map(l => ({ a: byId.get(l.from), b: byId.get(l.to), text: l.line, kind: l.kind })).filter(l => l.a && l.b);
    pairs = lines.map(l => [l.a, l.b]);
    drawKeys();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.5;
    lines.forEach((l) => {
      ctx.strokeStyle = l.kind === 'info' ? col.line : col[l.kind][1];
      ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
    });
    // Line labels: on a card-coloured patch at the middle of the line.
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l) => {
      const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2, tw = ctx.measureText(l.text).width + 8;
      ctx.fillStyle = col.card; ctx.fillRect(mx - tw / 2, my - 9, tw, 18);
      ctx.fillStyle = l.kind === 'info' ? col.lineText : col[l.kind][1];
      ctx.fillText(l.text, mx, my);
    });
    list.forEach((n) => {
      const c = col[n.st] || col[n.kind] || col.info;
      ctx.save();
      ctx.globalAlpha = n.al;
      ctx.translate(n.x, n.y);
      ctx.rotate(n.an);
      ctx.beginPath();
      const rx = n.r * (1 + n.sq + n.wo), ry = n.r * (1 - n.sq * 0.6 - n.wo * 0.6);
      ctx.ellipse(0, 0, Math.max(rx, 4), Math.max(ry, 4), 0, 0, Math.PI * 2);
      ctx.fillStyle = c[0]; ctx.fill();
      ctx.lineWidth = n.id === selected || n.st ? 3.5 : n.kind === 'core' ? 2.5 : 1.5;
      ctx.strokeStyle = c[1]; ctx.stroke();
      ctx.restore();
      // The label: upright, never squashed or wobbled with the shape.
      ctx.save();
      ctx.globalAlpha = n.al;
      ctx.fillStyle = c[2];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const f = n.fit;
      ctx.font = f.font;
      f.parts.forEach((t, i) => ctx.fillText(t, n.x, n.y + (i - (f.parts.length - 1) / 2) * f.lineH));
      ctx.restore();
    });
  }

  function loop() {
    stepBubbles(list, W, H, { calm, drag, links: pairs, ...SPACING });
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !dead) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  function pos(e) {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function down(e) {
    const [x, y] = pos(e);
    const h = hitBubble(list, x, y);
    if (!h) return;
    drag = h; moved = 0; last = [x, y];
    cv.style.cursor = 'grabbing';
    try { cv.setPointerCapture(e.pointerId); } catch { /* old browser */ }
  }
  function move(e) {
    if (!drag) return;
    const [x, y] = pos(e), dx = x - last[0], dy = y - last[1];
    moved += Math.abs(dx) + Math.abs(dy);
    drag.x = Math.min(W - drag.r, Math.max(drag.r, x));
    drag.y = Math.min(H - drag.r, Math.max(drag.r, y));
    drag.vx = dx * 0.6; drag.vy = dy * 0.6;
    last = [x, y];
  }
  function up() {
    if (!drag) return;
    const n = drag;
    drag = null;
    cv.style.cursor = '';
    if (moved < TAP_PX) onPick(n.node);
  }
  const onVisible = () => (document.hidden ? stop() : start());
  const dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVisible);
  dark?.addEventListener?.('change', readColours);

  readColours();
  setMap(map);
  start();

  return {
    node: wrap,
    setMap,
    select(id) {
      selected = id;
      const n = list.find(b => b.id === id);
      if (n && !calm) n.wv += 0.1;
      updateKeys();
    },
    mark(id, st) {
      list.forEach((n) => { if (n.id === id) { n.st = st || null; if (!calm) n.wv += 0.2; } });
      updateKeys();
    },
    resize: size,   // call once the element is on the page (it was measured when mounted)
    setCalm(on) { calm = !!on; },
    destroy() {
      dead = true;
      stop();
      window.removeEventListener('resize', size);
      document.removeEventListener('visibilitychange', onVisible);
      dark?.removeEventListener?.('change', readColours);
      wrap.remove();
    },
  };
}
