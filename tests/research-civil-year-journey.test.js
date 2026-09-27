import test from "node:test";
import assert from "node:assert/strict";
import { researchCivilYearJourney } from "../src/recurrence/research-civil-year-journey.js";
import { researchYearStripState } from "../src/research-year-strip-view.js";
import { gregorianOrdinal } from "../src/recurrence/gregorian-cycle.js";

const d=(year,month,day)=>({year,month,day});
const evidenced=year=> {
  const date=d(year,6,1);
  return researchCivilYearJourney(date,{
    boundaryEvidence:researchYearStripState(date),
    yearEvidenceForDate:researchYearStripState
  });
};

test("2023 Jan-to-Jan advances the canonical Day by six full 60-day turns plus five",()=>{
  const result=evidenced(2023);
  assert.equal(result.available,true);
  assert.deepEqual([result.yearLength,result.turns,result.remainder],[365,6,5]);
  assert.deepEqual([result.milestones[0].date,result.milestones.at(-1).date],
    [d(2023,1,1),d(2024,1,1)]);
  assert.equal((result.endDay.index-result.startDay.index+60)%60,5);
  assert.equal(result.milestones.at(-1).elapsedDays,365);
  assert.equal(result.milestones.at(-1).completedTurns,6);
  assert.equal(result.milestones.at(-1).partialDays,5);
  assert.equal(result.milestones.at(-1).activeYear.pillar?.name,"癸卯");
  assert.notEqual(result.milestones.at(-1).activeYear.status,"not-evaluated");
});

test("2024 leap-year path retains date-only 2024 Li Chun uncertainty and +6 days",()=>{
  const result=evidenced(2024);
  assert.equal(result.available,true);
  assert.deepEqual([result.yearLength,result.turns,result.remainder],[366,6,6]);
  assert.deepEqual(result.milestones.map(x=>x.id),
    ["start","li-chun-date","after-li-chun",
      "turn-1","turn-2","turn-3","turn-4","turn-5","turn-6","next-jan-1"]);
  assert.equal(result.milestones[0].activeYear.pillar?.name,"癸卯");
  const boundary=result.milestones[1];
  assert.deepEqual(boundary.date,result.boundary.date);
  assert.equal(boundary.activeYear.status,"unresolved");
  assert.equal(boundary.activeYear.pillar,null);
  assert.deepEqual(boundary.activeYear.possiblePillars.map(x=>x.name),["癸卯","甲辰"]);
  assert.equal(result.milestones[2].activeYear.pillar?.name,"甲辰");
  assert.deepEqual(result.milestones.at(-1).date,d(2025,1,1));
  assert.equal(result.milestones.at(-1).activeYear.pillar?.name,"甲辰",
    "Gregorian New Year is not the following Li Chun");
  assert.equal((result.endDay.index-result.startDay.index+60)%60,6);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.milestones));
});

test("every stage is one canonical date with elapsed days, not a nominal Year label",()=>{
  const result=evidenced(2024);
  const first=gregorianOrdinal(result.milestones[0].date);
  for(const stage of result.milestones){
    assert.equal(stage.elapsedDays,gregorianOrdinal(stage.date)-first);
    assert.equal(stage.completedTurns,Math.floor(stage.elapsedDays/60));
    assert.equal(stage.partialDays,stage.elapsedDays%60);
  }
});

test("each 60-day checkpoint closes one visible Day circuit without moving the Year authority",()=>{
  const result=evidenced(2024);
  const start=result.milestones[0];
  for(let n=1;n<=6;n++){
    const turn=result.milestones.find(s=>s.id==="turn-"+n);
    assert.ok(turn);
    assert.equal(turn.elapsedDays,60*n);
    assert.equal(turn.completedTurns,n);
    assert.equal(turn.partialDays,0);
    assert.equal(turn.day.name,start.day.name,
      "each full 60-day turn must return to the exact canonical Day name");
    assert.equal(turn.day.index,start.day.index);
  }
});

test("missing seasonal evidence must omit the boundary stage and leave actual Year not evaluated",()=>{
  const result=researchCivilYearJourney(d(10026,7,1));
  assert.equal(result.available,true);
  assert.equal(result.boundary,null);
  assert.deepEqual(result.milestones.map(stage=>stage.id),
    ["start","turn-1","turn-2","turn-3","turn-4","turn-5","turn-6","next-jan-1"]);
  assert.ok(result.milestones.every(stage=>stage.activeYear.status==="not-evaluated" &&
    stage.activeYear.pillar===null));
  assert.equal(result.milestones.at(-1).elapsedDays,result.yearLength);
});

test("year-range overflow is unavailable instead of shifting beyond supported Gregorian dates",()=>{
  const result=researchCivilYearJourney(d(10_000_000,9,13),{
    yearEvidenceForDate:()=>{throw Error("should not ask for unavailable next year");}
  });
  assert.equal(result.available,false);
  assert.equal(result.reason,"next-civil-year-out-of-range");
  assert.equal(result.milestones.length,0);
});

test("wrong-year or wrong-date authority is rejected rather than guessed",()=>{
  assert.throws(()=>researchCivilYearJourney(d(2024,6,1),{
    boundaryEvidence:researchYearStripState(d(2023,6,1))
  }),RangeError);
  assert.throws(()=>researchCivilYearJourney(d(2024,6,1),{
    yearEvidenceForDate:()=>researchYearStripState(d(2023,6,1))
  }),RangeError);
  assert.throws(()=>researchCivilYearJourney(d(2025,2,29)),RangeError);
});
