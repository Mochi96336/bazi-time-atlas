import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
 H27_REFERENCE_SHA,H27_INSTANTS,H27_VARIANTS,H27_TOKENS,applyH27Prototype
} from "../scripts/home-h27-zodiac-prototype.js";

class SvgMock {
  constructor(doc,tag){this.ownerDocument=doc;this.tagName=tag;this.attributes={};
    this.children=[];this.parentNode=null;this.dataset={};}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  get id(){return this.attributes.id||"";}
  append(n){n.parentNode=this;this.children.push(n);}
  after(n){assert.ok(this.parentNode,"surface path must be attached");
    const nodes=this.parentNode.children,pos=nodes.indexOf(this);
    n.parentNode=this.parentNode;nodes.splice(pos+1,0,n);}
  querySelector(selector){
    if(selector==="defs")return this.children.find(n=>n.tagName==="defs")||null;
    if(selector===".m2-zodiac-hard-bed")return this.children.find(n=>n.attributes.class==="m2-zodiac-hard-bed")||null;
    if(selector==="[data-h27-structural-probe]")return this.children.find(n=>n.dataset.h27StructuralProbe)||null;
    return null;
  }
}
function fakeDocument(){
  const doc={createElementNS(ns,tag){assert.equal(ns,"http://www.w3.org/2000/svg");
    return new SvgMock(doc,tag);},querySelector(selector){
      return selector==="#kinetic-wheel"?svg:null;}};
  const svg=new SvgMock(doc,"svg"),defs=new SvgMock(doc,"defs"),bed=new SvgMock(doc,"path");
  bed.setAttribute("d","M ORIGINAL AUTHORITY PATH");
  bed.setAttribute("class","m2-zodiac-hard-bed");
  svg.append(defs);svg.append(bed);
  return {doc,svg,defs,bed};
}
test("H2.7 retains canonical palette and meaningful three-way experimental scope",()=>{
  assert.match(H27_REFERENCE_SHA,/^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(H27_VARIANTS),["C0","C1","C2","C3"]);
  assert.equal(H27_TOKENS.field,"#0a0d13");
  assert.equal(H27_TOKENS.zodiac,"#424b59");
  assert.deepEqual(H27_INSTANTS.length,2);
  assert.throws(()=>applyH27Prototype(fakeDocument().doc,"__proto__"));
});
test("C0 is byte-for-byte unmodified substrate; C1 and C2 clone real Zodiac material geometry",()=>{
  for(const variant of ["C0","C1","C2","C3"]){
    const {doc,svg,defs,bed}=fakeDocument(),before=bed.getAttribute("d");
    const result=applyH27Prototype(doc,variant);
    const paths=svg.children.filter(x=>x.dataset.h27StructuralProbe);
    assert.equal(paths.length,variant==="C0"?0:variant==="C2"?2:1);
    assert.equal(result.inserted,paths.length);
    assert.equal(result.gradients,paths.length);
    if(variant==="C3")assert.equal(paths[0]?.getAttribute("opacity"),"0.54");
    assert.equal(bed.getAttribute("d"),before);
    assert.ok(paths.every(x=>x.getAttribute("d")===before));
    assert.ok(paths.every(x=>x.getAttribute("pointer-events")==="none"));
    assert.ok(paths.every(x=>x.getAttribute("aria-hidden")==="true"));
    assert.equal(defs.children.length,paths.length);
    if(variant==="C0")continue;
    assert.deepEqual(defs.children[0].children.map(x=>x.tagName),
      Array(6).fill("stop"));
    assert.equal(defs.children[0].getAttribute("gradientUnits"),"userSpaceOnUse");
    assert.equal(paths[0].dataset.h27StructuralProbe,"recess");
    if(variant==="C2"){
      assert.equal(paths[1].dataset.h27StructuralProbe,"satin");
      assert.equal(defs.children[1].tagName,"linearGradient");
      assert.equal(defs.children[1].children.length,4);
      assert.equal(defs.children[1].getAttribute("gradientUnits"),"userSpaceOnUse");
      assert.equal(svg.children.indexOf(paths[1]),svg.children.indexOf(paths[0])+1,
        "satin must render above recessed material, below real semantics");
    }
    assert.throws(()=>applyH27Prototype(doc,variant),"duplicate probe must fail closed");
  }
});
test("native optical harness retains genuine widths and screenshot-process post-layout CTM",()=>{
  const fixture=readFileSync(new URL("../scripts/fixtures/home-h27-zodiac-frame.html",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../scripts/visual-check-home-h27-zodiac.mjs",import.meta.url),"utf8");
  const workflow=readFileSync(new URL("../.github/workflows/home-h27-zodiac.yml",import.meta.url),"utf8");
  const prod=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  assert.match(fixture,/H2\.7 SCREENSHOT NOT READY/);
  assert.match(fixture,/applyH27Prototype\(doc,variant\)/);
  assert.match(fixture,/doc\.fonts\?\.ready/);
  assert.match(fixture,/getScreenCTM/);
  assert.match(fixture,/stage\.style\.width=width\+"px"/);
  assert.match(fixture,/frame\.style\.width=nativeWidth\+"px"/);
  assert.match(fixture,/frame\.src=page\.href/);
  assert.ok(fixture.indexOf("frame.style.width=nativeWidth") < fixture.indexOf("frame.src=page.href"));
  assert.match(fixture,/__h27BootstrapWidth/);
  assert.match(runner,/readScreenshotCtm/);
  assert.match(runner,/materialMasks/);
  assert.match(runner,/webglSolar\.redMinusBlue/);
  assert.match(runner,/svgSolar=solarWarmth/);
  assert.match(runner,/baselineReplayIdentical/);
  assert.match(runner,/nonZodiac/);
  assert.match(runner,/C0.*C1.*C2|Object\.keys\(H27_VARIANTS\)/s);
  for(const width of ["320","390","1440","2047"])assert.ok(runner.includes(width));
  for(const mode of ["svg","roughness","fallback"])assert.ok(runner.includes('"'+mode+'"'));
  assert.ok(workflow.indexOf("run: npm run vendor:prepare")>=0);
  assert.ok(workflow.indexOf("run: node scripts/visual-check-home-h27-zodiac.mjs")>
    workflow.indexOf("run: npm run vendor:prepare"));
  assert.doesNotMatch(prod,/h27Zodiac|h27-zodiac/);
  assert.doesNotMatch(html,/h27-zodiac|H2\.7/);
});
