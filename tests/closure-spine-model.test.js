import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLOSURE_BASE_DATE,CLOSURE_STEP_YEARS,CLOSURE_STEPS,CLOSURE_RINGS,
  CLOSURE_MILESTONES,closureStateForStep,closureRuns,closureCells,closurePlaybackDwellMs,closureCycleCells,CLOSURE_STEP_PERIODS
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
  assert.match(view,/schedulePlaybackStep/);
  assert.doesNotMatch(view,/linear-gradient|radial-gradient/);
  assert.doesNotMatch(html,/tracker|telemetry|r16-polish=1|r22=1/);
});

test("closure-aware playback preserves exact events instead of 360ms flashes",()=>{
  const ordinary=closurePlaybackDwellMs(closureStateForStep(1));
  const year=closurePlaybackDwellMs(closureStateForStep(3));
  const day=closurePlaybackDwellMs(closureStateForStep(20));
  const full=closurePlaybackDwellMs(closureStateForStep(60));
  assert.ok(ordinary > 100 && ordinary < 250);
  assert.ok(year >= ordinary * 3,"every third step must visibly linger");
  assert.ok(day > year,"rarer day closure must visibly linger longer");
  assert.ok(full > day,"joint closure should be the longest event");
  let joint=0,yearOnly=0,dayOnly=0,ordinaryCount=0;
  for(let k=1;k<=CLOSURE_STEPS;k++){
    const state=closureStateForStep(k);
    const delay=closurePlaybackDwellMs(state);
    if(state.allClosed){joint++;assert.equal(delay,full);}
    else if(state.closedKeys.includes("day")){dayOnly++;assert.equal(delay,day);}
    else if(state.closedKeys.includes("year")){yearOnly++;assert.equal(delay,year);}
    else {ordinaryCount++;assert.equal(delay,ordinary);}
  }
  assert.deepEqual({joint,yearOnly,dayOnly,ordinaryCount},
    {joint:1,yearOnly:19,dayOnly:2,ordinaryCount:38});
  const view=readFileSync(new URL("../src/recurrence/closure-spine-view.js",import.meta.url),"utf8");
  assert.match(view,/schedulePlaybackStep/);
  assert.match(view,/closurePlaybackDwellMs\(closureStateForStep\(step\)\)/);
  assert.match(view,/setTimeout/);
  assert.doesNotMatch(view,/setInterval\(/);
});

test("the full 160-degree fan endpoints fit inside the experimental viewBox",()=>{
  const html=readFileSync(new URL("../prototypes/research-r16-closure-spine.html",import.meta.url),"utf8");
  const match=html.match(/id="closure-fan" viewBox="([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+)"/);
  assert.ok(match,"fan must own a known viewBox");
  const [x,y,width,height]=match.slice(1).map(Number);
  for(const ring of CLOSURE_RINGS){
    for(const radius of [ring.inner,ring.outer]){
      for(const deg of [-170,-10]){
        const px=600+radius*Math.cos(deg*Math.PI/180);
        const py=820+radius*Math.sin(deg*Math.PI/180);
        assert.ok(px>x&&px<x+width,`x clipping at ${ring.key} / ${deg}`);
        assert.ok(py>y&&py<y+height,`y clipping at ${ring.key} / ${deg}`);
      }
    }
  }
});

test("existing cells restart at every exact 3-step and 20-step zero",()=>{
  for(let k=0;k<=CLOSURE_STEPS;k++){
    const trace=closureCycleCells(k);
    const expected={gregorian:1,year:k%3+1,day:k%20+1};
    for(const ring of CLOSURE_RINGS){
      const indices=trace[ring.key];
      assert.equal(indices.length,expected[ring.key],ring.key+" visits at k="+k);
      assert.equal(new Set(indices).size,indices.length);
      for(const index of indices){
        assert.ok(Number.isInteger(index)&&index>=0&&index<ring.sectors);
      }
      const current=closureStateForStep(k).rings.find(r=>r.key===ring.key);
      const scaled=(current.angle+170)/160*ring.sectors;
      const currentIndex=Math.max(0,Math.min(ring.sectors-1,Math.floor(scaled+1e-8)));
      assert.ok(indices.includes(currentIndex),"current landing must be in history");
    }
  }
  assert.deepEqual(CLOSURE_STEP_PERIODS,{gregorian:1,year:3,day:20});
  assert.deepEqual(closureCycleCells(2).year,[10,30,50],
    "year ring visits three unique angles before clearing at k=3");
  assert.deepEqual(closureCycleCells(3).year,[30],
    "year ring must clear its previous lap at k=3");
  assert.equal(closureCycleCells(19).day.length,20,
    "day ring visits twenty unique angles before clearing at k=20");
  assert.deepEqual(closureCycleCells(20).day,[30],
    "day ring clears its previous lap at k=20");
  assert.deepEqual(closureCycleCells(20).year,[10,30,50],
    "year ring does NOT reset when only day ring returns");
  assert.deepEqual(closureCycleCells(59).day.length,20);
  assert.deepEqual(closureCycleCells(59).year.length,3);
  assert.deepEqual(closureCycleCells(60),{day:[30],year:[30],gregorian:[20]},
    "all three lap histories restart together at 24,000 years");
  assert.throws(()=>closureCycleCells(-1),RangeError);
  assert.throws(()=>closureCycleCells(61),RangeError);
});

test("motion design echoes exact snapshots but never interpolates cyclic phases",()=>{
  const view=readFileSync(new URL("../src/recurrence/closure-spine-view.js",import.meta.url),"utf8");
  assert.match(view,/const ECHO_MS=128/);
  assert.match(view,/data-snapshot-layer="echo"/);
  assert.match(view,/data-snapshot-layer="active"/);
  assert.match(view,/data-exact-step/);
  assert.match(view,/prefers-reduced-motion: reduce/);
  assert.match(view,/old\.animate\(\[\{opacity/);
  assert.match(view,/current\.animate\(\[\{opacity/);
  assert.doesNotMatch(view,/transform.*rotate|rotation:|\binterpolat(?:e|ion)\(/,
    "phase must never be swept through invented half-fan positions");
  for(const k of [0,1,2,3,19,20,59,60]) {
    const snapshot=closureStateForStep(k);
    for(const ring of snapshot.rings) {
      assert.equal(ring.angle,phaseAngleOnFan({
        phase:ring.phase,modulus:ring.modulus
      }),"motion must preserve the exact R16 fan position");
    }
  }
});
