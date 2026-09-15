import test from "node:test";
import assert from "node:assert/strict";
import {
  GEOGRAPHIC_LONGITUDE_CONTRACT,
  geographicLongitudeBinding,
  UNBOUND_GEOGRAPHIC_LONGITUDE
} from "../src/recurrence/geographic-longitude-binding.js";

test("geographic longitude is explicitly unbound by default", () => {
  const result = geographicLongitudeBinding();
  assert.equal(result, UNBOUND_GEOGRAPHIC_LONGITUDE);
  assert.equal(result.bound, false);
  assert.equal(result.longitudeDegrees, null);
  assert.equal(result.signConvention, "east-positive");
});

test("geographic longitude accepts the complete east-positive coordinate range", () => {
  for (const longitudeDegrees of [-180, -121.5, 0, 121.5, 180]) {
    const result = geographicLongitudeBinding(longitudeDegrees);
    assert.equal(result.bound, true);
    assert.equal(result.longitudeDegrees, longitudeDegrees);
    assert.equal(result.signConvention, "east-positive");
  }
});

test("negative zero is canonicalized to zero", () => {
  const result = geographicLongitudeBinding(-0);
  assert.equal(Object.is(result.longitudeDegrees, -0), false);
  assert.equal(result.longitudeDegrees, 0);
});

test("non-finite and out-of-range longitudes are rejected rather than clamped", () => {
  for (const value of [Number.NaN, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, -180.0001, 180.0001]) {
    assert.throws(() => geographicLongitudeBinding(value), /longitudeDegrees/);
  }
});

test("longitude contract matches the existing solar-time engine convention", () => {
  assert.equal(GEOGRAPHIC_LONGITUDE_CONTRACT.unit, "degree");
  assert.equal(GEOGRAPHIC_LONGITUDE_CONTRACT.signConvention, "east-positive");
  assert.equal(GEOGRAPHIC_LONGITUDE_CONTRACT.minDegrees, -180);
  assert.equal(GEOGRAPHIC_LONGITUDE_CONTRACT.maxDegrees, 180);
  assert.equal(GEOGRAPHIC_LONGITUDE_CONTRACT.zeroLongitudeValid, true);
});
