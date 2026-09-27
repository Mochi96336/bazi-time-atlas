import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RADII,WHEEL_CENTER} from "../src/wheel/ring-model.js";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const style=readFileSync(new URL("../radial-hierarchy.css",import.meta.url),"utf8");
const renderer=readFileSync(new URL("../src/wheel/kinetic-renderer.js",import.meta.url),"utf8");
const theme=readFileSync(new URL("../kinetic-atlas.css",import.meta.url),"utf8");
const shader=readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
const classification=readFileSync(new URL("../classification-overlay.css",import.meta.url),"utf8");

test("H2.8 joint ties both margins to canonical shared Solar/Zodiac longitude geometry",()=>{
  assert.equal(RADII.solarTermOuter,840);
  assert.equal(RADII.solarOuter,900);
  assert.deepEqual(WHEEL_CENTER,{x:600,y:1360});
  const blocks=[...html.matchAll(/<radialGradient id="m2-zodiac-shared-joint"([\s\S]*?)<\/radialGradient>/g)];
  assert.equal(blocks.length,1,"exactly one new material *joint*, not another independently positioned ring");
  const b=blocks[0][0];
  assert.match(b,/gradientUnits="userSpaceOnUse"/);
  assert.match(b,/cx="600" cy="1360" fx="600" fy="1360" r="900"/);
  const stops=[...b.matchAll(/<stop offset="([^"]+)" stop-color="([^"]+)" stop-opacity="([^"]+)"/g)]
    .map(m=>({offset:Number(m[1]),color:m[2],alpha:Number(m[3])}));
  assert.equal(stops.length,8);
  const relative=[0,.0833333,.216667,.383333,.666667,.833333,.933333,1];
  for(let i=0;i<stops.length;i++){
    const t=(stops[i].offset*RADII.solarOuter-RADII.solarTermOuter)/
      (RADII.solarOuter-RADII.solarTermOuter);
    assert.ok(Math.abs(t-relative[i])<.06,
      "joint stop must follow original annual 840–900 radius, not arbitrary clock");
    if(i)assert.ok(stops[i].offset>stops[i-1].offset);
  }
  assert.equal(stops[3].alpha,0);
  assert.equal(stops[4].alpha,0);
  assert.ok(stops.every(x=>x.alpha>=0&&x.alpha<=.25));
});

test("H2.8 has one narrow presentation joint in existing annual layer without another phase",()=>{
  assert.match(style,/\.m2-zodiac-shared-joint\s*\{[\s\S]*?fill:\s*url\(#m2-zodiac-shared-joint\);[\s\S]*?opacity:\s*\.82;[\s\S]*?stroke:\s*none;[\s\S]*?pointer-events:\s*none/);
  const d='const d = annularSectorPath(WHEEL_CENTER, model.innerRadius, outerRadius, FAN.start, FAN.end)';
  assert.ok(renderer.includes(d));
  assert.match(renderer,/if \(id === "zodiac"\)\s*\{\s*el\("path", \{\s*d,\s*class: "m2-zodiac-shared-joint"/);
  const p=renderer.indexOf('class: bedClass'),q=renderer.indexOf('class: "m2-zodiac-shared-joint"'),r=renderer.indexOf('class: responseClass');
  assert.ok(p>=0&&q>p&&r>q);
  assert.doesNotMatch(shader,/h28Zodiac|h28-zodiac|shared-joint/);
  assert.doesNotMatch(renderer,/h28ZodiacPose|zodiacPhaseAngle|h28Turn/);
});
test("H2.8 leaves all shipped B2 and category colors unchanged",()=>{
  for(const [name,value] of Object.entries({
    field:"#0a0d13","field-raised":"#0e121a",solar:"#ac906e",zodiac:"#424b59",
    hour:"#555d62",day:"#646c71",month:"#777f84",year:"#90989d",cursor:"#f4dda0"
  }))assert.match(theme,new RegExp("--"+name+":\\s*"+value+";"));
  assert.match(classification,/--classification-zodiac-outline:\s*#8f999d;/);
  assert.doesNotMatch(style,/h28-glow|h28-satin|h28-nebula/);
});
