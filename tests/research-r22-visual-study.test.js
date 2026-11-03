import test from "node:test";
import assert from "node:assert/strict";
import {recurrenceState} from "../src/recurrence/gregorian-cycle.js";
import {r22StudyMode,r22StudyReading,r22StudyGapArc,R22_STUDY_KEYS} from "../src/recurrence/r22-visual-study.js";

const base={year:2026,month:9,day:13};
const names=["gregorian","year","day"];
test("P8 experiments are explicit opt-in and use same canonical three layers",()=>{
 assert.equal(r22StudyMode("gap"),"gap");
 assert.equal(r22StudyMode("closure"),"closure");
 assert.equal(r22StudyMode(""),"");
 assert.equal(r22StudyMode("rainbow"),"");
 assert.deepEqual(R22_STUDY_KEYS,names);
 const s=r22StudyReading(recurrenceState(base,1200));
 assert.equal(s.closedCount,2);
 assert.deepEqual(names.map(k=>s.layers[k].closed),[true,true,false]);
 assert.equal(s.layers.day.angle,-117);
 assert.equal(s.layers.day.radius,315);
 assert.equal(r22StudyGapArc(s.layers.gregorian),null);
 assert.equal(r22StudyGapArc(s.layers.year),null);
 const d=r22StudyGapArc(s.layers.day);
 assert.match(d,/^M .* A 315 207\.9 0 0 1 /);
});
test("P8 gap is from the shared -90° datum, never simulated elapsed revolutions",()=>{
 const s=r22StudyReading(recurrenceState(base,400));
 assert.equal(s.closedCount,1);
 assert.equal(s.layers.gregorian.angle,-90);
 assert.equal(s.layers.year.angle,-150);
 assert.equal(s.layers.day.angle,-99);
 assert.equal(r22StudyGapArc(s.layers.gregorian),null);
 assert.ok(r22StudyGapArc(s.layers.year).length>30);
 assert.ok(r22StudyGapArc(s.layers.day).length>30);
 assert.equal(s.layers.year.available,true);
});
test("P8 closure never calls initial baseline a positive recurrence",()=>{
 const init=r22StudyReading(recurrenceState(base,0));
 assert.equal(init.closedCount,3);
 assert.equal(init.identity,true);
 const closure=r22StudyReading(recurrenceState(base,24000));
 assert.equal(closure.closedCount,3);
 assert.equal(closure.identity,false);
 const local=r22StudyReading(recurrenceState(base,1980));
 assert.equal(local.closedCount,2);
 assert.deepEqual(names.map(k=>local.layers[k].closed),[false,true,true]);
});
test("P8 leap-day invalid target cannot masquerade as day closure",()=>{
 const s=r22StudyReading(recurrenceState({year:2024,month:2,day:29},1));
 assert.equal(s.layers.day.available,false);
 assert.equal(s.layers.day.closed,false);
 assert.equal(s.layers.day.angle,null);
 assert.equal(r22StudyGapArc(s.layers.day),null);
 assert.equal(s.closedCount,0);
});
