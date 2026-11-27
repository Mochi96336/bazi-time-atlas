import test from "node:test";
import assert from "node:assert/strict";
import { MOTORS, motorStep, settleTarget } from "../src/research/scroll-feel.js";

const H = 800;

test("the key motor starts softly, never overshoots and lands on the target", () => {
  let s = { x: 0, v: 0, w: 0 }, t = 0, max = 0, firstV = null;
  const target = H; // one screen
  while (Math.abs(target - s.x) >= .5 && t < 10) {
    s = motorStep(s, target, MOTORS.key, 1 / 60, H);
    firstV ??= s.v;
    max = Math.max(max, s.x);
    t += 1 / 60;
  }
  assert.ok(firstV < MOTORS.key.vmax * H * .1, "the first frame moves only a little");
  assert.ok(max <= target + .5, "no overshoot");
  assert.ok(t > .8 && t < 3, `one screen takes a readable time (${t.toFixed(2)} s)`);
});

test("settling prefers the way the reader was going", () => {
  const stops = [0, 800, 1600];
  assert.equal(settleTarget(stops, 850, 1, H), 1600, "a nudge forward carries on");
  assert.equal(settleTarget(stops, 850, -1, H), 800, "moving back, the stop just passed");
  assert.equal(settleTarget(stops, 1450, -1, H), 800);
  assert.equal(settleTarget(stops, 810, 1, H), 1600);
  assert.equal(settleTarget(stops, 800, 1, H), null, "already on a stop");
  // behind only when all but on it
  assert.equal(settleTarget([0, 5000], 60, 1, H), 0);
  assert.equal(settleTarget([0, 5000], 200, 1, H), null);
});
