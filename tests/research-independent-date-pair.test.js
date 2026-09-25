import test from "node:test";
import assert from "node:assert/strict";
import {
  compareResearchDates,
  activeYearIdentityForDate
} from "../src/recurrence/research-date-pair.js";
import { shiftGregorianDate } from "../src/recurrence/gregorian-date-navigation.js";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { researchGanzhiCycleComparison } from "../src/recurrence/ganzhi-cycle-comparison.js";
import { sexagenaryYearPillarForLiChunYear } from "../src/calendar/sexagenary-year.js";
import { resolveDayHourPillars, DAY_BOUNDARY } from "../src/calendar/tyme-adapter.js";

function seasonalEvidence(date, status, side = null) {
  const before = sexagenaryYearPillarForLiChunYear(date.year - 1);
  const after = sexagenaryYearPillarForLiChunYear(date.year);
  const pillar = side === "before" ? before : side === "after" ? after : null;
  return {
    selectedDate:date,
    selectedYearMembership:{
      status,
      side,
      pillar,
      reason:status === "unresolved" ? "target-instant-unbound" : "test-seasonal-evidence"
    },
    selectedYearPillar:pillar,
    liChunTransition:{before,after}
  };
}

test("freely compared dates advance the Day by one without requiring a year shift", () => {
  const base = {year:2024,month:2,day:3};
  const target = {year:2024,month:2,day:4};
  const pair = compareResearchDates(base,target);
  assert.equal(pair.comparisonKind,"independent-civil-dates");
  assert.equal(pair.daySequence.elapsedDays,1);
  assert.equal(pair.daySequence.phase,1);
  assert.equal(pair.yearSequence.phase,0);
  assert.equal(pair.applicability.annualRecurrenceEligible,false);
  assert.equal(pair.applicability.astronomy,"not-evaluated");
  assert.equal(pair.closure.astronomicalShape,null);
  assert.equal(pair.closure.fourPillars,null);
  assert.equal(pair.base.activeYear.status,"not-evaluated");
  assert.equal(pair.base.activeYear.pillar,null);
  assert.equal(pair.target.activeYear.pillar,null);
  assert.ok(Object.isFrozen(pair));
  assert.ok(Object.isFrozen(pair.base));
  assert.ok(Object.isFrozen(pair.yearSequence));
});

test("civil New Year increments only the nominal year, not an invented active Li Chun pillar", () => {
  const before = {year:2023,month:12,day:31};
  const after = {year:2024,month:1,day:1};
  const pair = compareResearchDates(before,after,{
    baseYearEvidence:seasonalEvidence(before,"exact","after"),
    targetYearEvidence:seasonalEvidence(after,"exact","before")
  });
  assert.equal(pair.yearSequence.calendarYearDelta,1);
  assert.equal(pair.yearSequence.phase,1);
  assert.equal(pair.daySequence.phase,1);
  assert.equal(pair.base.nominalYear.name,"癸卯");
  assert.equal(pair.target.nominalYear.name,"甲辰");
  assert.equal(pair.base.activeYear.pillar.name,"癸卯");
  assert.equal(pair.target.activeYear.pillar.name,"癸卯");
  assert.equal(pair.base.activeYear.status,"exact");
  assert.equal(pair.target.activeYear.status,"exact");
  assert.equal(pair.applicability.annualRecurrenceEligible,false);
});

test("pre/post Li Chun active-year identities can change with NO change in nominal year sequence", () => {
  const before = {year:2024,month:2,day:1};
  const after = {year:2024,month:2,day:10};
  const pair = compareResearchDates(before,after,{
    baseYearEvidence:seasonalEvidence(before,"exact","before"),
    targetYearEvidence:seasonalEvidence(after,"exact","after")
  });
  assert.equal(pair.yearSequence.phase,0);
  assert.equal(pair.daySequence.phase,9);
  assert.equal(pair.base.nominalYear.name,"甲辰");
  assert.equal(pair.target.nominalYear.name,"甲辰");
  assert.equal(pair.base.activeYear.pillar.name,"癸卯");
  assert.equal(pair.target.activeYear.pillar.name,"甲辰");
});

test("unresolved boundary never fabricates a side or collapses possible pillars", () => {
  const date = {year:2024,month:2,day:4};
  const unresolved = activeYearIdentityForDate(date,seasonalEvidence(date,"unresolved"));
  assert.equal(unresolved.status,"unresolved");
  assert.equal(unresolved.pillar,null);
  assert.equal(unresolved.side,null);
  assert.deepEqual(unresolved.possiblePillars.map(p=>p.name),["癸卯","甲辰"]);
  assert.equal(compareResearchDates(date,date).base.activeYear.status,"not-evaluated");
  assert.equal(compareResearchDates(date,date,{
    baseYearEvidence:seasonalEvidence(date,"unresolved")
  }).base.activeYear.status,"unresolved");
  assert.throws(()=>activeYearIdentityForDate(date,seasonalEvidence({year:2024,month:2,day:5},"exact","before")),RangeError);
});

