import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../prototypes/research-r17-in-context.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../prototypes/research-r17-in-context.js",import.meta.url),"utf8");
test("in-context study embeds the real Research page rather than a fake Year strip",()=>{
 assert.match(html,/<iframe id="production"/);
 assert.match(js,/\.\.\/recurrence\.html\?date=2026-09-13&delta=/);
 assert.match(js,/#research-year-strip/);
 assert.match(js,/#delta-slider/);
 assert.match(js,/#recurrence-instrument/);
 assert.doesNotMatch(html,/id="research-year-strip"/);
 assert.doesNotMatch(html,/id="delta-slider"/);
});
test("in-context study uses the production phase state without independent calendars",()=>{
 for(const key of ["gregorianPhaseSigned","yearSequencePhaseSigned","dayPhaseSigned","deltaYears"]){
  assert.ok(js.includes(key),key+" was not read from production");
 }
 assert.match(js,/MutationObserver\(render\)/);
 assert.match(js,/r17PhaseEvidence/);
 assert.match(js,/r17Source="production-instrument"/);
 assert.doesNotMatch(js,/function ordinal\(/);
 assert.doesNotMatch(js,/recurrenceState\(/);
});
test("R16 comparison remains reversible and production pages unedited",()=>{
 assert.match(js,/classList\.toggle\("r17-context-prototype",variant==="proof"\)/);
 assert.match(html,/data-variant="original"/);
 assert.match(html,/data-variant="proof"/);
});
