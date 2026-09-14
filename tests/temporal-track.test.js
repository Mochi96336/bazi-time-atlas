import test from "node:test";
import assert from "node:assert/strict";

import {
  temporalCycleCoordinate,
  temporalCycleRotation,
  temporalCycleTargetRotation,
  unwrapTemporalRotation
} from "../src/wheel/temporal-track.js";

const CURSOR = -90;

function assertNear(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
}

test("temporal coordinate places the selected instant inside the active six-degree tooth", () => {
  assert.equal(temporalCycleCoordinate(0, 0), 0);
  assert.equal(temporalCycleCoordinate(0, 0.25), 1.5);
  assert.equal(temporalCycleCoordinate(10, 0.5), 63);
  assert.equal(temporalCycleCoordinate(59, 1), 360);
});

test("ring rotation moves continuously with phase instead of pinning the active tooth centre", () => {
  const quarter = temporalCycleTargetRotation(10, 0.25, CURSOR);
  const half = temporalCycleTargetRotation(10, 0.5, CURSOR);
  assertNear(quarter, CURSOR - 61.5);
  assertNear(half, CURSOR - 63);
  assertNear(half - quarter, -1.5);
});

test("59 to 0 unwrap stays on the nearest physical rotation instead of jumping a full circle", () => {
  const before = temporalCycleRotation({
    index:59,
    progress:0.999,
    cursorAngle:CURSOR,
    previousRotation:null
  });
  const after = temporalCycleRotation({
    index:0,
    progress:0.001,
    cursorAngle:CURSOR,
    previousRotation:before
  });

  assertNear(after - before, -0.012, 1e-9);
  assert.ok(Math.abs(after - before) < 0.1, `${before} -> ${after} should be visually continuous`);
});

test("unwrap chooses the equivalent target nearest the last rendered pose", () => {
  assert.equal(unwrapTemporalRotation(-90, -450), -450);
  assert.equal(unwrapTemporalRotation(269, -90), -91);
});

test("temporal track rejects impossible index and phase values", () => {
  assert.throws(() => temporalCycleCoordinate(-1, 0.5), RangeError);
  assert.throws(() => temporalCycleCoordinate(60, 0.5), RangeError);
  assert.throws(() => temporalCycleCoordinate(0, -0.001), RangeError);
  assert.throws(() => temporalCycleCoordinate(0, 1.001), RangeError);
});
