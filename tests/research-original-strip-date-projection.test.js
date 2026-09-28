import test from "node:test";
import assert from "node:assert/strict";
import { projectOriginalStripSelection } from "../src/recurrence/original-strip-date-projection.js";

test("R2: original Year strip has NO second date owner; base+delta retains its original target year",()=>{
  const mapped=projectOriginalStripSelection({year:2024,month:2,day:10},0,{year:2024,month:2,day:4});
  assert.equal(mapped.status,"applied");
  assert.deepEqual(mapped.baseDate,{year:2024,month:2,day:4});
  assert.deepEqual(mapped.targetDate,{year:2024,month:2,day:4});
  assert.equal(mapped.deltaYears,0);
  assert.equal(projectOriginalStripSelection(
    {year:2024,month:2,day:10},0,{year:2025,month:1,day:1}
  ).status,"outside-current-target-year");
});

test("R2: deep Δ still owned by original recurrence base date and never silently changes",()=>{
  const mapped=projectOriginalStripSelection(
    {year:2024,month:2,day:10},1980,{year:4004,month:3,day:15}
  );
  assert.equal(mapped.status,"applied");
  assert.deepEqual(mapped.baseDate,{year:2024,month:3,day:15});
  assert.deepEqual(mapped.targetDate,{year:4004,month:3,day:15});
  assert.equal(mapped.deltaYears,1980);
});

test("R2: leap-day mismatch fails closed rather than altering the base year or Δ",()=>{
  const unavailable=projectOriginalStripSelection(
    {year:2023,month:2,day:10},1,{year:2024,month:2,day:29}
  );
  assert.equal(unavailable.status,"base-calendar-day-unavailable");
  const reachable=projectOriginalStripSelection(
    {year:2020,month:2,day:10},4,{year:2024,month:2,day:29}
  );
  assert.equal(reachable.status,"applied");
  assert.deepEqual(reachable.baseDate,{year:2020,month:2,day:29});
  assert.equal(projectOriginalStripSelection(
    {year:2024,month:2,day:10},1,{year:2025,month:2,day:29}
  ).status,"invalid-date");
});

test("R2: invalid target date and unsupported target year never commit",()=>{
  assert.equal(projectOriginalStripSelection(
    {year:2024,month:2,day:10},0,{year:2024,month:2,day:30}
  ).status,"invalid-date");
  assert.throws(()=>projectOriginalStripSelection(
    {year:2025,month:2,day:29},0,{year:2025,month:3,day:1}
  ),/invalid original recurrence/);
});
