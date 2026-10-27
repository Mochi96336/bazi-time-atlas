import test from "node:test";
import assert from "node:assert/strict";
import {recurrenceState,gregorianOrdinal} from "../src/recurrence/gregorian-cycle.js";
import {phaseAngleOnFan,signedShortestPhase} from "../src/recurrence/phase-fan-geometry.js";
import {R22_CYCLE_FACTS,r22PhaseSnapshot,r22PhaseTransition,r22TeachingStops} from "../src/recurrence/r22-phase-motion-model.js";

const base={year:2026,month:9,day:13};
const expected=[
 [0,0,0,0,false],
 [400,0,-20,-3,false],
 [1200,0,0,-9,false],
 [1980,-20,0,0,false],
 [8000,0,20,0,false],
 [24000,0,0,0,true]
];
for(const [delta,g,y,d,common] of expected){
 test("R22 exact phase gaps and partial/common closure at +"+delta,()=>{
  const snapshot=r22PhaseSnapshot(base,delta);
  const canonical=recurrenceState(base,delta);
  assert.deepEqual(
   ["gregorian","yearSequence","day"].map(key=>snapshot.layers[key].signed),
   [g,y,d]);
  assert.equal(snapshot.commonClosed,common);
  assert.equal(snapshot.elapsedDays,canonical.dayDelta);
  for(const [key,layer] of Object.entries(snapshot.layers)){
   assert.equal(layer.residue,canonical.phases[key]);
   assert.equal(layer.closed,canonical.closed[key]);
   assert.equal(layer.fanAngle,phaseAngleOnFan({phase:layer.residue,modulus:layer.period}));
   assert.equal(layer.signed,signedShortestPhase(layer.residue,layer.period));
   assert.equal(layer.available,true);
  }
  assert.deepEqual(snapshot.closedKeys,
   Object.entries(canonical.closed).filter(([,closed])=>closed).map(([key])=>key)
     .sort((a,b)=>["gregorian","yearSequence","day"].indexOf(a)-["gregorian","yearSequence","day"].indexOf(b)));
  assert.equal(snapshot.layers.day.totalTurns,canonical.dayDelta/60);
  assert.equal(Object.isFrozen(snapshot.layers.day),true);
  assert.equal(snapshot.zeroDatumAngle,-90);
  assert.equal(snapshot.displaySemantics,"folded-shortest-signed-residue-not-rotation");
 });
}

test("R22 nominal and day turn counts are mathematically different even when all residues close",()=>{
 const state=r22PhaseSnapshot(base,24000);
 assert.equal(state.layers.gregorian.completedTurns,60);
 assert.equal(state.layers.yearSequence.completedTurns,400);
 assert.equal(state.layers.day.completedTurns,146097);
 assert.equal(state.elapsedDays,R22_CYCLE_FACTS.gregorian400YearDays*60);
 assert.equal(state.layers.gregorian.fanAngle,-90);
 assert.equal(state.layers.yearSequence.fanAngle,-90);
 assert.equal(state.layers.day.fanAngle,-90);
});

test("R22 cannot infer true high-speed day rotation from integer-year gauge endpoints",()=>{
 const transition=r22PhaseTransition(base,0,1);
 const yearOne=r22PhaseSnapshot(base,1);
 assert.equal(yearOne.elapsedDays,365);
 assert.equal(yearOne.layers.day.residue,5);
 assert.equal(yearOne.layers.day.signed,5);
 assert.equal(transition.layers.day.completeCycleBoundaries,6);
 assert.equal(transition.layers.day.accumulatedTurns,365/60);
 assert.equal(transition.layers.day.aliasesFullTurns,true);
 assert.equal(transition.layers.day.motionInterpolationSafe,false);
 assert.equal(transition.layers.gregorian.aliasesFullTurns,false);
 assert.equal(transition.interpolation,"sample-and-snap; no fabricated continuous phase motion");
 assert.throws(()=>r22PhaseTransition(base,2,1),RangeError);
 assert.throws(()=>r22PhaseTransition(base,0,0.5),RangeError);
});

test("R22 explicitly detects the folded shortest-phase wrap instead of tweening through its entire semicircle",()=>{
 const before=r22PhaseSnapshot(base,30).layers.yearSequence;
 const after=r22PhaseSnapshot(base,31).layers.yearSequence;
 assert.equal(before.signed,30);
 assert.equal(after.signed,-29);
 assert.equal(before.fanAngle,-10);
 assert.ok(after.fanAngle < -160);
 assert.equal(r22PhaseTransition(base,30,31).layers.yearSequence.motionInterpolationSafe,false);
});

test("R22 guide stops are real, unique, base-dependent exact years",()=>{
 const cases=[
  [{year:2026,month:9,day:13},1980,[0,400,1200,1980,8000,24000]],
  [{year:1900,month:3,day:1},6180,[0,400,1200,6180,8000,24000]],
  [{year:2100,month:3,day:1},16080,[0,400,1200,8000,16080,24000]]
 ];
 for(const [b,first,years] of cases){
  const stops=r22TeachingStops(b);
  assert.deepEqual(stops.map(s=>s.year),years);
  assert.equal(stops.find(s=>s.year===first).role,"base-dependent-year-day");
  assert.equal(stops[0].role,"identity");
  assert.equal(stops[0].isPositiveCommonClosure,false);
  assert.equal(stops.at(-1).isPositiveCommonClosure,true);
  for(const step of stops){
   const snapshot=r22PhaseSnapshot(b,step.year);
   assert.deepEqual(step.closedKeys,snapshot.closedKeys);
   assert.equal(step.closedCount,snapshot.closedCount);
   assert.equal(step.signedGaps.day,snapshot.layers.day.signed);
  }
 }
 const capped=r22TeachingStops(base,1200);
 assert.deepEqual(capped.map(s=>s.year),[0,400,1200]);
 assert.equal(Object.isFrozen(capped),true);
 assert.throws(()=>r22TeachingStops(base,-1),RangeError);
});

test("R22 leap-day missing target is unavailable, never silently counted as day closure",()=>{
 const leap={year:2024,month:2,day:29};
 const invalid=r22PhaseSnapshot(leap,1);
 assert.equal(invalid.targetValid,false);
 assert.equal(invalid.elapsedDays,null);
 assert.equal(invalid.layers.day.available,false);
 assert.equal(invalid.layers.day.signed,null);
 assert.equal(invalid.layers.day.closed,false);
 assert.equal(invalid.layers.day.completedTurns,null);
 const valid=r22PhaseSnapshot(leap,4);
 assert.equal(valid.targetValid,true);
 assert.equal(valid.elapsedDays,gregorianOrdinal({year:2028,month:2,day:29})-gregorianOrdinal(leap));
 assert.equal(valid.layers.day.available,true);
});

test("R22 data model is purely read-only and has no second time owner",()=>{
 const x=r22PhaseSnapshot(base,1980);
 assert.ok(Object.isFrozen(x));
 assert.ok(Object.isFrozen(x.layers));
 assert.ok(Object.isFrozen(x.closedKeys));
 assert.ok(Object.isFrozen(x.targetDate));
 assert.throws(()=>r22PhaseSnapshot(base,-1),RangeError);
 assert.throws(()=>r22PhaseSnapshot(base,0.5),RangeError);
 assert.throws(()=>r22PhaseSnapshot({year:2026,month:2,day:30},0),RangeError);
 const transition=r22PhaseTransition(base,1980,8000);
 assert.ok(Object.isFrozen(transition));
 assert.ok(Object.isFrozen(transition.layers.day));
});
