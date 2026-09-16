import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [control, kinetic] = await Promise.all([
  readFile(new URL("../src/time-context-control.js", import.meta.url), "utf8"),
  readFile(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8")
]);

test("time-context UI reuses the existing readout instead of adding a toolbar owner", () => {
  assert.match(control, /\.readout-meta span:last-child/);
  assert.match(control, /time-context-trigger/);
  assert.match(control, /time-context-popover\[hidden\]\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(control, /\.instrument-toolbar|appendChild\([^)]*instrument-toolbar/);
});

test("time-context UI only emits a command and does not own URL or kinetic state", () => {
  assert.match(control, /dispatchEvent\(new CustomEvent\(TIME_CONTEXT_COMMAND/);
  assert.doesNotMatch(control, /history\.replaceState|location\.assign|location\.replace|selectedInstantUrl/);
  assert.match(kinetic, /instrument\.addEventListener\(TIME_CONTEXT_COMMAND/);
  assert.match(kinetic, /function setTimeContext\(timeContext, source = "command"\)/);
  assert.match(kinetic, /writeAtlasTimeContextSearch\(url\.searchParams, timeContext\)/);
});

test("temporal-context apply does not rewrite selectedMs or anchorMs", () => {
  const match = kinetic.match(/function setTimeContext\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(match, /state\.selectedMs\s*=/);
  assert.doesNotMatch(match, /state\.anchorMs\s*=/);
  assert.match(match, /state\.timeContext\s*=\s*timeContext/);
});
