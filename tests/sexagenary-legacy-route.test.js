import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LEGACY_SEXAGENARY_REFERENCE,
  resolveLegacySexagenaryReference
} from "../src/sexagenary-legacy-route.js";

test("valid legacy Ganzhi preserves the requested standalone reference", () => {
  const result = resolveLegacySexagenaryReference("乙酉");
  assert.equal(result.name, "乙酉");
  assert.equal(result.ordinal, 22);
});

test("bare legacy Sexagenary route preserves the historical 甲子 default", () => {
  assert.equal(DEFAULT_LEGACY_SEXAGENARY_REFERENCE, "甲子");
  const result = resolveLegacySexagenaryReference(null);
  assert.equal(result.name, "甲子");
  assert.equal(result.ordinal, 1);
});

test("invalid legacy Ganzhi fails closed to the historical 甲子 default", () => {
  const result = resolveLegacySexagenaryReference("not-a-ganzhi");
  assert.equal(result.name, "甲子");
  assert.equal(result.ordinal, 1);
});
