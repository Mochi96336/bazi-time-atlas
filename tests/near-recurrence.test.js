import test from "node:test";
import assert from "node:assert/strict";
import {
  EXACT_DISCRETE_STEP_YEARS,
  futureExactDiscreteAstronomyCandidates,
  rankExactDiscreteAstronomyCandidates
} from "../src/recurrence/near-recurrence.js";
import { solarTermShapeResiduals } from "../src/recurrence/berger-orbit.js";

test("future search only evaluates 24,000-year exact-discrete closures", () => {
  const candidates = futureExactDiscreteAstronomyCandidates(2026);
  assert.equal(EXACT_DISCRETE_STEP_YEARS, 24_000);
  assert.equal(candidates.length, 41);
  assert.equal(candidates[0].deltaYears, 24_000);
  assert.equal(candidates.at(-1).deltaYears, 984_000);
  assert.equal(candidates.at(-1).targetYear, 986_026);
  assert.ok(candidates.every(candidate => candidate.deltaYears % 24_000 === 0));
});

test("ranking improves on the first 24,000-year astronomical residual", () => {
  const search = rankExactDiscreteAstronomyCandidates(2026);
  console.log(
    `[near-recurrence-shape] first +${search.chronological[0].deltaYears} max=${search.chronological[0].maxAbsHours.toFixed(9)} h rms=${search.chronological[0].rmsHours.toFixed(9)} h; `
    + `+792000 max=${search.chronological.find(item => item.deltaYears === 792000)?.maxAbsHours.toFixed(9)} h; `
    + `best +${search.best?.deltaYears} max=${search.best?.maxAbsHours.toFixed(9)} h rms=${search.best?.rmsHours.toFixed(9)} h`
  );
  const nearResidual = solarTermShapeResiduals(2026, 794026);
  console.log(
    "[near-recurrence-shape] +792000 terms "
    + nearResidual.terms.map(term => `${term.name}=${term.residualHours.toFixed(9)}`).join(" ")
  );
  assert.equal(search.candidateCount, 41);
  assert.ok(search.best);
  assert.ok(search.best.maxAbsHours < search.chronological[0].maxAbsHours);
  assert.equal(search.best.deltaYears % 24_000, 0);
  assert.ok(search.best.targetYear <= 1_001_950);
  for (let index = 1; index < search.ranked.length; index += 1) {
    assert.ok(search.ranked[index].maxAbsHours >= search.ranked[index - 1].maxAbsHours);
  }
});

test("search stays within the model horizon for a different base year", () => {
  const candidates = futureExactDiscreteAstronomyCandidates(100_000);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(candidate => candidate.targetYear <= 1_001_950));
});
