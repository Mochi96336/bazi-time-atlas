import test from "node:test";
import assert from "node:assert/strict";

import {
  DRAG_ACTIVATION_DEGREES,
  resolveDragActivation,
  resolveDragActivationInto
} from "../src/wheel/drag-activation.js";

function step(state, delta) {
  return resolveDragActivation(state, delta);
}

test("small pointer jitter accumulates without moving the ring", () => {
  let state = { dragActivated:false, pendingDelta:0 };

  state = step(state, 0.08);
  assert.equal(state.dragActivated, false);
  assert.equal(state.deltaToApply, 0);
  assert.ok(Math.abs(state.pendingDelta - 0.08) < 1e-12);

  state = step(state, 0.07);
  assert.equal(state.dragActivated, false);
  assert.equal(state.deltaToApply, 0);
  assert.ok(Math.abs(state.pendingDelta - 0.15) < 1e-12);
});

test("crossing the activation threshold applies the complete accumulated drag", () => {
  let state = { dragActivated:false, pendingDelta:0 };
  state = step(state, 0.08);
  state = step(state, 0.07);
  state = step(state, 0.06);

  assert.equal(state.dragActivated, true);
  assert.equal(state.pendingDelta, 0);
  assert.ok(Math.abs(state.deltaToApply - 0.21) < 1e-12);
});

test("the canonical 0.25 degree linked gesture is not shortened", () => {
  const state = step({ dragActivated:false, pendingDelta:0 }, 0.25);
  assert.equal(state.dragActivated, true);
  assert.ok(Math.abs(state.deltaToApply - 0.25) < 1e-12);
});

test("once activated, subsequent motion remains fully continuous", () => {
  let state = step({ dragActivated:false, pendingDelta:0 }, DRAG_ACTIVATION_DEGREES);
  assert.equal(state.dragActivated, true);
  assert.ok(Math.abs(state.deltaToApply - DRAG_ACTIVATION_DEGREES) < 1e-12);

  state = step(state, -0.04);
  assert.equal(state.dragActivated, true);
  assert.equal(state.pendingDelta, 0);
  assert.ok(Math.abs(state.deltaToApply + 0.04) < 1e-12);
});

test("sub-threshold reversals cancel instead of falsely activating", () => {
  let state = step({ dragActivated:false, pendingDelta:0 }, 0.12);
  state = step(state, -0.10);

  assert.equal(state.dragActivated, false);
  assert.equal(state.deltaToApply, 0);
  assert.ok(Math.abs(state.pendingDelta - 0.02) < 1e-12);
});

test("invalid drag activation inputs fail closed", () => {
  assert.throws(
    () => resolveDragActivation({ dragActivated:false, pendingDelta:0 }, Number.NaN),
    /delta must be finite/
  );
  assert.throws(
    () => resolveDragActivation({ dragActivated:false, pendingDelta:Number.POSITIVE_INFINITY }, 0.1),
    /pendingDelta must be finite/
  );
  assert.throws(
    () => resolveDragActivation({ dragActivated:false, pendingDelta:0 }, 0.1, 0),
    /threshold must be a positive finite number/
  );
});


test("runtime activation can reuse caller-owned result state without changing semantics", () => {
  const scratch = { dragActivated:true, pendingDelta:99, deltaToApply:99 };

  const stateA = { dragActivated:false, pendingDelta:0.05 };
  const first = resolveDragActivationInto(scratch, stateA, 0.04);
  const expectedFirst = resolveDragActivation(stateA, 0.04);
  assert.equal(first, scratch);
  assert.deepEqual(first, expectedFirst);

  const stateB = {
    dragActivated:first.dragActivated,
    pendingDelta:first.pendingDelta
  };
  const second = resolveDragActivationInto(scratch, stateB, 0.12);
  const expectedSecond = resolveDragActivation(stateB, 0.12);
  assert.equal(second, scratch);
  assert.deepEqual(second, expectedSecond);

  const active = { dragActivated:true, pendingDelta:0 };
  const third = resolveDragActivationInto(scratch, active, -0.3);
  const expectedThird = resolveDragActivation(active, -0.3);
  assert.equal(third, scratch);
  assert.deepEqual(third, expectedThird);
});
