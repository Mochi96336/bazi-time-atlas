import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INTRO_SWEEP_DURATION_MS,
  INTRO_SWEEP_SPAN_MS,
  easeInOutCubic,
  introSweepInstant,
  shouldRunIntroSweep
} from "../src/interaction/intro-sweep.js";

test("intro sweep spans exactly one Hour-ring turn and lands on the exact instant", () => {
  assert.equal(INTRO_SWEEP_SPAN_MS, 5 * 86_400_000);
  const endMs = Date.parse("2026-09-13T23:43:42.000Z");
  assert.equal(introSweepInstant({ endMs, elapsedMs:0 }).instantMs, endMs - INTRO_SWEEP_SPAN_MS);
  const end = introSweepInstant({ endMs, elapsedMs:INTRO_SWEEP_DURATION_MS });
  assert.deepEqual(end, { instantMs:endMs, done:true });
  let previous = -Infinity;
  for (let t = 0; t <= INTRO_SWEEP_DURATION_MS; t += 120) {
    const { instantMs } = introSweepInstant({ endMs, elapsedMs:t });
    assert.ok(instantMs >= previous && instantMs <= endMs, "monotonic forward time");
    previous = instantMs;
  }
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
});

test("intro sweep only runs on a plain first landing without reduced motion", () => {
  assert.equal(shouldRunIntroSweep({ search:"" }), true);
  assert.equal(shouldRunIntroSweep({ search:"?instant=2026-09-13T23%3A43%3A42.000Z" }), false);
  assert.equal(shouldRunIntroSweep({ search:"?analysis=1" }), false);
  assert.equal(shouldRunIntroSweep({ search:"", reducedMotion:true }), false);
  assert.equal(shouldRunIntroSweep({ search:"", seen:true }), false);
  assert.equal(shouldRunIntroSweep({ search:"", hidden:true }), false);
  assert.equal(shouldRunIntroSweep({ search:"", embedded:true }), false);
});

test("atlas controller wires the sweep without URL writes and with input skip", () => {
  const source = readFileSync(new URL("../src/kinetic-atlas.js", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("function runIntroSweep()"), source.indexOf("function initialize()"));
  assert.ok(body.length > 0);
  assert.doesNotMatch(body, /history\.replaceState/);
  assert.match(body, /addEventListener\("pointerdown", finish, true\)/);
  assert.match(body, /addEventListener\("keydown", finish, true\)/);
  assert.match(source, /runIntroSweep\(\);\n\}\n\ninitialize\(\);/);
});
