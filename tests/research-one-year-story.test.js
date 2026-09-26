import test from "node:test";
import assert from "node:assert/strict";
import { researchOneYearStory } from "../src/recurrence/research-one-year-story.js";
import { researchYearStripState } from "../src/research-year-strip-view.js";

test("selected-year narrative shows genuine 2024 Li Chun position and keeps the year boundary separate from Jan 1",()=>{
  const before={year:2024,month:2,day:1};
  const after={year:2024,month:2,day:10};
  const a=researchOneYearStory(before,researchYearStripState(before));
  const b=researchOneYearStory(after,researchYearStripState(after));
  assert.equal(a.yearLength,366);
  assert.equal(a.dayPhaseAcrossCivilYear,6);
  assert.equal(a.activeYear.name,"癸卯");
  assert.equal(b.activeYear.name,"甲辰");
  assert.equal(a.activeYear.status,"model-estimated");
  assert.equal(b.activeYear.status,"model-estimated");
  assert.ok(a.selectedPosition<b.selectedPosition);
  assert.ok(a.liChun&&b.liChun,"normal modern evidence should position Li Chun without faking it");
  assert.ok(a.selectedPosition<a.liChun.position);
  assert.ok(b.selectedPosition>b.liChun.position);
  assert.ok(Math.abs(a.liChun.position-b.liChun.position)<0.01);
  assert.equal(a.liChun.before,"癸卯");
  assert.equal(a.liChun.after,"甲辰");
});

test("a Li Chun boundary calendar date must remain explicitly unresolved without a selected time",()=>{
  const date={year:2024,month:2,day:4};
  const s=researchOneYearStory(date,researchYearStripState(date));
  assert.equal(s.activeYear.status,"unresolved");
  assert.equal(s.activeYear.name,null);
  assert.ok(s.liChun);
  assert.ok(s.selectedPosition>=0&&s.selectedPosition<=100);
});

test("365 vs 366 days advances the continuous Day cycle by five vs six independent of Year",()=>{
  const a=researchOneYearStory({year:2023,month:12,day:31});
  const b=researchOneYearStory({year:2024,month:2,day:29});
  const c=researchOneYearStory({year:1900,month:3,day:1});
  const d=researchOneYearStory({year:2000,month:2,day:29});
  assert.deepEqual(
    [a.yearLength,b.yearLength,c.yearLength,d.yearLength],
    [365,366,365,366]
  );
  assert.deepEqual(
    [a.dayPhaseAcrossCivilYear,b.dayPhaseAcrossCivilYear,c.dayPhaseAcrossCivilYear,d.dayPhaseAcrossCivilYear],
    [5,6,5,6]
  );
  assert.equal(a.selectedPosition,100);
  assert.equal(b.selectedDayOrdinal,60);
});

test("no seasonal evidence never draws a guessed Li Chun marker or invents an actual pillar",()=>{
  const date={year:10000000,month:9,day:13};
  const s=researchOneYearStory(date);
  assert.equal(s.liChun,null);
  assert.equal(s.activeYear.status,"not-evaluated");
  assert.equal(s.activeYear.name,null);
  assert.ok(s.liChunUnavailable);
  assert.ok(Object.isFrozen(s));
  assert.ok(Object.isFrozen(s.selectedDate));
});

test("evidence for a different calendar date must not be attached to the selected strip",()=>{
  const date={year:2024,month:2,day:1};
  assert.throws(()=>researchOneYearStory(date,researchYearStripState({year:2024,month:2,day:10})),RangeError);
  assert.throws(()=>researchOneYearStory({year:2025,month:2,day:29}),RangeError);
});
