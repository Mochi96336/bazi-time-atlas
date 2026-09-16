import test from "node:test";
import assert from "node:assert/strict";

import {
  DAY_MS,
  KINETIC_SCALE_CONFIG,
  advanceKineticPlayback,
  sliderStateForScale
} from "../src/interaction/kinetic-playback.js";

test("kinetic time windows preserve the shipped spans, steps and playback rates", () => {
  assert.deepEqual(KINETIC_SCALE_CONFIG.day, {
    label: "48 小時",
    spanDays: 1,
    sliderStep: 1 / 144,
    playDaysPerSecond: .25,
    edgeLabel: "1 日"
  });
  assert.deepEqual(KINETIC_SCALE_CONFIG.year, {
    label: "一年",
    spanDays: 183,
    sliderStep: .25,
    playDaysPerSecond: 6,
    edgeLabel: "約半年"
  });
  assert.deepEqual(KINETIC_SCALE_CONFIG.cycle, {
    label: "60 年",
    spanDays: 365.2422 * 30,
    sliderStep: 1,
    playDaysPerSecond: 365.2422,
    edgeLabel: "約 30 年"
  });
});

test("slider state is a pure projection of selected time and observation window", () => {
  assert.deepEqual(sliderStateForScale({
    scale: "year",
    anchorMs: 1_000,
    selectedMs: 1_000 + 12.5 * DAY_MS
  }), {
    min: -183,
    max: 183,
    step: .25,
    value: 12.5,
    label: "一年",
    leftLabel: "−約半年",
    rightLabel: "+約半年"
  });
});

test("the first animation frame establishes timing without moving time", () => {
  assert.deepEqual(advanceKineticPlayback({
    scale: "day",
    selectedMs: 10 * DAY_MS,
    anchorMs: 9 * DAY_MS,
    previousTimestamp: null,
    timestamp: 4_000
  }), {
    selectedMs: 10 * DAY_MS,
    offsetDays: 1,
    elapsedSeconds: 0,
    reachedEnd: true
  });
});

test("playback preserves the 100 ms frame clamp", () => {
  const result = advanceKineticPlayback({
    scale: "cycle",
    selectedMs: 0,
    anchorMs: 0,
    previousTimestamp: 1_000,
    timestamp: 3_000
  });
  assert.equal(result.elapsedSeconds, .1);
  assert.ok(Math.abs(result.offsetDays - 36.52422) < 1e-9);
  assert.ok(Math.abs(result.selectedMs - 36.52422 * DAY_MS) < 1e-3);
  assert.equal(result.reachedEnd, false);
});

test("playback clamps exactly to the positive scale edge", () => {
  const anchorMs = 42 * DAY_MS;
  const selectedMs = anchorMs + 182.9 * DAY_MS;
  const result = advanceKineticPlayback({
    scale: "year",
    selectedMs,
    anchorMs,
    previousTimestamp: 1_000,
    timestamp: 1_100
  });
  assert.equal(result.selectedMs, anchorMs + 183 * DAY_MS);
  assert.equal(result.offsetDays, 183);
  assert.equal(result.reachedEnd, true);
});

test("unknown scales fail closed", () => {
  assert.throws(() => sliderStateForScale({
    scale: "unknown",
    selectedMs: 0,
    anchorMs: 0
  }), /Unknown kinetic scale/);
});