test("estimated seasonal year evidence stays visibly different from exact proof", () => {
  const date = {year:10026,month:9,day:13};
  const identity = activeYearIdentityForDate(date,seasonalEvidence(date,"model-estimated","after"));
  assert.equal(identity.status,"model-estimated");
  assert.equal(identity.pillar.name,sexagenaryYearPillarForLiChunYear(10026).name);
  assert.equal(identity.reason,"test-seasonal-evidence");
  const corrupt = seasonalEvidence(date,"exact","after");
  corrupt.selectedYearPillar = sexagenaryYearPillarForLiChunYear(date.year-1);
  assert.throws(()=>activeYearIdentityForDate(date,corrupt),/does not agree/);
  const contradictory = seasonalEvidence(date,"unresolved");
  contradictory.selectedYearPillar = sexagenaryYearPillarForLiChunYear(date.year);
  assert.throws(()=>activeYearIdentityForDate(date,contradictory),/must not contain/);
});

test("negative date movement preserves chronological direction and modular day identity", () => {
  const earlier = {year:2023,month:12,day:31};
  const later = {year:2024,month:1,day:1};
  const forwards = compareResearchDates(earlier,later);
  const backwards = compareResearchDates(later,earlier);
  assert.equal(forwards.daySequence.elapsedDays,1);
  assert.equal(forwards.daySequence.direction,1);
  assert.equal(backwards.daySequence.elapsedDays,-1);
  assert.equal(backwards.daySequence.direction,-1);
  assert.equal(forwards.daySequence.phase,1);
  assert.equal(backwards.daySequence.phase,59);
  assert.equal(forwards.yearSequence.phase,1);
  assert.equal(backwards.yearSequence.phase,59);
  assert.deepEqual(shiftGregorianDate(later,-1),earlier);
});

test("free-date comparison agrees with reviewed modern Tyme local-noon day identity", () => {
  for (const [base,target] of [
    [{year:2024,month:2,day:28},{year:2024,month:2,day:29}],
    [{year:2024,month:2,day:29},{year:2024,month:3,day:1}],
    [{year:2026,month:9,day:13},{year:2026,month:11,day:12}]
  ]) {
    const pair = compareResearchDates(base,target);
    for (const dated of [pair.base,pair.target]) {
      assert.equal(dated.day.name,resolveDayHourPillars(
        { ...dated.date,hour:12,minute:0,second:0 },
        { dayBoundary:DAY_BOUNDARY.CIVIL_MIDNIGHT }
      ).pillars.day.name);
    }
    assert.equal((pair.target.day.index-pair.base.day.index+60)%60,pair.daySequence.phase);
  }
});

test("all existing annual candidates remain exactly equivalent to the legacy recurrence authority", () => {
  const dates = [
    {year:2026,month:9,day:13},
    {year:2024,month:2,day:28},
    {year:2000,month:12,day:31}
  ];
  for (const date of dates) {
    for (const delta of [0,1,60,400,1200,1980,8000,24000]) {
      const legacy = recurrenceState(date,delta);
      const pair = compareResearchDates(date,legacy.targetDate);
      const oldView = researchGanzhiCycleComparison(date,delta);
      assert.equal(pair.applicability.annualRecurrenceEligible,true);
      assert.equal(pair.applicability.annualDeltaYears,delta);
      assert.equal(pair.daySequence.elapsedDays,legacy.dayDelta);
      assert.equal(pair.daySequence.phase,legacy.phases.day);
      assert.equal(pair.yearSequence.phase,legacy.phases.yearSequence);
      assert.equal(pair.closure.nominalYearAndDay,legacy.closed.yearSequence&&legacy.closed.day);
      assert.equal(pair.target.day.name,oldView.target.day.name);
      assert.equal(pair.target.nominalYear.name,oldView.target.year.name);
      assert.equal(pair.applicability.astronomy,"not-evaluated");
    }
  }
});

test("the 24k global discrete closure has no implicit astronomical or four-pillar verdict", () => {
  const pair = compareResearchDates(
    {year:2026,month:9,day:13},
    {year:26026,month:9,day:13}
  );
  assert.equal(pair.yearSequence.closed,true);
  assert.equal(pair.daySequence.closed,true);
  assert.equal(pair.closure.nominalYearAndDay,true);
  assert.equal(pair.closure.gregorianStructure,null);
  assert.equal(pair.closure.astronomicalShape,null);
  assert.equal(pair.closure.fourPillars,null);
  assert.equal(pair.target.activeYear.status,"not-evaluated");
});

test("invalid, overflowed or mismatched inputs must fail closed", () => {
  const base = {year:2024,month:2,day:29};
  assert.throws(()=>compareResearchDates(base,{year:2025,month:2,day:29}),RangeError);
  assert.throws(()=>compareResearchDates(base,{year:0,month:12,day:31}),RangeError);
  assert.throws(()=>compareResearchDates(base,{year:10000001,month:1,day:1}),RangeError);
  assert.throws(()=>activeYearIdentityForDate(base,{ selectedDate:base,
    selectedYearMembership:{status:"verified",pillar:null},
    selectedYearPillar:null
  }),TypeError);
  assert.equal(compareResearchDates(base,{year:2028,month:2,day:29}).applicability.annualRecurrenceEligible,true);
});
