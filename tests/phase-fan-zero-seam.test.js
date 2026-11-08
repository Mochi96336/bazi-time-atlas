import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { zeroPhaseRadialRuns } from "../src/recurrence/phase-fan-zero-seam.js";

const bands=[
  {key:"day",inner:270,outer:360},
  {key:"year",inner:360,outer:450},
  {key:"gregorian",inner:450,outer:560}
];
const phases=state=>({
  day:state.phases.day,
  year:state.phases.yearSequence,
  gregorian:state.phases.gregorian
});
const keys=runs=>runs.map(run=>run.keys);

test("zero seam follows 400-year cases and never bridges a nonzero annulus",()=>{
  const baseline={year:2026,month:9,day:13};
  const cases=[
    [0,[["day","year","gregorian"]]],
    [400,[["gregorian"]]],
    [1200,[["year","gregorian"]]],
    [8000,[["day"],["gregorian"]]],
    [24000,[["day","year","gregorian"]]]
  ];
  for(const [delta,expected] of cases){
    const state=recurrenceState(baseline,delta);
    const runs=zeroPhaseRadialRuns(bands,phases(state));
    assert.deepEqual(keys(runs),expected,"Δ="+delta);
    for(const run of runs){
      assert.ok(run.outer>run.inner);
      assert.equal(run.inner,bands.find(b=>b.key===run.keys[0]).inner);
      assert.equal(run.outer,bands.find(b=>b.key===run.keys.at(-1)).outer);
    }
  }
});

test("runs work for arbitrary base dates and all 61 of the exact 400-year steps",()=>{
  for(const base of [
    {year:2026,month:9,day:13},
    {year:2024,month:2,day:29},
    {year:2031,month:12,day:31}
  ]){
    for(let k=0;k<=60;k++){
      const state=recurrenceState(base,k*400);
      const runs=zeroPhaseRadialRuns(bands,phases(state));
      assert.equal(runs.some(run=>run.keys.includes("gregorian")),true);
      assert.equal(runs.some(run=>run.keys.includes("year")),k%3===0);
      assert.equal(runs.some(run=>run.keys.includes("day")),k%20===0);
      assert.equal(runs.length, k===0||k===60?1:k%20===0&&k%3!==0?2:1);
      for(const run of runs){
        for(let i=1;i<run.keys.length;i++){
          const before=bands.find(b=>b.key===run.keys[i-1]);
          const after=bands.find(b=>b.key===run.keys[i]);
          assert.equal(before.outer,after.inner);
        }
      }
    }
  }
});

test("nonzero or missing phases are not connected or replaced by a false guide",()=>{
  assert.deepEqual(keys(zeroPhaseRadialRuns(bands,{day:1,year:2,gregorian:3})),[]);
  assert.deepEqual(keys(zeroPhaseRadialRuns(bands,{day:0,year:null,gregorian:0})),[
    ["day"],["gregorian"]
  ]);
  assert.deepEqual(keys(zeroPhaseRadialRuns(bands,{day:0,year:0,gregorian:null})),[
    ["day","year"]
  ]);
  assert.deepEqual(keys(zeroPhaseRadialRuns(bands,{day:null,year:null,gregorian:0})),[
    ["gregorian"]
  ]);
  assert.throws(()=>zeroPhaseRadialRuns([{key:"bad",inner:400,outer:200}],{bad:0}),RangeError);
});

test("native seam defaults on in the Draft, and legacy R16 remains a reversible fallback",()=>{
  const view=readFileSync(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
  const css=readFileSync(new URL("../recurrence.css",import.meta.url),"utf8");
  assert.match(view,/get\("r16-seam"\)!=="0"/,
    "the legacy solid datum remains an explicit opt-out");
  assert.match(view,/ZERO_SEAM_ENABLED \? \[\[258,270\],\[560,575\]\] : \[\[258,575\]\]/);
  assert.match(view,/if\(ZERO_SEAM_ENABLED\)/);
  assert.match(view,/class:"cursor-reference-guide", "aria-hidden":"true"/,
    "nonzero phases still need a weak zero-direction reference");
  assert.match(css,/\.cursor-reference-guide \{[^}]*stroke-dasharray:3 11;/,
    "reference must be dashed, distinct from solid zero seam");
  assert.match(css,/\.cursor-reference-guide \{[^}]*stroke-opacity:\.26;/,
    "reference must stay below live phase-marker contrast");
  assert.match(view,/zeroPhaseRadialRuns\(bands,phases\)/);
  assert.match(view,/"data-closure-seam":run.keys.join\(","\)/);
  assert.match(view,/instrument.dataset.zeroSeamMode = ZERO_SEAM_ENABLED \? "native" : "legacy"/);
  assert.match(css,/\.return-closure-seam \{ stroke:var\(--cursor\); stroke-width:6\.5;/,
    "seam must use exactly the original closed-marker stroke weight");
  assert.doesNotMatch(css,/\.return-closure-seam \{[^}]*vector-effect:non-scaling-stroke/,
    "fixed-pixel seam thickness becomes too heavy on mobile");
  assert.doesNotMatch(view,/closure-spine-model/);
});
