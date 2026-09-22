import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import {
  SEXAGENARY_YEAR_ANCHOR,
  sexagenaryYearPillarForLiChunYear
} from "../src/calendar/sexagenary-year.js";

test("recurrence exposes nominal 60-year sequence without masquerading as a year pillar", () => {
  const state = recurrenceState({ year:2026, month:9, day:13 }, 60);

  assert.equal(state.closed.yearSequence, true);
  assert.equal(state.phases.yearSequence, 0);
  assert.equal("year" in state.closed, false);
  assert.equal("year" in state.phases, false);
  assert.equal("yearPillar" in state, false);
});

test("60-year sequence identity and Li-Chun year-pillar labeling remain separate authorities", () => {
  assert.equal(SEXAGENARY_YEAR_ANCHOR.convention, "year-label-after-li-chun");
  assert.equal(sexagenaryYearPillarForLiChunYear(2026).name, "丙午");
  assert.equal(sexagenaryYearPillarForLiChunYear(2086).name, "丙午");

  const state = recurrenceState({ year:2026, month:9, day:13 }, 60);
  assert.equal(state.closed.yearSequence, true);
  assert.equal("activeYearLabel" in state, false);
});

test("Research production code does not revive the ambiguous year-closure dataset", async () => {
  const [view, determinacyView, spine] = await Promise.all([
    readFile(new URL("../src/recurrence-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
    readFile(new URL("../src/research-narrative-spine-view.js", import.meta.url), "utf8")
  ]);

  for (const source of [view, determinacyView, spine]) {
    assert.doesNotMatch(source, /dataset\.yearClosed|dataset\.yearPhase\b|boolDataset\("yearClosed"\)|data-year-closed/);
  }

  assert.match(view, /dataset\.yearSequenceClosed/);
  assert.match(view, /dataset\.yearSequencePhase/);
  assert.match(determinacyView, /boolDataset\("yearSequenceClosed"\)/);
  assert.match(spine, /boolDataset\("yearSequenceClosed"\)/);
});
