import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  activeLiChunYearForSeasonalLongitude,
  researchDiscreteDateState,
  researchSeasonalTimeState
} from "../src/research/research-time-state.js";
import { SEASONAL_DRIFT_26026_RESEARCH as DATA } from "../src/research/seasonal-drift-26026-research-data.js";

test("seasonal catalogue year switches at Li Chun rather than Gregorian Jan 1", () => {
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,270),2025);
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,300),2025);
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,314),2025);
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,315),2026);
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,0),2026);
  assert.equal(activeLiChunYearForSeasonalLongitude(2026,269),2026);
});

test("Li Chun seasonal state keeps BaZi year/month visible across 24k while refusing fake deep-time Day/Hour", () => {
  const state = researchSeasonalTimeState(315);

  assert.equal(state.owner,"seasonal");
  assert.equal(state.selection.termName,"立春");
  assert.equal(state.selection.baziMonthBranch,"寅");

  assert.equal(state.base.pillars.year.name,"丙午");
  assert.equal(state.base.pillars.month.name,"庚寅");
  assert.equal(state.base.pillars.year.status,"resolved");
  assert.equal(state.base.pillars.month.status,"resolved");
  assert.equal(state.base.pillars.day.status,"resolved");
  assert.equal(state.base.pillars.hour.status,"resolved");
  assert.ok(state.base.pillars.day.name);
  assert.ok(state.base.pillars.hour.name);

  assert.equal(state.target.pillars.year.name,"丙午");
  assert.equal(state.target.pillars.month.name,"庚寅");
  assert.equal(state.target.pillars.year.status,"research-resolved");
  assert.equal(state.target.pillars.month.status,"research-resolved");
  assert.equal(state.target.pillars.day.status,"unresolved");
  assert.equal(state.target.pillars.hour.status,"unresolved");
  assert.equal(state.target.pillars.day.name,null);
  assert.equal(state.target.pillars.hour.name,null);
  assert.equal(state.target.coordinate.localClockStatus,"estimated");
  assert.ok(state.target.coordinate.uncertaintyDays > 1);
});

test("seasonal target TT crossing is recovered from the accepted 24k drift timeline", () => {
  const state = researchSeasonalTimeState(315);
  const reconstructedDrift =
    state.target.coordinate.ttJulianDay -
    state.base.coordinate.ttJulianDay -
    DATA.gregorianDaySpanDays;

  assert.ok(Math.abs(reconstructedDrift - state.comparison.driftDays) < 1e-8);
  assert.equal(DATA.gregorianDaySpanDays,8_765_820);
});

test("date-only Research state exposes sequence evidence without pretending to know every pillar", () => {
  const state = researchDiscreteDateState({ year:2026, month:9, day:13 },24_000);

  assert.equal(state.owner,"discrete");
  assert.equal(state.base.pillars.year.status,"sequence-only");
  assert.equal(state.base.pillars.day.status,"sequence-only");
  assert.equal(state.base.pillars.month.status,"unresolved");
  assert.equal(state.base.pillars.hour.status,"unresolved");
  assert.equal(state.target.pillars.year.status,"sequence-only");
  assert.equal(state.target.pillars.day.status,"sequence-only");
  assert.equal(state.target.pillars.month.status,"unresolved");
  assert.equal(state.target.pillars.hour.status,"unresolved");
  assert.equal(state.comparison.yearPhaseClosed,true);
  assert.equal(state.comparison.dayPhaseClosed,true);
});

test("shared Research time state condenses only after the same sticky node is stuck", async () => {
  const [view, css, html] = await Promise.all([
    readFile(new URL("../src/research-time-state-view.js", import.meta.url), "utf8"),
    readFile(new URL("../research-time-state.css", import.meta.url), "utf8"),
    readFile(new URL("../recurrence.html", import.meta.url), "utf8")
  ]);

  assert.equal((html.match(/id="research-time-state"/g) ?? []).length,1);
  assert.match(view,/function syncStickyPresentation\(\)/);
  assert.match(view,/root\.dataset\.stuck = String\(window\.scrollY > 0 && rect\.top <= top \+ 1\)/);
  assert.match(view,/syncStickyPresentation\(\);/);
  assert.match(view,/root\.dataset\.stuck = "false"/);

  assert.match(css,/\.research-time-state\[data-stuck="true"\]/);
  assert.match(css,/@media \(max-width:680px\)[\s\S]*?\.research-time-state\[data-stuck="true"\] \.research-time-state-compare\s*\{[\s\S]*?grid-template-columns:1fr 1fr/);
  assert.match(css,/@media \(max-width:680px\)[\s\S]*?\.research-time-state\[data-stuck="true"\] \.research-time-side > header\s*\{[\s\S]*?grid-template-columns:auto minmax\(0,1fr\)/);
  assert.match(css,/@media \(max-width:680px\)[\s\S]*?\.research-time-state\[data-stuck="true"\] \.research-time-pillar > small\s*\{[\s\S]*?display:none/);
  assert.doesNotMatch(view,/cloneNode|appendChild\(root\.clone|createElement\(["']section["']\)/);
});

test("shared Research time state uses the Research semantic palette", async () => {
  const css = await readFile(new URL("../research-time-state.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.match(css, /data-status="research-resolved"[^}]*var\(--research-candidate\)/);
  assert.match(css, /data-status="sequence-only"[^}]*var\(--research-text-secondary\)/);
  assert.match(css, /data-status="unresolved"[^}]*var\(--research-diagram-unresolved\)/);
  for (const token of [
    "--research-text-primary",
    "--research-text-secondary",
    "--research-text-muted"
  ]) assert.ok(css.includes(token), `missing semantic token ${token}`);
});
