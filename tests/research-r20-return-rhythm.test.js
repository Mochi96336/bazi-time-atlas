import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildClosureJourney} from "../src/recurrence/r18-closure-journey.js";
import {buildReturnRhythm,returnArcPath} from "../src/recurrence/r20-return-rhythm.js";
for(const [base,first] of [
 [{year:2026,month:9,day:13},1980],
 [{year:1900,month:3,day:1},6180],
 [{year:2100,month:3,day:1},16080]
]){
 test("R20 arch endpoints represent exclusively true closure events for "+JSON.stringify(base),()=>{
  const model=buildClosureJourney(base);
  const rhythm=buildReturnRhythm(model);
  assert.equal(rhythm.firstLocal,first);
  assert.equal(rhythm.firstGlobal,24000);
  assert.equal(rhythm.tracks.length,4);
  const keys=rhythm.tracks.map(t=>t.key);
  assert.deepEqual(keys,["gregorianYear","yearDay","gregorianDay","all"]);
  const expectedFirst=[1200,first,8000,24000];
  rhythm.tracks.forEach((track,i)=>{
   assert.equal(track.first,expectedFirst[i]);
   assert.deepEqual(track.events,model.overview[track.key]);
   assert.equal(track.spans[0].from,0,"initial datum is not an event");
   for(const [j,span] of track.spans.entries()){
    assert.equal(span.to,track.events[j]);
    assert.equal(span.from,j===0?0:track.events[j-1]);
    assert.equal(span.years,span.to-span.from);
    assert.equal(span.role,j===0?"origin-to-first":"between-returns");
    assert.ok(span.years>0);
   }
   assert.equal(track.spans.at(-1).to,24000,
      "all event series must close at the common discrete candidate");
  });
  // +0 is NOT rendered as a positive closure event.
  assert.equal(rhythm.tracks.some(track=>track.events.includes(0)),false);
  assert.ok(rhythm.tracks[0].spans.length>rhythm.tracks[2].spans.length);
 });
}
test("R20 SVG arches express only intervals and never interpolate phase truth",()=>{
 const p=returnArcPath(100,200,130);
 assert.match(p,/^M 100\.00 130\.00 Q 150\.00 /);
 assert.match(p,/ 200\.00 130\.00$/);
 assert.throws(()=>returnArcPath(200,200,130),RangeError);
 assert.throws(()=>returnArcPath(200,100,130),RangeError);
 assert.throws(()=>returnArcPath(NaN,100,130),RangeError);
 const js=readFileSync(new URL("../src/recurrence/r18-in-context-view.js",import.meta.url),"utf8");
 const controller=readFileSync(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
 const h=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
 assert.match(js,/buildReturnRhythm\(model\)/);
 assert.match(js,/data-r20-span-to/);
 assert.match(js,/data-r20-closure-year/);
 assert.match(js,/data-r18-readhead/);
 assert.match(js,/mobile\?460:374/);
 assert.match(js,/wideMobile:true/);
 assert.match(js,/mobile\?\[103,198,293,388\]/);
 assert.match(js,/svg\.dataset\.r20Layout=mobile/);
 assert.match(js,/svg\.dataset\.axisLeft/);
 assert.match(js,/svg\.dataset\.axisRight/);
 assert.match(js,/spanSemantics="endpoints-only"/);
 assert.match(js,/閉合事件的間隔與回返節奏/);
 assert.match(js,/第一段弧線從基準 Δ＝0 延伸至首次非零閉合/);
 assert.match(js,/白色加粗刻線是首次年＋日重遇/);
 assert.match(js,/data-r20-span-role/);
 assert.match(js,/同一條真實經過年數軸上的四種回返節奏/);
 assert.match(js,/if\(!rhythm\) overviewSvg\.setAttribute\("aria-label"/);
 assert.match(js,/不是連續相位或天文軌道/);
 assert.match(js,/root\.dataset\.r18DiagramVariant=variant/);
 assert.match(js,/rhythm\?"return-spans":"event-lanes"/);
 assert.match(controller,/const r20OptIn = researchMode\.get\("r20"\) === "1"/);
 assert.match(controller,/r20OptIn \|\| researchMode\.get\("r18"\) === "1"/);
 assert.match(controller,/renderR18Context\(r18Context, state, \{ rhythm:r20OptIn \}\)/);
 assert.match(controller,/dataset\.researchRhythm = r20OptIn \? "r20" : "r19"/);
 assert.match(h,/id="r18-context-figure-caption"/);
 assert.equal((h.match(/id="delta-slider"/g)||[]).length,1);
});
