import test from "node:test";
import assert from "node:assert/strict";
import {jiaziAnchoredCivilYear,jiaziSelectedDayProgress} from "../src/recurrence/jiazi-year-geometry.js";
import {gregorianOrdinal} from "../src/recurrence/gregorian-cycle.js";
import {gregorianDateFromOrdinal} from "../src/recurrence/gregorian-date-navigation.js";
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

test("highlight starts at the actual previous 甲子, not January 1",()=>{
  for(const year of [2023,2024,2026,2100,2426,26026]){
    const annual=jiaziAnchoredCivilYear(year);
    for(const offset of [0,1,annual.firstJiaziOffset,
                         Math.min(annual.firstJiaziOffset+1,annual.days-1),
                         120,annual.days-1]){
      const jan1=gregorianOrdinal({year,month:1,day:1});
      const date=gregorianDateFromOrdinal(jan1+offset);
      const pos=jiaziSelectedDayProgress(date);
      assert.equal(pos.dayIndex,sexagenaryDayForGregorianDate(date).index);
      assert.equal(pos.dayOrdinal,pos.dayIndex+1);
      assert.equal(pos.selectedOffset,offset);
      assert.equal(pos.previousJiaziOffset,offset-pos.dayIndex);
      assert.equal(pos.visibleStartOffset,Math.max(0,pos.previousJiaziOffset));
      assert.equal(pos.anchorInYear,pos.previousJiaziOffset>=0);
      assert.equal(pos.nextJiaziOffset-pos.previousJiaziOffset,60);
      assert.ok(pos.leftPercent>=0 && pos.leftPercent+pos.widthPercent<=100+1e-8);
      assert.ok(Math.abs(pos.widthPercent-
        (offset-pos.visibleStartOffset)*100/(annual.days-1))<1e-8);
      if(pos.anchorInYear)
        assert.equal(annual.ticks.some(t=>t.offset===pos.previousJiaziOffset),true);
    }
  }
  const leapStart=jiaziSelectedDayProgress({year:2024,month:1,day:1});
  assert.equal(leapStart.dayOrdinal,1);
  assert.equal(leapStart.widthPercent,0);
  const after=jiaziSelectedDayProgress({year:2024,month:2,day:10});
  assert.equal(after.dayOrdinal,41);
  assert.equal(after.previousJiaziOffset,0);
  assert.ok(after.widthPercent>0);
});

test("invalid selected dates do not create phantom selection spans",()=>{
  for(const date of [{year:2023,month:2,day:29},{year:0,month:1,day:1},
                      {year:2024,month:13,day:1}]){
    assert.throws(()=>jiaziSelectedDayProgress(date),RangeError);
  }
});
