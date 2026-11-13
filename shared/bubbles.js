// Floating answer bubbles on a canvas, for any experiment:
//
//   const b = mountBubbles(el, { answers, onPick });   // later b.destroy()
//
// `answers` are strings; onPick(answer) runs on a tap (a press that moves
// less than 6 px; a longer move drags the bubble). The page decides right
// or wrong and calls b.mark(answer, 'ok' | 'bad'); b.dim() fades every
// bubble not marked. A hidden button row mirrors the bubbles so the
// keyboard and screen readers can answer too (it shows when focused).
// Colours come from lab.css variables, read again when the theme changes.
// The loop pauses while the tab is hidden; destroy() stops everything.

import { makeBubble, stepBubbles, hitBubble, keepInBox } from './bubblephysics.js';

const TAP_PX = 6;
const RADIUS = 46;
const HEIGHT = 300;

const STYLE = `
.lab-bubbles { position: relative; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.lab-bubbles canvas { display: block; touch-action: none; cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.lab-bubbles-keys { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.lab-bubbles-keys:focus-within { position: static; width: auto; height: auto; clip-path: none; display: flex; gap: 8px; flex-wrap: wrap; padding: 8px; border-top: 1px solid var(--line); }
`;

function addStyleOnce() {
  if (document.getElementById('lab-bubbles-style')) return;
  const s = document.createElement('style');
  s.id = 'lab-bubbles-style';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export function mountBubbles(el, { answers = [], onPick = () => {}, calm = false, height = HEIGHT } = {}) {
  addStyleOnce();
  const wrap = document.createElement('div');
  wrap.className = 'lab-bubbles';
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  const keys = document.createElement('div');
  keys.className = 'lab-bubbles-keys';
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Answers');
  wrap.append(cv, keys);
  el.appendChild(wrap);
  const ctx = cv.getContext('2d');

  let W = 340, H = height, list = [], drag = null, moved = 0, last = null, raf = 0, dead = false;
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
    const fill = v('--bg', '#f6f6f4'), fg = v('--fg', '#1d1d1b');
    col.n = [fill, v('--muted', '#6b6b66'), fg, 1];
    col.ok = [fill, v('--right', '#2e7d4f'), v('--right', '#2e7d4f'), 3];
    col.bad = [fill, v('--wrong', '#b0413e'), v('--wrong', '#b0413e'), 3];
  }

  const keyText = n => n.label + (n.st === 'ok' ? ' (right)' : n.st === 'bad' ? ' (wrong)' : '');

  function drawKeys() {
    keys.innerHTML = '';
    list.forEach((n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = keyText(n);
      b.addEventListener('click', () => onPick(n.value));
      keys.appendChild(b);
    });
  }

  // Updates the key buttons' text in place, so keyboard focus stays put.
  function updateKeys() {
    [...keys.children].forEach((b, i) => { if (list[i]) b.textContent = keyText(list[i]); });
  }

  // How a label fits: its font, its lines (a long label with a space
  // splits into two near the middle) and a radius big enough to hold them.
  function fitLabel(label) {
    const size = label.length > 6 ? 15 : 20;
    const font = '600 ' + size + 'px system-ui, sans-serif';
    ctx.font = font;
    const width = t => ctx.measureText(t).width;
    let lines = [label];
    if (width(label) > 2 * RADIUS - 16 && label.includes(' ')) {
      const mid = label.length / 2;
      let cut = -1;
      for (let i = 0; i < label.length; i++) if (label[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
      lines = [label.slice(0, cut), label.slice(cut + 1)];
    }
    const lineH = size + 3;
    const w = Math.max(...lines.map(width));
    const need = Math.hypot(w / 2, (lines.length * lineH) / 2) + 8;
    const r = Math.min(Math.max(RADIUS, Math.ceil(need)), 80, H / 2 - 4);
    return { font, lines, lineH, r };
  }

  function setAnswers(next) {
    list = next.map((a) => {
      const fit = fitLabel(String(a));
      const n = makeBubble(a, a, fit.r, W, H);
      n.fit = fit;
      return n;
    });
    drawKeys();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    list.forEach((n) => {
      const c = col[n.st] || col.n;
      ctx.save();
      ctx.globalAlpha = n.al;
      ctx.translate(n.x, n.y);
      ctx.rotate(n.an);
      ctx.beginPath();
      const rx = n.r * (1 + n.sq + n.wo), ry = n.r * (1 - n.sq * 0.6 - n.wo * 0.6);
      ctx.ellipse(0, 0, Math.max(rx, 4), Math.max(ry, 4), 0, 0, Math.PI * 2);
      ctx.fillStyle = c[0]; ctx.fill();
      ctx.lineWidth = c[3]; ctx.strokeStyle = c[1]; ctx.stroke();
      ctx.restore();
      // The label: upright, never squashed or wobbled with the shape.
      ctx.save();
      ctx.globalAlpha = n.al;
      ctx.fillStyle = c[2];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const f = n.fit;
      ctx.font = f.font;
      f.lines.forEach((t, i) => ctx.fillText(t, n.x, n.y + (i - (f.lines.length - 1) / 2) * f.lineH));
      ctx.restore();
    });
  }

  function loop() {
    stepBubbles(list, W, H, { calm, drag });
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
    if (moved < TAP_PX) onPick(n.value);
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

  size();
  readColours();
  setAnswers(answers);
  start();

  return {
    node: wrap,     // the bubbles' element (move it with appendChild to keep it running across redraws)
    mark(answer, st) {
      list.forEach((n) => { if (n.value === answer) { n.st = st; if (!calm) n.wv += 0.2; } });
      updateKeys();
    },
    dim() { list.forEach((n) => { n.dim = n.st === 'n'; }); },
    setAnswers,
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
