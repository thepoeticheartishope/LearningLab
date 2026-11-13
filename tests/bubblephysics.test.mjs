// Unit tests for shared/bubblephysics.js. No DOM.
//
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeBubble, stepBubbles, hitBubble, LINK_GAP } from '../shared/bubblephysics.js';

// A repeatable Math.random stand-in.
function seeded(seed = 1) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const inBox = (n, W, H) => n.x >= n.r - 1e-9 && n.x <= W - n.r + 1e-9 && n.y >= n.r - 1e-9 && n.y <= H - n.r + 1e-9;

test('a new bubble starts inside the box, still', () => {
  const rand = seeded(3);
  for (let i = 0; i < 50; i++) {
    const b = makeBubble('21', '21', 46, 340, 300, rand);
    assert.ok(inBox(b, 340, 300));
    assert.equal(b.vx, 0);
    assert.equal(b.label, '21');
  }
});

test('bubbles stay in the box for many frames, drifting or calm, even when pushed hard', () => {
  [false, true].forEach((calm) => {
    const rand = seeded(7);
    const list = ['21', '22', '23', '3389'].map(a => makeBubble(a, a, 46, 320, 300, rand));
    list[0].vx = 80; list[1].vy = -80;
    for (let f = 0; f < 2000; f++) {
      stepBubbles(list, 320, 300, { calm, rand });
      list.forEach(n => assert.ok(inBox(n, 320, 300), `frame ${f} calm ${calm}`));
    }
  });
});

test('calm bubbles settle: no drift, no squash or wobble', () => {
  const rand = seeded(11);
  const list = ['A', 'B', 'C', 'D'].map(a => makeBubble(a, a, 46, 340, 300, rand));
  list[2].vx = 20;
  for (let f = 0; f < 600; f++) stepBubbles(list, 340, 300, { calm: true, rand });
  list.forEach((n) => {
    assert.ok(Math.hypot(n.vx, n.vy) < 0.01);
    assert.equal(n.sq, 0);
    assert.equal(n.wo, 0);
  });
});

test('the dragged bubble is not moved by the step; dimmed ones fade to 0.3', () => {
  const rand = seeded(5);
  const list = ['A', 'B'].map(a => makeBubble(a, a, 46, 340, 300, rand));
  const [a, b] = list;
  a.x = 100; a.y = 100;
  b.dim = true;
  for (let f = 0; f < 100; f++) stepBubbles(list, 340, 300, { calm: true, drag: a, rand });
  assert.equal(a.x, 100);
  assert.equal(a.y, 100);
  assert.ok(Math.abs(b.al - 0.3) < 0.01);
  assert.ok(Math.abs(a.al - 1) < 0.01);
});

test('hit test: inside the radius (a little over), the top one wins, miss gives null', () => {
  const a = makeBubble('A', 'A', 40, 300, 300, () => 0.5);
  const b = makeBubble('B', 'B', 40, 300, 300, () => 0.5);
  a.x = 100; a.y = 100; b.x = 130; b.y = 100;
  assert.equal(hitBubble([a, b], 115, 100), b);
  assert.equal(hitBubble([a, b], 65, 100), a);
  assert.equal(hitBubble([a, b], 100, 143), a);   // 43 < 40 * 1.1
  assert.equal(hitBubble([a, b], 10, 10), null);
});

test('linked bubbles settle near their spring length and stay in the box', () => {
  [false, true].forEach((calm) => {
    const rand = seeded(11);
    const W = 340, H = 380;
    const list = ['DNS', '53', 'UDP', 'TCP', 'DHCP'].map(l => makeBubble(l, l, 36, W, H, rand));
    const links = [[list[0], list[1]], [list[0], list[2]], [list[0], list[3]], [list[2], list[4]]];
    for (let i = 0; i < 1500; i++) stepBubbles(list, W, H, { calm, rand, links });
    list.forEach(n => assert.ok(inBox(n, W, H)));
    links.forEach(([a, b]) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(d > a.r + b.r && d < a.r + b.r + LINK_GAP + 80, 'link length ' + d);
    });
  });
});
