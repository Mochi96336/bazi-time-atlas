import test from "node:test";
import assert from "node:assert/strict";
import {recurrenceState} from "../src/recurrence/gregorian-cycle.js";
import {r22StudyReading,r22StudyMode,r22MissingStudyCallout} from "../src/recurrence/r22-visual-study.js";
const base={year:2026,month:9,day:13};
const callouts=delta=>{
 const state=recurrenceState(base,delta),reading=r22StudyReading(state);
 return Object.fromEntries(["gregorian","year","day"].map(key=>[
  key,r22MissingStudyCallout(key,reading.layers[key],state.phases[key==="year"?"yearSequence":key],reading.closedCount,delta)
 ]));
};
test("P9 is strictly opt-in; default/P8 modes remain distinct",()=>{
 assert.equal(r22StudyMode("missing"),"missing");
 assert.equal(r22StudyMode("gap"),"gap");
 assert.equal(r22StudyMode("closure"),"closure");
 assert.equal(r22StudyMode(""),"");
 assert.equal(r22StudyMode("progress"),"");
});
test("P9 identifies only real missing condition and exact signed days at +1200",()=>{
 const c=callouts(1200);
 assert.equal(c.gregorian,null);
 assert.equal(c.year,null);
 assert.equal(c.day.text,"日序 −9日");
 assert.equal(c.day.signed,-9);
 assert.equal(c.day.angle,-117);
 assert.ok(c.day.labelX>150&&c.day.labelX<905);
 assert.ok(c.day.labelY<=802);
 assert.equal(c.day.anchor,"start");
 assert.ok(Math.abs(c.day.point.x-457)<1);
});
test("P9 does not hide second unclosed condition at +400",()=>{
 const c=callouts(400);
 assert.equal(c.gregorian,null);
 assert.equal(c.year.text,"年序 −20年");
 assert.equal(c.day.text,"日序 −3日");
 assert.equal(c.year.signed,-20);
 assert.equal(c.day.signed,-3);
 assert.ok(c.year.labelY-c.day.labelY>30,"two labels need staggered vertical space");
});
test("P9 names the missing rail for both +1980 and +8000 with correct signs",()=>{
 const a=callouts(1980),b=callouts(8000);
 assert.equal(a.gregorian.text,"公曆 −20年");
 assert.equal(a.year,null);assert.equal(a.day,null);
 assert.equal(b.gregorian,null);assert.equal(b.day,null);
 assert.equal(b.year.text,"年序 +20年");
 assert.equal(b.year.anchor,"end");
});
test("P9 baseline and full common closure do not generate misleading open labels",()=>{
 for(const delta of [0,24000]){
  const labels=callouts(delta);
  assert.ok(Object.values(labels).every(label=>label===null));
 }
 const open=callouts(1);
 assert.ok(Object.values(open).every(label=>label===null),
  "no partial closure => no invented special teaching annotation");
});
test("P9 missing leap day is not falsely marked as a numeric mismatch",()=>{
 const state=recurrenceState({year:2024,month:2,day:29},1);
 const r=r22StudyReading(state);
 assert.equal(r.layers.day.available,false);
 assert.equal(r22MissingStudyCallout("day",r.layers.day,null,r.closedCount,1),null);
 assert.throws(()=>r22MissingStudyCallout("a",r.layers.day,1,1,2),RangeError);
});
