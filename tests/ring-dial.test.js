import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  cycleIndexAtCursor,
  dialDurationMs,
  dialPose,
  largestTurn,
  longitudeAtCursor,
  minimumJerk
} from "../src/interaction/ring-dial.js";
import { temporalCycleRotation } from "../src/wheel/temporal-track.js";

test("minimum-jerk curve starts and lands at rest and never overshoots", () => {
  assert.equal(minimumJerk(0), 0);
  assert.equal(minimumJerk(1), 1);
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const value = minimumJerk(i / 100);
    assert.ok(value >= previous, "monotonic");
    assert.ok(value <= 1, "no overshoot");
    previous = value;
  }
  // soft start and landing: the first and last 5% move very little
  assert.ok(minimumJerk(.05) < .002);
  assert.ok(1 - minimumJerk(.95) < .002);
});

test("dial length grows with the largest turn and stays bounded", () => {
  assert.equal(dialDurationMs(0), 650);
  assert.ok(dialDurationMs(60) > dialDurationMs(10));
  assert.equal(dialDurationMs(720), 1800);
});

test("the cell under the cursor matches the temporal track placement", () => {
  const cursor = -90;
  for (const [index, progress] of [[0, .2], [17, .5], [59, .99]]) {
    const rotation = temporalCycleRotation({ index, progress, cursorAngle: cursor });
    assert.equal(cycleIndexAtCursor(rotation, cursor), index);
  }
  assert.equal(longitudeAtCursor(-90 - 170.6, -90).toFixed(1), "170.6");
});

test("each ring turns the shortest way, never through the intervening time", () => {
  // previousRotation unwrapping keeps every target within ±180° of the start
  const from = { hour: 10, day: -200, year: 33 };
  const to = {
    hour: temporalCycleRotation({ index: 40, progress: .5, cursorAngle: -90, previousRotation: from.hour }),
    day: temporalCycleRotation({ index: 2, progress: .1, cursorAngle: -90, previousRotation: from.day }),
    year: temporalCycleRotation({ index: 59, progress: .9, cursorAngle: -90, previousRotation: from.year })
  };
  assert.ok(largestTurn(from, to) <= 180);
  assert.deepEqual(dialPose(from, to, 0), from);
  assert.deepEqual(dialPose(from, to, 1), to);
});

test("Now buttons dial instead of jumping, and reduced motion still jumps", () => {
  const atlas = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");
  const mobile = readFileSync(new URL("../src/mobile-time-control.js", import.meta.url), "utf8");
  assert.match(atlas, /dialToInstant\(Date\.now\(\), "now"\)/);
  assert.match(mobile, /source:"mobile-now", animate:true/);
  assert.match(atlas, /if \(prefersReducedMotion\(\) \|\| !currentDisplay\) return setSelectedInstant\(targetMs, source\);/);
});
