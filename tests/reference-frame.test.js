import test from "node:test";
import assert from "node:assert/strict";

import {
  REFERENCE_RING_IDS,
  referenceAnchorForOffset,
  referenceFrameOffset,
  rotationInReferenceFrame,
  validReferenceRing
} from "../src/wheel/reference-frame.js";

test("reference-frame ring set follows radial temporal scale and excludes zodiac overlay", () => {
  assert.deepEqual(REFERENCE_RING_IDS, ["hour", "day", "solar", "month", "year"]);
  for (const id of REFERENCE_RING_IDS) assert.equal(validReferenceRing(id), true);
  assert.equal(validReferenceRing("zodiac"), false);
  assert.equal(validReferenceRing("world"), false);
});

test("world frame leaves every rotation unchanged", () => {
  const rotations = new Map([["day", -123], ["solar", -42.5]]);
  const offset = referenceFrameOffset({ referenceId:null, anchorRotation:null, worldRotations:rotations });
  assert.equal(offset, 0);
  assert.equal(rotationInReferenceFrame(-123, offset), -123);
  assert.equal(rotationInReferenceFrame(-42.5, offset), -42.5);
});

test("day reference freezes the day wheel and exposes relative drift", () => {
  const anchor = -123;
  const rotations = new Map([
    ["day", -129],
    ["hour", -195],
    ["solar", -43.486]
  ]);
  const offset = referenceFrameOffset({ referenceId:"day", anchorRotation:anchor, worldRotations:rotations });
  assert.equal(offset, -6);
  assert.equal(rotationInReferenceFrame(rotations.get("day"), offset), anchor);
  assert.equal(rotationInReferenceFrame(rotations.get("hour"), offset), -189);
  assert.equal(rotationInReferenceFrame(rotations.get("solar"), offset), -37.486);
});

test("solar reference freezes the shared annual longitude frame", () => {
  const anchor = -30;
  const rotations = new Map([
    ["solar", -30.75],
    ["day", -100]
  ]);
  const offset = referenceFrameOffset({ referenceId:"solar", anchorRotation:anchor, worldRotations:rotations });
  assert.equal(offset, -0.75);
  assert.equal(rotationInReferenceFrame(rotations.get("solar"), offset), -30);
  assert.equal(rotationInReferenceFrame(rotations.get("day"), offset), -99.25);
});

test("switching reference can preserve the current rendered frame", () => {
  const currentOffset = -17.5;
  const solarWorldRotation = -81.25;
  const anchor = referenceAnchorForOffset(solarWorldRotation, currentOffset);
  assert.equal(anchor, -63.75);

  const offset = referenceFrameOffset({
    referenceId:"solar",
    anchorRotation:anchor,
    worldRotations:new Map([["solar", solarWorldRotation]])
  });
  assert.equal(offset, currentOffset);
});

test("invalid reference inputs fail back to the canonical world frame", () => {
  assert.equal(referenceAnchorForOffset(Number.NaN, 0), null);
  assert.equal(referenceFrameOffset({
    referenceId:"day",
    anchorRotation:Number.NaN,
    worldRotations:new Map([["day", -12]])
  }), 0);
  assert.equal(rotationInReferenceFrame(12, Number.NaN), 12);
  assert.equal(rotationInReferenceFrame(Number.NaN, 0), null);
});
