import test from "node:test";
import assert from "node:assert/strict";
import {
  LONGITUDE_BINDING_CONTRACT,
  UNBOUND_LONGITUDE_BINDING,
  longitudeBinding
} from "../src/recurrence/longitude-binding.js";

test("longitude is explicitly unbound by default", () => {
  const result = longitudeBinding();
  assert.equal(result, UNBOUND_LONGITUDE_BINDING);
  assert.equal(result.bound, false);
  assert.equal(result.longitudeDegreesEast, null);
  assert.equal(result.signConvention, "east-positive-degrees-from-greenwich");
});

test("longitude binding preserves east-positive geographic degrees", () => {
  const east = longitudeBinding({ longitudeDegreesEast:121.5 });
  const west = longitudeBinding({ longitudeDegreesEast:-74.006 });
  assert.equal(east.bound, true);
  assert.equal(east.longitudeDegreesEast, 121.5);
  assert.equal(west.bound, true);
  assert.equal(west.longitudeDegreesEast, -74.006);
});

test("longitude range includes both antimeridian endpoints", () => {
  assert.equal(longitudeBinding({ longitudeDegreesEast:-180 }).longitudeDegreesEast, -180);
  assert.equal(longitudeBinding({ longitudeDegreesEast:180 }).longitudeDegreesEast, 180);
});

test("negative zero normalizes to canonical zero", () => {
  const result = longitudeBinding({ longitudeDegreesEast:-0 });
  assert.equal(result.longitudeDegreesEast, 0);
  assert.equal(Object.is(result.longitudeDegreesEast, -0), false);
});

test("boolean and scalar presence claims are rejected", () => {
  assert.throws(() => longitudeBinding(true), /must be an object/);
  assert.throws(() => longitudeBinding(121.5), /must be an object/);
});

test("non-finite and out-of-range longitude fail closed", () => {
  assert.throws(() => longitudeBinding({ longitudeDegreesEast:NaN }), /must be finite/);
  assert.throws(() => longitudeBinding({ longitudeDegreesEast:Infinity }), /must be finite/);
  assert.throws(() => longitudeBinding({ longitudeDegreesEast:180.0001 }), /between -180 and \+180/);
  assert.throws(() => longitudeBinding({ longitudeDegreesEast:-180.0001 }), /between -180 and \+180/);
});

test("longitude contract documents the proof semantics", () => {
  assert.equal(LONGITUDE_BINDING_CONTRACT.field, "longitudeDegreesEast");
  assert.deepEqual(LONGITUDE_BINDING_CONTRACT.rangeDegrees, [-180, 180]);
  assert.equal(LONGITUDE_BINDING_CONTRACT.signConvention, "east-positive-degrees-from-greenwich");
  assert.equal(LONGITUDE_BINDING_CONTRACT.rejectsBooleanPresenceClaims, true);
});
