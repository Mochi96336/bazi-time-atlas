import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EXACT_DISCRETE_STEP_YEARS,
  futureExactDiscreteAstronomyCandidates,
  rankExactDiscreteAstronomyCandidates
} from "../src/recurrence/near-recurrence.js";
import { cssSource } from "./helpers/css-source.js";

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
  assert.equal(search.candidateCount, 41);
  assert.ok(search.best);
  assert.equal(search.best.deltaYears, 792_000);
  assert.ok(Math.abs(search.chronological[0].maxAbsHours - 94.801900722) < 1e-6);
  assert.ok(Math.abs(search.best.maxAbsHours - 10.385719314) < 1e-6);
  assert.ok(Math.abs(search.best.rmsHours - 6.142803070) < 1e-6);
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

test("long-horizon visualization keeps hour axes, responsive coordinates and a six-row touch alternative", async () => {
  const [markup, view, css, suites] = await Promise.all([
    readFile(new URL("../recurrence.html",import.meta.url),"utf8"),
    readFile(new URL("../src/near-recurrence-view.js",import.meta.url),"utf8"),
    Promise.resolve(cssSource("near-recurrence.css")),
    readFile(new URL("../scripts/visual-ci-suites.mjs",import.meta.url),"utf8")
  ]);
  assert.match(markup,/class="near-chart-figure"/);
  assert.match(markup,/十二節最大形狀殘差/);
  assert.match(markup,/橫軸：距基準的 Δ 年數（千年）/);
  assert.match(view,/chart\.getBoundingClientRect\(\)\.width/);
  assert.match(view,/chart\.dataset\.nearChartYUnit = "hours"/);
  assert.match(view,/const yFor = value => height - bottom -/);
  assert.match(view,/Math\.ceil\(observedMax \/ 25\) \* 25/);
  assert.match(view,/new ResizeObserver/);
  assert.match(view,/search\.ranked\.slice\(0, 6\)/);
  assert.match(css,/\.near-y-label \{ text-anchor:end; \}/);
  assert.match(css,/min-height:44px/);
  assert.match(suites,/visual-check-near-recurrence-production\.mjs/);
});
