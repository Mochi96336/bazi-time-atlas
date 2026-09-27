import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { gregorianOrdinal } from "../src/recurrence/gregorian-cycle.js";
import { sexagenaryDayForGregorianDate } from "../src/recurrence/ganzhi-cycle-comparison.js";
import { researchYearStripState } from "../src/research-year-strip-view.js";
import { researchOneYearStory } from "../src/recurrence/research-one-year-story.js";
import { activeYearIdentityForDate } from "../src/recurrence/research-date-pair.js";

const html = readFileSync(new URL("../docs/prototypes/research01-coupled-year-day-motion.html",import.meta.url),"utf8");
const date = (year,month,day)=>({year,month,day});

test("isolated motion prototype has one range playhead and reuses canonical evidence",()=>{
  for (const id of ["scrub","yeartrack","dayname","yearname","dial","zoom","yearstep"]) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/researchYearStripState\(d\)/);
  assert.match(html,/sexagenaryDayForGregorianDate\(d\)/);
  assert.match(html,/researchOneYearStory\(d,evidence\)/);
  assert.match(html,/RESEARCH_SEASONAL_EVIDENCE_READY_EVENT/);
  assert.match(html,/cache\.clear\(\);render\(\)/);
  assert.doesNotMatch(html,/autoplay/i);
  const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match,"requires exactly one module script");
  const check=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:match[1],encoding:"utf8"
  });
  assert.equal(check.status,0,check.stderr);
});

test("same canonical day identity walks 365/366 civil days by 5/6 modulo 60",()=>{
  for (const [start,next,expected] of [
    [date(2023,1,1),date(2024,1,1),5],
    [date(2024,1,1),date(2025,1,1),6]
  ]) {
    const elapsed=gregorianOrdinal(next)-gregorianOrdinal(start);
    assert.equal(elapsed%60,expected);
    const a=sexagenaryDayForGregorianDate(start);
    const b=sexagenaryDayForGregorianDate(next);
    assert.equal(((b.index-a.index)%60+60)%60,expected);
  }
});

test("the prototype's 2024 boundary has two candidates when date-only",()=>{
  for (const [chosen,expected] of [
    [date(2024,2,1),"癸卯"],
    [date(2024,2,10),"甲辰"]
  ]) {
    const evidence=researchYearStripState(chosen);
    const story=researchOneYearStory(chosen,evidence);
    assert.equal(story.activeYear.name,expected);
    assert.ok(story.liChun);
    assert.ok(story.boundaryZoom);
  }
  const boundary=date(2024,2,4);
  const evidence=researchYearStripState(boundary);
  const actual=activeYearIdentityForDate(boundary,evidence);
  assert.equal(actual.status,"unresolved");
  assert.equal(actual.pillar,null);
  assert.deepEqual(actual.possiblePillars.map(x=>x.name),["癸卯","甲辰"]);
});
