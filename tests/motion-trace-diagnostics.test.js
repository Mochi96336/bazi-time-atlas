import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

test("motion-trace delta diagnostics write only for hidden layers", () => {
  const start = renderer.indexOf("function updateMotionTrace");
  const end = renderer.indexOf("function frameSettings", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = renderer.slice(start, end);

  assert.match(body, /const delta = rotationDegrees - previous;\s*if \(node\.dataset\.layerHidden === "true"\) \{\s*node\.dataset\.lastDelta = delta\.toFixed\(4\);\s*clearMotionTrace\(id\);\s*return;\s*\}\s*if \(Math\.abs\(delta\) < MOTION_TRACE_MIN_DEGREES\) return;/s);
  assert.equal((body.match(/node\.dataset\.lastDelta\s*=/g) ?? []).length, 1);
});
