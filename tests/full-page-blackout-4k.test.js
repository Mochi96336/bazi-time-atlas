import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";

const html=readFileSync(new URL("../scripts/fixtures/full-page-blackout-4k.html",import.meta.url),"utf8");
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("full-page blackout diagnostic is standalone and its embedded JS compiles",()=>{
  assert.ok(js,"embedded script missing");
  assert.doesNotThrow(()=>new Script(js,{filename:"full-page-blackout-4k.html"}));
  assert.doesNotMatch(html,/type="module"|https?:\/\/cdn\./);
});

test("diagnostics isolate app work from pure CSS motion and static painted backgrounds",()=>{
  for(const mode of ["blank","css","static-svg","live-svg","no-filter","no-wheel","webgl"]) {
    assert.match(html,new RegExp('value="'+mode+'"'));
  }
  assert.match(js,/blank:\{kind:"minimal",animated:false,play:false\}/);
  assert.match(js,/css:\{kind:"minimal",animated:true,play:false\}/);
  assert.match(js,/"static-svg":\{kind:"app",play:false\}/);
  assert.match(js,/"no-filter":\{kind:"app",play:true,stripFilters:true\}/);
  assert.match(js,/"no-wheel":\{kind:"app",play:true,hideWheel:true\}/);
  assert.match(js,/current\.webgl\?"roughness":"svg"/);
  assert.match(js,/doc\.head\.appendChild\(style\)/);
});

test("site changes are restricted to fixture iframe, never globally mutating prod styling",()=>{
  assert.match(js,/#kinetic-wheel,#material-wheel-layer\{visibility:hidden!important\}/);
  assert.match(js,/\*\{filter:none!important;backdrop-filter:none!important/);
  assert.match(js,/stage\.contentDocument/);
  assert.doesNotMatch(js,/parent\.document\.head/);
});

test("observer distinguishes local page content, diagnostic overlay and physical display",()=>{
  for(const classification of ["none","content","full-browser","display"]) {
    assert.match(html,new RegExp('value="'+classification+'"'));
  }
  assert.match(js,/actualDevicePixelRatio|devicePixelRatio:win\.devicePixelRatio/);
  assert.match(js,/win\.requestAnimationFrame\(step\)/);
  assert.match(js,/timing:summarize\(intervals\)/);
  assert.match(html,/150 畫格/);
  assert.match(html,/無法直接偵測 GPU 合成造成的黑屏/);
});
