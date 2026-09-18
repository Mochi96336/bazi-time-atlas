import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const atlas = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");

test("linked drag runtime reuses one result object and one longitude callback", () => {
  assert.match(atlas, /const linkedDragResult = \{[\s\S]*crossedBoundaries:0[\s\S]*\};/);
  assert.match(atlas, /const linkedLongitudeAtMs = instantMs => solarLongitudeAtInstant\(instantMs, state\.timeContext\);/);
  assert.match(atlas, /applyLinkedRingDragInto\(\s*linkedDragResult,\s*id,\s*beforeMs,\s*deltaDegrees,\s*state\.timeContext,\s*linkedLongitudeAtMs\s*\)/s);

  const start = atlas.indexOf("function applyLinkedDragToTime");
  const end = atlas.indexOf("function installRingDrag", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = atlas.slice(start, end);
  assert.doesNotMatch(body, /applyLinkedRingDrag\(\{/);
  assert.doesNotMatch(body, /instantMs\s*=>\s*solarLongitudeAtInstant/);
});
