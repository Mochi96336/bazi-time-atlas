import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  recurrenceState,
  findFirstLocalYearSequenceDayRecurrence
} from "../src/recurrence/gregorian-cycle.js";
import { explainDiscreteResult } from "../src/recurrence/discrete-reading.js";

const base={year:2026,month:9,day:13};
const local=findFirstLocalYearSequenceDayRecurrence(base)?.deltaYears;

test("Research 01 labels the start as a datum, not a rediscovery",()=>{
  const copy=explainDiscreteResult(recurrenceState(base,0),local);
  assert.match(copy,/基準點/);
  assert.match(copy,/起點，不是跨年後的重遇/);
});

test("each canonical milestone says exactly what did and did not return",()=>{
  assert.equal(local,1980,"the 2026-09-13 local Year+Day case is the pinned 1980-year example");
  const cases=[
    [400,["公曆結構回原位","60 年序與 60 日序仍未歸零","不代表節界重現"]],
    [1200,["公曆結構＋60 年序閉合","60 日序仍偏","不是三圈同時歸零"]],
    [1980,["此起點 60 年序＋60 日序首次重遇","公曆結構仍未歸零","季節位置"]],
    [8000,["公曆結構＋60 日序閉合","60 年序仍偏","不是三圈同時歸零"]],
    [24000,["三個離散相位同時歸零","只證明離散候選","02 檢查十二節界","不能直接當作四柱週期"]]
  ];
  for(const [delta,phrases] of cases){
    const state=recurrenceState(base,delta);
    const text=explainDiscreteResult(state,local);
    for(const phrase of phrases)assert.ok(text.includes(phrase),`Δ${delta}: missing ${phrase}: ${text}`);
  }
});

test("unclosed phases are not silently described as a BaZi return",()=>{
  const copy=explainDiscreteResult(recurrenceState(base,1),local);
  assert.match(copy,/三圈都未歸零/);
  assert.doesNotMatch(copy,/節界重合|四柱同時歸零/);
});

test("invalid leap-date comparison never infers a day-phase recurrence",()=>{
  const state=recurrenceState({year:2024,month:2,day:29},1);
  assert.equal(state.targetValid,false);
  const copy=explainDiscreteResult(state,local);
  assert.match(copy,/公曆中不存在/);
  assert.match(copy,/日序無法比較/);
});

test("existing Research reading path uses concrete examples without adding new cards",()=>{
  const html=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
  assert.match(html,/每圈的 0 只代表該循環序位回到起點/);
  assert.match(html,/正負數是相對起點的最短位移，不是節氣提前或延後的天數/);
  assert.match(html,/依序點上方 \+400、\+8,000、\+24,000 年的里程碑/);
  assert.match(html,/三圈都為 0，也還要繼續 02 驗證節界/);
  assert.doesNotMatch(html,/class="research-reading-card"|id="research-reading-wizard"/);
});
