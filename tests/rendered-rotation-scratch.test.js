import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const renderer = readFileSync(new URL("../src/wheel/kinetic-renderer.js", import.meta.url), "utf8");

test("reference-frame flush reuses its rendered-rotation scratch map", () => {
  assert.match(renderer, /const worldRotations = new Map\(\);\s*const renderedRotations = new Map\(\);\s*const lastRenderedRotation = new Map\(\);/);

  const start = renderer.indexOf("function flushReferenceFrame");
  const end = renderer.indexOf("function scheduleReferenceFrameFlush", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = renderer.slice(start, end);

  assert.match(body, /renderedRotations\.clear\(\);\s*RINGS\.forEach\(ring => \{/);
  assert.doesNotMatch(body, /new Map\(/);
});
