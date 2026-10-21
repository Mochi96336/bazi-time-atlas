import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { projectUnfoldedPhases } from "../src/recurrence/r17-unfolded-phase-projection.js";
import { signedShortestPhase } from "../src/recurrence/phase-fan-geometry.js";

const base = {year: 2026, month: 9, day: 13};
const projection = delta => projectUnfoldedPhases(recurrenceState(base, delta));

test("R17 +1980 retains the authentic −20 / 0 / 0 phase result", () => {
  assert.deepEqual(projection(1980).map(row => row.signed), [-20, 0, 0]);
  assert.deepEqual(projection(1980).map(row => row.fraction), [-0.1, 0, 0]);
});

test("R17 +24000 closes all three discrete phases", () => {
  assert.deepEqual(projection(24000).map(row => row.closed), [true, true, true]);
});

test("R17 daily phase comes from actual Gregorian day difference", () => {
  assert.deepEqual(projection(400).map(row => row.signed), [0, -20, -3]);
  assert.deepEqual(projection(60).map(row => row.signed), [60, 0, 15]);
});

test("R17 projection handles unresolved leap-date day phase explicitly", () => {
  const state = recurrenceState({year:2024,month:2,day:29}, 1);
  const rows = projectUnfoldedPhases(state);
  assert.deepEqual(rows.map(row=>row.available), [true,true,false]);
  assert.equal(rows[2].fraction, null);
  assert.equal(rows[2].closed, false);
});

test("R17 matches the existing signed fan for a broad set of deltas", () => {
  for (let delta=0; delta<=24000;delta+=23) {
    const state=recurrenceState(base,delta);
    const rows=projectUnfoldedPhases(state);
    for(const row of rows) {
      assert.equal(row.signed,signedShortestPhase(state.phases[row.key], row.modulus));
      assert.ok(row.fraction>=-1 && row.fraction<=1);
    }
  }
});

test("R17 browser lab imports its phase source rather than duplicating chronology", () => {
  const html = readFileSync(new URL("../prototypes/research-r17-unfolded-phase.html",import.meta.url),"utf8");
  assert.match(html, /type="module"/);
  assert.match(html, /import \{ recurrenceState \}/);
  assert.match(html, /import \{ projectUnfoldedPhases \}/);
  assert.doesNotMatch(html, /function ordinal\(/);
  assert.doesNotMatch(html, /\\nconst base/);
});
