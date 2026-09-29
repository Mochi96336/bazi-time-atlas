import test from "node:test";
import assert from "node:assert/strict";
import { projectExplicitResearchTargetDate } from "../src/recurrence/explicit-target-date-projection.js";
import { readFile } from "node:fs/promises";

test("visible selected-date input crosses years via the canonical base and unchanged delta",()=>{
  const result=projectExplicitResearchTargetDate(
    {year:2026,month:9,day:13},400,{year:2427,month:10,day:20}
  );
  assert.equal(result.status,"applied");
  assert.deepEqual(result.baseDate,{year:2027,month:10,day:20});
  assert.deepEqual(result.targetDate,{year:2427,month:10,day:20});
  assert.equal(result.deltaYears,400);
});
test("visible selector refuses unrepresentable baseline leap day or underflow",()=>{
  assert.equal(projectExplicitResearchTargetDate(
    {year:2023,month:9,day:13},1,{year:2024,month:2,day:29}
  ).status,"unrepresentable-baseline-date");
  assert.equal(projectExplicitResearchTargetDate(
    {year:2026,month:9,day:13},400,{year:2024,month:2,day:10}
  ).status,"baseline-year-out-of-range");
  assert.equal(projectExplicitResearchTargetDate(
    {year:2026,month:9,day:13},0,{year:2025,month:2,day:29}
  ).status,"invalid-target-date");
});
test("the primary date form calls the existing sole recurrence controller",async()=>{
  const html=await readFile(new URL("../recurrence.html",import.meta.url),"utf8");
  const owner=await readFile(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
  assert.match(html,/id="research-target-date-form"/);
  assert.match(html,/id="research-target-date-input"/);
  assert.ok(html.indexOf('id="research-target-date-form"') < html.indexOf('id="research-controls"'));
  assert.ok(html.indexOf('id="base-year"') > html.indexOf('id="research-controls"'));
  assert.match(owner,/selectedDateForm\?\.addEventListener\("submit",submitSelectedDate\)/);
  assert.match(owner,/projectExplicitResearchTargetDate\(currentBase,currentDelta,requested\)/);
  assert.match(owner,/setDelta\(currentDelta,\{source:"explicit-selected-date"\}\)/);
  assert.match(owner,/selectedTargetInstantBound==="true"/);
});
