import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLOSURE_BASE_DATE,CLOSURE_STEP_YEARS,CLOSURE_STEPS,CLOSURE_RINGS,
  CLOSURE_MILESTONES,closureStateForStep,closureRuns,closureCells
} from "../src/recurrence/closure-spine-model.js";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { phaseAngleOnFan } from "../src/recurrence/phase-fan-geometry.js";

test("R16 semicircle preserves 160 sectors and touching annuli",()=>{
  assert.deepEqual(CLOSURE_RINGS.map(r=>r.sectors),[60,60,40]);
  assert.deepEqual(CLOSURE_RINGS.map(r=>[r.inner,r.outer]),[[270,360],[360,450],[450,560]]);
  const sectors=closureCells();
  assert.equal(sectors.length,160);
  assert.deepEqual(Object.fromEntries(CLOSURE_RINGS.map(r=>[
    r.key,sectors.filter(cell=>cell.ring===r.key).length
  ])),{day:60,year:60,gregorian:40});
});

test("four canonical states use the original recurrenceState, not hand-coded phases",()=>{
  const pairs=[
    {step:1,signed:{gregorian:0,year:-20,day:-3},closed:["gregorian"],runs:[["gregorian"]]},
    {step:3,signed:{gregorian:0,year:0,day:-9},closed:["year","gregorian"],runs:[["year","gregorian"]]},
    {step:20,signed:{gregorian:0,year:20,day:0},closed:["day","gregorian"],runs:[["day"],["gregorian"]]},
    {step:60,signed:{gregorian:0,year:0,day:0},closed:["day","year","gregorian"],runs:[["day","year","gregorian"]]}
  ];
  for(const p of pairs){
    const actual=closureStateForStep(p.step);
    const origin=recurrenceState(CLOSURE_BASE_DATE,p.step*CLOSURE_STEP_YEARS);
    assert.equal(actual.deltaYears,p.step*400);
    assert.equal(actual.dayDelta,origin.dayDelta);
    assert.deepEqual(Object.fromEntries(actual.rings.map(r=>[r.key,r.signed])),p.signed);
    assert.deepEqual(actual.closedKeys,p.closed);
    assert.deepEqual(closureRuns(actual).map(run=>run.keys),p.runs);
    for(const ring of actual.rings){
      assert.equal(ring.phase,origin.phases[ring.key==="year"?"yearSequence":ring.key]);
      assert.equal(ring.angle,phaseAngleOnFan({phase:ring.phase,modulus:ring.modulus}));
    }
  }
});

test("400-year blocks form exactly the 3-by-20 step lattice",()=>{
  const joint=[];
  for(let k=0;k<=CLOSURE_STEPS;k++){
    const s=closureStateForStep(k);
    assert.equal(s.rings[2].closed,true, `Gregorian at k=${k}`);
    assert.equal(s.rings[1].closed,k%3===0,`year at k=${k}`);
    assert.equal(s.rings[0].closed,k%20===0,`day at k=${k}`);
    assert.equal(s.allClosed,k%60===0);
    if(s.allClosed)joint.push(k);
    for(const run of closureRuns(s)){
      assert.ok(run.outer>run.inner);
      for(let j=1;j<run.keys.length;j++){
        const a=s.rings.find(r=>r.key===run.keys[j-1]);
        const b=s.rings.find(r=>r.key===run.keys[j]);
        assert.equal(a.outer,b.inner,"spine cannot bridge a nonzero ring");
      }
    }
  }
  assert.deepEqual(joint,[0,60]);
  assert.deepEqual(CLOSURE_MILESTONES.map(m=>m.deltaYears),[0,400,1200,8000,24000]);
  assert.throws(()=>closureStateForStep(-1),RangeError);
  assert.throws(()=>closureStateForStep(61),RangeError);
  assert.throws(()=>closureStateForStep(1.5),RangeError);
});

test("experiment is isolated from official recurrence UI",()=>{
  const html=readFileSync(new URL("../prototypes/research-r16-closure-spine.html",import.meta.url),"utf8");
  const view=readFileSync(new URL("../src/recurrence/closure-spine-view.js",import.meta.url),"utf8");
  assert.match(html,/id="closure-fan"/);
  assert.match(html,/id="step-slider"/);
  assert.match(html,/id="original-link"/);
  assert.match(view,/closureRuns\(snapshot\)/);
  assert.match(view,/closureCells\(\)/);
  assert.match(view,/setInterval/);
  assert.doesNotMatch(view,/linear-gradient|radial-gradient/);
  assert.doesNotMatch(html,/tracker|telemetry|r16-polish=1|r22=1/);
});
