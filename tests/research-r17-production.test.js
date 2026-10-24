import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";
import { projectUnfoldedPhases } from "../src/recurrence/r17-unfolded-phase-projection.js";
import { renderR17ZeroProof,zeroProofNarrative } from "../src/recurrence/r17-zero-proof-view.js";

const BASE={year:2026,month:9,day:13};
const project=delta=>projectUnfoldedPhases(recurrenceState(BASE,delta));
function fakeSvg(){
 const nodes=[];
 return {
  nodes, dataset:{},attrs:{},
  ownerDocument:{createElementNS(_ns,tag){
   return {tag,attrs:{},setAttribute(key,v){this.attrs[key]=v},textContent:""};
  }},
  replaceChildren(){nodes.splice(0)},
  setAttribute(key,v){this.attrs[key]=v},
  append(node){nodes.push(node)}
 };
}
test("R17 narrative distinguishes local Year/Day, complete closure, and Gregorian-only",()=>{
 assert.equal(zeroProofNarrative(project(1980)).state,"year-day-closed");
 assert.equal(zeroProofNarrative(project(400)).state,"gregorian-closed");
 assert.equal(zeroProofNarrative(project(24000)).state,"all-closed");
 assert.equal(zeroProofNarrative(project(60)).state,"mixed");
 const leap={year:2024,month:2,day:29};
 assert.equal(zeroProofNarrative(projectUnfoldedPhases(recurrenceState(leap,1))).state,"unavailable");
 assert.doesNotMatch(zeroProofNarrative(project(1980)).title,/[-−+]20/);
});
test("R17 SVG uses normalized but independent scales; no chronology fork",()=>{
 for(const d of [0,60,400,1980,24000]){
  const svg=fakeSvg();
  const verdict=renderR17ZeroProof(svg,recurrenceState(BASE,d),{mobile:true});
  const rows=project(d);
  assert.equal(svg.dataset.figureGrammar,"zero-proof-plate");
  assert.equal(svg.dataset.evidenceState,verdict.state);
  assert.deepEqual([svg.dataset.gregorianSigned,svg.dataset.yearSigned,svg.dataset.daySigned],
    rows.map(r=>String(r.signed)));
  assert.equal(svg.attrs.viewBox,"0 0 370 322");
  assert.ok(svg.nodes.length>12);
  for(const node of svg.nodes){
   assert.equal(Object.values(node.attrs).some(v=>String(v).includes("NaN")),false);
  }
 }
 const svg=fakeSvg();
 renderR17ZeroProof(svg,recurrenceState(BASE,1980),{mobile:false});
 assert.equal(svg.attrs.viewBox,"0 0 720 322");
 assert.equal(svg.nodes.filter(node=>node.tag==="circle").length,3);
});
test("R17 opt-in preserves original SVG, its model and event bindings",()=>{
 const html=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
 const view=readFileSync(new URL("../src/recurrence-view.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../research-page-rhythm.css",import.meta.url),"utf8");
 assert.match(html,/id="recurrence-wheel"/);
 assert.match(html,/id="r17-production-proof"/);
 assert.match(view,/r17OptIn = !r18OptIn && researchMode\.get\("r17"\) === "1"/);
 assert.match(view,/r20OptIn = researchMode\.get\("r20"\) === "1"/);
 assert.match(view,/r18OptIn = r20OptIn \|\| researchMode\.get\("r18"\) === "1"/);
 assert.match(view,/renderR17ZeroProof\(r17Svg, state/);
 assert.match(view,/recurrenceState\(currentBase, currentDelta\)/);
 assert.match(view,/renderReturnMarkers\(state\)/);
 assert.match(view,/setDelta\(deltaYears/);
 assert.match(view,/instrument\.dataset\.r17ProofSource = "recurrenceState"/);
 assert.match(css,/html\[data-research-visual="r17"\]/);
 assert.doesNotMatch(css,/html\[data-research-visual="r16"\]/);
});
