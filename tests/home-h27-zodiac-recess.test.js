import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {RADII,WHEEL_CENTER} from "../src/wheel/ring-model.js";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const style=readFileSync(new URL("../radial-hierarchy.css",import.meta.url),"utf8");
const renderer=readFileSync(new URL("../src/wheel/kinetic-renderer.js",import.meta.url),"utf8");
const theme=readFileSync(new URL("../kinetic-atlas.css",import.meta.url),"utf8");
const shader=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
const classification=readFileSync(new URL("../classification-overlay.css",import.meta.url),"utf8");
test("H2.7 C3 uses the native-probed canonical 840–900 one-annual-coordinate band",()=>{
  assert.equal(RADII.solarTermOuter,840);
  assert.equal(RADII.solarOuter,900);
  assert.deepEqual(WHEEL_CENTER,{x:600,y:1360});
  const block=html.match(/<radialGradient id="m2-zodiac-inset-recess"([\s\S]*?)<\/radialGradient>/);
  assert.ok(block,"single fixed-world recess gradient required");
  assert.equal((html.match(/id="m2-zodiac-inset-recess"/g)||[]).length,1);
  assert.match(block[0],/gradientUnits="userSpaceOnUse"/);
  assert.match(block[0],/cx="600" cy="1360" r="900" fx="600" fy="1360"/);
  const stops=[...block[0].matchAll(/<stop offset="([^"]+)" stop-color="([^"]+)" stop-opacity="([^"]+)"/g)]
    .map(m=>({offset:Number(m[1]),color:m[2],alpha:Number(m[3])}));
  assert.deepEqual(stops.map(s=>s.color),
    ["#070c13","#53606c","#2f3b47","#27313d","#131d27","#080e16"]);
  assert.deepEqual(stops.map(s=>s.alpha),[.34,.24,.34,.38,.49,.55]);
  for(const [i,t] of [0,.13,.35,.66,.89,1].entries()){
    const canonicalOffset=(RADII.solarTermOuter+
      (RADII.solarOuter-RADII.solarTermOuter)*t)/RADII.solarOuter;
    assert.ok(Math.abs(stops[i].offset-canonicalOffset)<1e-10);
  }
});
test("C3 is exactly one 54% inert substrate underlay, no extra sector/clock",()=>{
  assert.match(style,/\.m2-zodiac-inset-recess\s*\{[\s\S]*?fill:\s*url\(#m2-zodiac-inset-recess\);[\s\S]*?opacity:\s*\.54;[\s\S]*?stroke:\s*none;[\s\S]*?pointer-events:\s*none;/);
  assert.match(renderer,/const d = annularSectorPath\(WHEEL_CENTER, model\.innerRadius, outerRadius, FAN\.start, FAN\.end\)/);
  assert.match(renderer,/if \(id === "zodiac"\)\s*\{\s*el\("path", \{\s*d,\s*class: "m2-zodiac-inset-recess",\s*"data-annual-material-inset": "zodiac",\s*"aria-hidden": "true"/);
  assert.ok(renderer.indexOf('class: bedClass')<renderer.indexOf('class: "m2-zodiac-inset-recess"'));
  assert.ok(renderer.indexOf('class: "m2-zodiac-inset-recess"')<renderer.indexOf('class: responseClass'));
  assert.doesNotMatch(renderer,/h27ZodiacPose|zodiacPhaseAngle|h27Turn/);
  assert.doesNotMatch(shader,/h27Zodiac|h27-zodiac/);
});
test("H2.7 C3 keeps the B2 field, warmer Solar, graphite and categorical authority",()=>{
  for(const [name,value]of Object.entries({
    field:"#0a0d13","field-raised":"#0e121a",solar:"#ac906e",zodiac:"#424b59",
    hour:"#555d62",day:"#646c71",month:"#777f84",year:"#90989d",
    cursor:"#f4dda0"
  }))assert.match(theme,new RegExp("--"+name+":\\s*"+value+";"));
  assert.match(classification,/--classification-zodiac-outline:\s*#8f999d;/);
  assert.ok(!html.includes("h27ZodiacTint"));
  assert.ok(!style.includes("h27-glow"));
  assert.ok(!renderer.includes("h27ZodiacTint"));
});
