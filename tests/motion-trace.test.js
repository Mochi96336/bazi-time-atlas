import test from "node:test";
import assert from "node:assert/strict";

import { WHEEL_CENTER } from "../src/wheel/ring-model.js";
import {
  MOTION_TRACE_MAX_DEGREES,
  MOTION_TRACE_MIN_DEGREES,
  clampMotionDelta,
  signedMotionArcPath
} from "../src/wheel/motion-trace.js";

test("motion deltas are symmetrically bounded for readable traces", () => {
  assert.equal(clampMotionDelta(12), 12);
  assert.equal(clampMotionDelta(-12), -12);
  assert.equal(clampMotionDelta(500), MOTION_TRACE_MAX_DEGREES);
  assert.equal(clampMotionDelta(-500), -MOTION_TRACE_MAX_DEGREES);
});

test("positive and negative phase motion end at the same fixed read-head", () => {
  const positive = signedMotionArcPath(WHEEL_CENTER, 900, -90, 12);
  const negative = signedMotionArcPath(WHEEL_CENTER, 900, -90, -12);
  const head = `${WHEEL_CENTER.x.toFixed(3)} ${(WHEEL_CENTER.y - 900).toFixed(3)}`;

  assert.match(positive, new RegExp(`${head}$`));
  assert.match(negative, new RegExp(`${head}$`));
  assert.match(positive, / 0 0 1 /, "positive ring motion should use clockwise SVG sweep");
  assert.match(negative, / 0 0 0 /, "negative ring motion should use counter-clockwise SVG sweep");
  assert.notEqual(positive, negative);
});

test("sub-visible changes do not leave a permanent motion mark", () => {
  assert.equal(signedMotionArcPath(WHEEL_CENTER, 900, -90, MOTION_TRACE_MIN_DEGREES / 2), "");
});
