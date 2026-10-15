import test from "node:test";
import assert from "node:assert/strict";
import {
  ABSOLUTE_BOUNDARY_CONSEQUENCE_24000 as consequence
} from "../src/research/seasonal-absolute-boundary-consequence.js";

function close(actual,expected,tolerance,label){
  assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected}, got ${actual}`);
}

test("absolute +24k consequence maps all 12 BaZi Jie boundaries",()=>{
  assert.equal(consequence.baseYear,2026);
  assert.equal(consequence.targetYear,26026);
  assert.equal(consequence.deltaYears,24000);
  assert.equal(consequence.referenceCycle.days,365.2425);
  assert.equal(consequence.referenceCycle.isActualNextLiChunInterval,false);
  assert.match(consequence.referenceCycle.definition,/Gregorian mean-year phase/);
  assert.equal(consequence.boundaries.length,12);
  assert.equal(consequence.allTargetEarlier,true);
  assert.equal(consequence.boundaries.filter(item=>item.isYearBoundary).length,1);
  assert.equal(consequence.liChunBoundary.name,"立春");
  assert.equal(consequence.liChunBoundary.monthTransition,"丑→寅");
});

test("absolute boundary windows reproduce the research timeline magnitudes",()=>{
  close(consequence.liChunBoundary.widthDays,10.883188,1e-9,"Li Chun");
  close(consequence.minBoundaryDays,10.234653,1e-9,"minimum Jie shift");
  close(consequence.maxBoundaryDays,14.177475,1e-9,"maximum Jie shift");
  assert.equal(consequence.largestBoundary.name,"寒露");
  close(consequence.rawWindowDays,146.481409,1e-9,"raw 12-window sum");
  close(consequence.unionWindowDays,146.481409,1e-6,"circular union");
  close(consequence.unionWindowPercent,40.1052476096,1e-6,"year phase percent");
  close(consequence.overlapDays,0,1e-9,"window overlap");
});

test("absolute boundary consequence remains research-only and does not resolve Day or Hour",()=>{
  assert.equal(consequence.claimBoundary.researchOnly,true);
  assert.equal(consequence.claimBoundary.populationProbability,false);
  assert.equal(consequence.claimBoundary.civilTimePillarVerdict,false);
  assert.equal(consequence.claimBoundary.civilTimeResolved,false);
  assert.equal(consequence.claimBoundary.dayPillarResolved,false);
  assert.equal(consequence.claimBoundary.hourPillarResolved,false);
  assert.equal(consequence.claimBoundary.productionAuthorityGranted,false);
});
