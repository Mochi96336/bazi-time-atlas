import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";

const source=readFileSync(new URL("../scripts/fixtures/4k-fling-text-isolation.html",import.meta.url),"utf8");
const js=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("the 4K fling harness is a self-contained, syntactically valid fixture",()=>{
  assert.ok(js,"missing inline script");
  assert.doesNotThrow(()=>new Script(js,{filename:"4k-fling-text-isolation.html"}));
  assert.doesNotMatch(source,/https?:\/\/cdn\./);
});

test("all A/B modes preserve actual draggable app and independent visual ownership",()=>{
  for(const key of ["baseline","static-text-off","active-text-off","all-text-off","motion-off","effects-off","webgl-text-off"]){
    assert.match(source,new RegExp('value="'+key+'"'));
  }
  assert.match(js,/stage\.src=new URL\("\.\.\/\.\.\/\?material="/);
  assert.match(js,/style\.id="fling-isolation-only"/);
  assert.match(js,/doc\.head\.appendChild\(style\)/);
  assert.match(js,/baseline:\{material:"svg",rule:""\}/);
  assert.match(js,/material:"roughness",rule:"#kinetic-wheel text/);
  assert.match(source,/#panel\{position:fixed/);
});

test("static labels and active readheads can be disabled independently",()=>{
  assert.match(js,/#kinetic-wheel \.cycle-label:not\(\.active-cycle-label\)/);
  assert.match(js,/#kinetic-wheel \.term-label:not\(\.active-annual-label\)/);
  assert.match(js,/#kinetic-wheel \.active-cycle-label,#kinetic-wheel \.active-annual-label/);
  assert.match(js,/#kinetic-wheel text\{display:none!important\}/);
  assert.match(js,/#kinetic-wheel \.motion-trace\{display:none!important\}/);
  assert.match(js,/filter:none!important;transition:none!important;animation:none!important/);
});

test("manual native pointer flings are measured rather than relying on smooth autoplay",()=>{
  assert.match(js,/svg\.addEventListener\("pointerdown",onDown/);
  assert.match(js,/svg\.addEventListener\("pointermove",onMove/);
  assert.match(js,/svg\.addEventListener\("pointerup",onUp/);
  assert.match(js,/svg\.dataset\.activeRing/);
  assert.match(js,/svg\.dataset\.coastingRing/);
  assert.match(js,/win\.requestAnimationFrame\(frame\)/);
  assert.match(js,/frameTiming:summarize\(frames\)/);
  assert.match(js,/visualObservation:observation\.value/);
  assert.match(source,/4K、最大化/);
  assert.match(source,/手動快甩 10 秒/);
  assert.doesNotMatch(js,/\.click\(\)/);
});
