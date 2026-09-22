import test from "node:test";
import assert from "node:assert/strict";
import { cycleIndexFromLocalPoint } from "../src/research-sexagenary-cycle.js";

function pointAt(angleDegrees, radius = 270) {
  const angle = angleDegrees * Math.PI / 180;
  return {
    x:320 + Math.cos(angle) * radius,
    y:320 + Math.sin(angle) * radius
  };
}

test("pointer angle directly addresses the 60 cycle positions", () => {
  assert.equal(cycleIndexFromLocalPoint(...Object.values(pointAt(0))), 0);
  assert.equal(cycleIndexFromLocalPoint(...Object.values(pointAt(6))), 1);
  assert.equal(cycleIndexFromLocalPoint(...Object.values(pointAt(180))), 30);
  assert.equal(cycleIndexFromLocalPoint(...Object.values(pointAt(354))), 59);
});

test("pointer scrub wraps continuously across 59 and 0", () => {
  const beforeZero = pointAt(356);
  const afterZero = pointAt(359);
  const first = pointAt(1);

  assert.equal(cycleIndexFromLocalPoint(beforeZero.x, beforeZero.y), 59);
  assert.equal(cycleIndexFromLocalPoint(afterZero.x, afterZero.y), 0);
  assert.equal(cycleIndexFromLocalPoint(first.x, first.y), 0);
});

test("pointer mapping rejects non-finite geometry", () => {
  assert.throws(() => cycleIndexFromLocalPoint(Number.NaN, 320), /finite/);
});
