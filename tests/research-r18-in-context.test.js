import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {recurrenceState} from "../src/recurrence/gregorian-cycle.js";
import {buildClosureJourney} from "../src/recurrence/r18-closure-journey.js";

test("R18 integration retains a single live date owner, native Year strip, Δ and R16 fallback",()=>{
 const html=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
 const view=readFileSync(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../research-r18-context.css",import.meta.url),"utf8");
 assert.match(html,/id="research-year-strip"/);
 assert.match(html,/id="delta-slider"/);
 assert.match(html,/id="recurrence-wheel"/);
 assert.match(html,/id="r17-production-proof"/);
 assert.match(html,/id="r18-context"/);
 assert.match(html,/id="r18-context-overview"/);
 assert.match(html,/id="r18-context-local"/);
 assert.match(view,/r18OptIn = researchMode\.get\("r18"\) === "1"/);
 assert.match(view,/r17OptIn = !r18OptIn/);
 assert.match(view,/renderR18Context\(r18Context, state\)/);
 assert.match(view,/recurrenceState\(currentBase, currentDelta\)/);
 assert.match(view,/instrument\.dataset\.r18ProofSource = "recurrenceState"/);
 assert.match(css,/html\[data-research-visual="r18"\]/);
 assert.doesNotMatch(css,/html\[data-research-visual="r16"\]/);
 assert.match(css,/html\[data-research-visual="r18"\] #discrete-derivation-steps/);
 assert.match(css,/html\[data-research-visual="r18"\] #research-discrete \.discrete-derivation-rule/);
});
test("R18 in-context uses existing 24000/1200/8000 proofs and avoids standalone controls",()=>{
 const h=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
 const part=h.slice(h.indexOf('id="r18-context"'),h.indexOf('id="r17-production-proof"'));
 assert.match(part,/LCM\(400, 60\) = 1,200/);
 assert.match(part,/146,097 mod 60 = 57/);
 assert.match(part,/LCM\(1,200, 8,000\) = 24,000/);
 assert.doesNotMatch(part,/id="delta-slider"|id="base-year"|id="research-delta-play"/);
 assert.equal((h.match(/id="delta-slider"/g)||[]).length,1);
 assert.match(h,/id="r18-context-controls-slot"/);
 const view=readFileSync(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
 assert.match(view,/slot\.append\(originalTools\)/);
 assert.match(view,/if \(r18OptIn\)/);

});
test("R18 projection cache is scoped to current base, not Δ input",()=>{
 const script=readFileSync(new URL("../src/recurrence/r18-in-context-view.js",import.meta.url),"utf8");
 assert.match(script,/if\(key!==next\)/);
 assert.match(script,/if\(repaint\)/);
 assert.match(script,/cursor\(overviewSvg,state\.deltaYears/);
 assert.match(script,/cursor\(localSvg,state\.deltaYears/);
 assert.match(script,/dataset\.r18EventCache=key/);
 assert.match(script,/if\(!journey\)return null/);

 assert.doesNotMatch(script,/history\.replaceState|setInterval|new URLSearchParams/);
 for(const [base,local] of [
  [{year:2026,month:9,day:13},1980],
  [{year:1900,month:3,day:1},6180],
  [{year:2100,month:3,day:1},16080]
 ]){
  const j=buildClosureJourney(base);
  assert.equal(j.firstLocal,local);
  assert.equal(recurrenceState(base,local).closed.day,true);
  assert.equal(recurrenceState(base,local).closed.yearSequence,true);
 }
});
