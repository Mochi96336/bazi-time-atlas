import test from "node:test";
import assert from "node:assert/strict";
import {jiaziAnchoredCivilYear} from "../src/recurrence/jiazi-year-geometry.js";
import {gregorianOrdinal} from "../src/recurrence/gregorian-cycle.js";
import {sexagenaryDayForGregorianDate} from "../src/recurrence/ganzhi-cycle-comparison.js";

for(const [year,days,drift] of [[2023,365,5],[2024,366,6],[2100,365,5],[2400,366,6],[2426,365,5],[26026,365,5]]){
  test("real 甲子 boundaries partition entire civil year "+year,()=>{
    const g=jiaziAnchoredCivilYear(year);
    const jan1=gregorianOrdinal({year,month:1,day:1});
    assert.equal(g.days,days);
    assert.equal(g.driftDays,drift);
    assert.equal(g.firstJiaziOffset,(60-g.jan1Pillar.index)%60);
    assert.equal(g.headDays,g.firstJiaziOffset);
    assert.equal(g.completeInYearSpans,g.ticks.length-1);
    assert.equal(g.headDays+g.completeInYearSpans*60+g.tailDays,days);
    assert.ok(g.tailDays>=1&&g.tailDays<=60);
    assert.ok(g.ticks.length>=6);
    for(const [i,tick] of g.ticks.entries()){
      assert.equal(tick.pillar,"甲子");
      assert.equal(tick.ordinal,1);
      assert.equal(tick.offset,g.firstJiaziOffset+60*i);
      assert.equal(gregorianOrdinal(tick.date)-jan1,tick.offset);
      assert.ok(Math.abs(tick.percent-tick.offset/(days-1)*100)<1e-9);
      assert.equal(sexagenaryDayForGregorianDate(tick.date).index,0);
    }
    assert.equal(g.nextJan1Pillar.index,(g.jan1Pillar.index+days)%60);
  });
}

test("甲子 anchoring is NOT 1/1 anchoring; in-year full spans may be only five",()=>{
  const samples=Array.from({length:60},(_,i)=>jiaziAnchoredCivilYear(2020+i));
  assert.ok(samples.some(g=>g.firstJiaziOffset!==0));
  assert.ok(samples.some(g=>g.firstJiaziOffset===0));
  assert.ok(samples.some(g=>g.completeInYearSpans===5));
  assert.ok(samples.some(g=>g.completeInYearSpans===6));
  // The Gregorian whole-year drift stays +5/+6 regardless of partial head/tail.
  assert.ok(samples.every(g=>g.driftDays===(g.days===366?6:5)));
});

test("rejected invalid years never invent a calendar day",()=>{
  for(const value of [0,-1,10_000_001,1.1,NaN]){
    assert.throws(()=>jiaziAnchoredCivilYear(value),RangeError);
  }
});
