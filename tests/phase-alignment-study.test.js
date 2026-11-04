import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 READING_STUDY_BASE,READING_STUDY_DELTAS,READING_STUDY_OPTIONS,
 alignmentReadingState,evaluateAlignmentReading,shuffledStudyDeltas
} from "../src/recurrence/phase-alignment-study.js";

test("four alignment cards are computed by the ORIGINAL recurrence model",()=>{
 assert.deepEqual(READING_STUDY_BASE,{year:2026,month:9,day:13});
 assert.deepEqual(READING_STUDY_DELTAS,[400,1200,8000,24000]);
 const cases=READING_STUDY_DELTAS.map(alignmentReadingState);
 assert.deepEqual(cases.map(c=>c.answer),["gregorian","gregorian-year","gregorian-day","all"]);
 assert.deepEqual(cases.map(c=>c.signed),[
  {gregorian:0,year:-20,day:-3},
  {gregorian:0,year:0,day:-9},
  {gregorian:0,year:20,day:0},
  {gregorian:0,year:0,day:0}
 ]);
 assert.deepEqual(cases.map(c=>c.closed),[
  {gregorian:true,year:false,day:false},
  {gregorian:true,year:true,day:false},
  {gregorian:true,year:false,day:true},
  {gregorian:true,year:true,day:true}
 ]);
 assert.throws(()=>alignmentReadingState(0),RangeError);
});
test("scoring is local, no answer disclosure is required before final results",()=>{
 const answers=READING_STUDY_DELTAS.map(deltaYears=>({
  deltaYears,choice:alignmentReadingState(deltaYears).answer,confidence:"high",elapsedMs:1124
 }));
 assert.ok(evaluateAlignmentReading(answers).every(x=>x.correct));
 const withUnknown=answers.map(x=>({...x,choice:"unsure"}));
 assert.equal(evaluateAlignmentReading(withUnknown).filter(x=>x.correct).length,0);
 assert.throws(()=>evaluateAlignmentReading([...answers,answers[0]]),/duplicate/);
 assert.equal(new Set(READING_STUDY_OPTIONS.map(x=>x.id)).size,5);
});
test("randomized presentations contain exactly the same four cases",()=>{
 const shuffled=shuffledStudyDeltas(()=>0);
 assert.deepEqual([...shuffled].sort((a,b)=>a-b),READING_STUDY_DELTAS);
 assert.throws(()=>shuffledStudyDeltas(()=>1),RangeError);
});
test("isolated reading test uses the production R16 iframe and does not leak answers",()=>{
 const html=readFileSync(new URL("../phase-alignment-reading-study.html",import.meta.url),"utf8");
 const view=readFileSync(new URL("../src/phase-alignment-reading-view.js",import.meta.url),"utf8");
 assert.match(view,/new URL\("\.\/recurrence\.html",location\.href\)/);
 assert.match(view,/searchParams\.set\("date","2026-09-13"\)/);
 assert.match(view,/recurrence:select-delta/);
 assert.match(view,/data-phase-cell/);
 assert.match(view,/dataset\.phaseSigned/);
 assert.match(view,/evaluateAlignmentReading/);
 assert.match(view,/URL\.createObjectURL/);
 assert.doesNotMatch(html,/<script[^>]+src=".*tracker/i);
 assert.doesNotMatch(html,/google-analytics|gtag|telemetry/);
 assert.doesNotMatch(html,/r16-polish=1|r22=1/);
 assert.match(html,/id="study-trial"/);
 assert.match(html,/id="study-result"/);
});
