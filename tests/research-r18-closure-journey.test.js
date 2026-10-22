import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { buildClosureJourney,classifyJourneyPoint } from "../src/recurrence/r18-closure-journey.js";
const base={year:2026,month:9,day:13};
const journey=buildClosureJourney(base);
test("R18 true year axis: local 1980, global 24000 and distinct gates",()=>{
 assert.equal(journey.firstLocal,1980);
 assert.equal(journey.firstGlobal,24000);
 assert.equal(journey.detail.year[0],60);
 assert.equal(journey.overview.gregorian[0],400);
 assert.equal(journey.overview.gregorianYear[0],1200);
 assert.equal(journey.overview.gregorianDay[0],8000);
 assert.deepEqual(journey.overview.all,[24000]);
 assert.equal(journey.detail.yearDay.includes(1980),true);
 assert.equal(journey.detail.gregorianYear.includes(1200),true);
 assert.equal(journey.detail.yearDay.includes(0),false);
 for(const key of ["gregorian","year","day","yearDay"]){
  for(const d of journey.detail[key]){
   const s=recurrenceState(base,d);
   const expected={gregorian:s.closed.gregorian,year:s.closed.yearSequence,day:s.closed.day,yearDay:s.closed.yearSequence&&s.closed.day};
   assert.ok(expected[key],key+" misrepresented year "+d);
  }
 }
});
test("R18 selected point distinguishes identity, local and complete recurrence",()=>{
 assert.equal(classifyJourneyPoint(journey,0).kind,"identity");
 assert.equal(classifyJourneyPoint(journey,1980).kind,"local");
 assert.equal(classifyJourneyPoint(journey,24000).kind,"all");
 assert.equal(classifyJourneyPoint(journey,400).kind,"gregorian");
 assert.match(classifyJourneyPoint(journey,0).detail,/不是非零重遇/);
 assert.throws(()=>classifyJourneyPoint(journey,24001),RangeError);
});
test("R18 day event is computed from actual Gregorian elapsed days",()=>{
 for(const d of [60,400,1200,1980,8000,24000]){
  const s=recurrenceState(base,d);
  const inLane=journey.detail.day.includes(d)||journey.overview.gregorianDay.includes(d);
  if(s.closed.day)assert.ok(inLane,"missing daily zero at "+d);
 }
 const leap=buildClosureJourney({year:2024,month:2,day:29});
 const invalid=classifyJourneyPoint(leap,1);
 assert.equal(invalid.kind,"unavailable");
 assert.equal(invalid.state.phases.day,null);
 assert.equal(leap.overview.all.at(-1),24000);
});
test("R18 prototype keeps distinct labeled delta-year scales and compares two diagrams",()=>{
 const h=readFileSync(new URL("../prototypes/research-r18-closure-journey.html",import.meta.url),"utf8");
 const script=readFileSync(new URL("../prototypes/research-r18-closure-journey.js",import.meta.url),"utf8");
 assert.match(h,/方案 A · 全貌＋局部放大/);
 assert.match(h,/方案 B · 條件交會/);
 assert.match(h,/0–24,000 年/);
 assert.match(h,/data-r18-local-range/);
 assert.match(h,/LCM\(1,200, 8,000\) = 24,000/);
 assert.match(h,/146,097 mod 60 = 57/);
 assert.match(h,/經過年數 Δ/);
 assert.match(script,/buildClosureJourney\(base\)/);
 assert.doesNotMatch(script,/firstLocal\s*\?\?\s*1980/);
 assert.match(script,/r18-derivation/);
 assert.match(script,/r18DetailStart/);
 assert.match(script,/data-r18-event/);
 assert.match(script,/point\.kind/);
 assert.match(script,/data-r18-first-closure/);
 assert.match(script,/dash:"2 6"/);
});

test("R18 variable first-local events use complete 24,000-year evidence instead of the first 2,400 years",()=>{
 const cases=[
  [{year:2026,month:9,day:13},1980,0],
  [{year:1900,month:1,day:1},1980,0],
  [{year:1900,month:3,day:1},6180,4620],
  [{year:2100,month:3,day:1},16080,14520]
 ];
 for(const [date,first,windowStart] of cases){
  const j=buildClosureJourney(date);
  assert.equal(j.firstLocal,first,"wrong first local at "+JSON.stringify(date));
  assert.equal(j.detailStart,windowStart,"wrong inset starting year");
  assert.equal(j.detailEnd,j.detailStart+2400);
  assert.ok(j.detail.yearDay.includes(first),"first local hidden in inset");
  assert.equal(j.detail.yearDay[0],first,"first local not first closure in the inset");
  assert.equal(j.firstGlobal,24000);
  assert.equal(j.overview.all[0],24000);
  assert.equal(j.markers.some(m=>m.delta===first),true,"date-dependent marker not set");
  assert.equal(j.detail.year.some(d=>d<j.detailStart),false);
  assert.equal(j.detail.day.some(d=>d>j.detailEnd),false);
  const state=recurrenceState(date,first);
  assert.equal(state.closed.day,true);
  assert.equal(state.closed.yearSequence,true);
  assert.equal(classifyJourneyPoint(j,first).kind,"local");
 }
});
test("R18 movable detail inset respects explicit width and invalid dates",()=>{
 const a=buildClosureJourney({year:1900,month:3,day:1},{detailYears:3600});
 assert.equal(a.detailEnd-a.detailStart,3600);
 assert.ok(a.detailStart<=a.firstLocal&&a.firstLocal<=a.detailEnd);
 assert.throws(()=>buildClosureJourney({year:1900,month:2,day:29}),RangeError);
 assert.throws(()=>buildClosureJourney({year:9990000,month:3,day:1}),RangeError);
 assert.throws(()=>buildClosureJourney({year:2026,month:9,day:13},{detailYears:100}),RangeError);
});
