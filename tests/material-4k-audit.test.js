import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import {
  MATERIAL_MODES,
  resolveMaterialMode,
  resolveMaterialAuditOptions
} from "../src/wheel/material-prototype.js";

test("all diagnostic material switches are inert on ordinary production links", () => {
  const normal = {
    enabled:false,
    powerPreference:"low-power",
    preserveDrawingBuffer:false,
    renderScale:1
  };
  assert.deepEqual(resolveMaterialAuditOptions(""),normal);
  assert.deepEqual(resolveMaterialAuditOptions("?material=roughness"),normal);
  assert.deepEqual(resolveMaterialAuditOptions("?materialGpu=high&materialBuffer=preserve&materialScale=0.5"),normal);
  assert.deepEqual(resolveMaterialAuditOptions("?renderAudit=off&materialGpu=high"),normal);
  assert.equal(resolveMaterialMode(""),MATERIAL_MODES.ROUGHNESS);
});

test("4K probes isolate GPU preference, buffer retention and pixel workload", () => {
  const standard = resolveMaterialAuditOptions("?renderAudit=1");
  assert.deepEqual(standard,{
    enabled:true,
    powerPreference:"low-power",
    preserveDrawingBuffer:false,
    renderScale:1
  });
  assert.deepEqual(resolveMaterialAuditOptions("?renderAudit=1&materialGpu=high"),{
    ...standard,powerPreference:"high-performance"
  });
  assert.deepEqual(resolveMaterialAuditOptions("?renderAudit=1&materialBuffer=preserve"),{
    ...standard,preserveDrawingBuffer:true
  });
  assert.deepEqual(resolveMaterialAuditOptions("?renderAudit=1&materialScale=0.5"),{
    ...standard,renderScale:0.5
  });
  assert.deepEqual(resolveMaterialAuditOptions("?renderAudit=1&materialScale=0.1&materialGpu=ultra"),standard);
  assert.equal(resolveMaterialMode("?material=svg&renderAudit=1"),MATERIAL_MODES.SVG);
});

test("audit never forces GPU readback and exposes its metrics only by explicit opt-in", () => {
  const source=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
  assert.match(source,/const audit = auditEnabled \?/);
  assert.match(source,/if \(audit\) globalThis\.__atlasRenderAudit = audit;/);
  assert.match(source,/const drawStart = audit \? performance\.now\(\) : 0;/);
  assert.match(source,/preserveDrawingBuffer: auditPreserve/);
  assert.match(source,/powerPreference: auditPower/);
  assert.match(source,/const dpr = Math\.min\(globalThis\.devicePixelRatio \|\| 1, 2\) \* auditScale;/);
  assert.doesNotMatch(source,/gl\.finish\(|gl\.readPixels\(/);
});

test("same-origin 4K harness parses and uses real wheel playback for its A/B matrix", () => {
  const html=readFileSync(new URL("../scripts/fixtures/4k-rotation-flicker.html",import.meta.url),"utf8");
  const source=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source);
  assert.doesNotThrow(()=>new Script(source,{filename:"4k-rotation-flicker.html"}));
  for(const mode of ["default","svg","fallback","high","preserve","half"]) {
    assert.match(html,new RegExp('value="'+mode+'"'));
  }
  assert.match(source,/win\.requestAnimationFrame\(step\)/);
  assert.match(source,/win\.__atlasRenderAudit\.snapshot\(\)/);
  assert.match(source,/button\.click\(\)/);
  assert.match(source,/frameTiming:summarize\(intervals\)/);
  assert.match(source,/actualDevicePixelRatio:win\.devicePixelRatio/);
});
