import assert from "node:assert/strict";
import test from "node:test";
import { cssSource } from "./helpers/css-source.js";

const css = cssSource("ring-identity.css");

test("B7 retired: time rings carry no per-ring hue at rest (review 2026-11-21)", () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /--hour|--day|--month|--year|fill:/);
});
