// Answer-bubble movement maths, no DOM. Ported from the single-file
// "Port bubble quiz" page (its mk / step / pointer hit test).
//
// A bubble: { label, value, r, x, y, vx, vy, st ('n' | 'ok' | 'bad'),
// dim (true = fade back), al (alpha now), sq (squash), an (squash angle),
// wo / wv (wobble and its speed) }. Only the round shape squashes and
// wobbles; bubbles.js draws the label upright and unscaled.

// A new bubble somewhere inside a W × H box (away from the edges).
export function makeBubble(label, value, r, W, H, rand = Math.random) {
  const x = r + rand() * Math.max(0, W - 2 * r);
  const y = r + rand() * Math.max(0, H - 2 * r);
  return { label: String(label), value, r, x, y, vx: 0, vy: 0, st: 'n', dim: false, al: 1, sq: 0, an: 0, wo: 0, wv: 0 };
}

// One frame of movement for every bubble in `list`, inside a W × H box.
// calm: no random drift and strong damping, no squash or wobble, so the
// bubbles only move when pushed or dragged. drag: the bubble under the
// finger (moved by the pointer, not here).
export function stepBubbles(list, W, H, { calm = false, drag = null, rand = Math.random } = {}) {
  // Push apart bubbles that are too close.
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const m = (a.r + b.r + 12) * 1.4;
      if (d < m) {
        const f = (m - d) * 0.004;
        dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f;
        b.vx += dx * f; b.vy += dy * f;
      }
      if (!calm && d < a.r + b.r) { a.wv += 0.01; b.wv += 0.01; }
    }
  }
  list.forEach((n) => {
    if (n !== drag) {
      n.vx += (W / 2 - n.x) * 0.0015;
      n.vy += (H / 2 - n.y) * 0.0015;
      if (!calm) { n.vx += (rand() - 0.5) * 0.06; n.vy += (rand() - 0.5) * 0.06; }
      const damp = calm ? 0.8 : 0.93;
      n.vx *= damp; n.vy *= damp;
      n.x += n.vx; n.y += n.vy;
    }
    keepInBox(n, W, H, !calm);
    const sp = Math.hypot(n.vx, n.vy);
    if (calm) {
      n.sq = 0; n.wo = 0; n.wv = 0;
    } else {
      if (sp > 0.15) n.an = Math.atan2(n.vy, n.vx);
      n.sq += (Math.min(sp * 0.06, 0.3) - n.sq) * 0.2;
      n.wv += -n.wo * 0.12; n.wv *= 0.88; n.wo += n.wv;
    }
    n.al += ((n.dim ? 0.3 : 1) - n.al) * 0.15;
  });
}

// Puts bubble `n` back inside the box (bouncing softly off the edge).
export function keepInBox(n, W, H, wobble = false) {
  const r = Math.min(n.r, W / 2, H / 2);
  const hit = (v) => { if (wobble) n.wv += 0.02; return v * -0.4; };
  if (n.x < r) { n.x = r; n.vx = hit(n.vx); }
  if (n.x > W - r) { n.x = W - r; n.vx = hit(n.vx); }
  if (n.y < r) { n.y = r; n.vy = hit(n.vy); }
  if (n.y > H - r) { n.y = H - r; n.vy = hit(n.vy); }
}

// The bubble at point (x, y), or null. The top one (drawn last) wins.
export function hitBubble(list, x, y) {
  for (let i = list.length - 1; i >= 0; i--) {
    const n = list[i];
    if (Math.hypot(n.x - x, n.y - y) < n.r * 1.1) return n;
  }
  return null;
}
