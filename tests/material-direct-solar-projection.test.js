import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  solarRegionWarmth, assertDirectPageSolarProjection
} from "../scripts/material-direct-solar-projection.mjs";

function material(r,g,b,width=50,height=50) {
  const rgb=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++){
    rgb[i*3]=r;rgb[i*3+1]=g;rgb[i*3+2]=b;
  }
  return {width,height,rgb};
}
const mask=new Uint8Array(50*50).fill(1);

test("direct-page Solar comparison preserves real B2/C3 warm signal",()=>{
  const webgl=solarRegionWarmth(material(70,58,48),mask);
  const svg=solarRegionWarmth(material(62,55,48),mask);
  assert.equal(webgl.pixels,2500);
  assert.equal(webgl.redMinusBlue,22);
  assert.equal(svg.redMinusBlue,14);
  const check=assertDirectPageSolarProjection(webgl,svg);
  assert.equal(check.passed,true);
  assert.equal(check.minimumWebglWarmth,8);
});

test("stale 300px nested-frame GPU projection cannot pass direct Solar gate",()=>{
  const unmodifiedSvg=solarRegionWarmth(material(62,55,48),mask);
  const staleGpu=solarRegionWarmth(material(23,25,27),mask);
  assert.throws(()=>assertDirectPageSolarProjection(staleGpu,unmodifiedSvg),
    /WebGL Solar lost its canonical warm annulus/);
  assert.throws(()=>assertDirectPageSolarProjection({
    ...unmodifiedSvg,pixels:2499
  },unmodifiedSvg),/Solar masks differ/);
});

test("not enough material mask pixels or malformed screenshots fail closed",()=>{
  assert.throws(()=>solarRegionWarmth(material(70,58,48),new Uint8Array(50*50)),
    /implausibly small/);
  assert.throws(()=>solarRegionWarmth(material(70,58,48),new Uint8Array(10)),
    /geometry mismatch/);
  assert.throws(()=>assertDirectPageSolarProjection({
    pixels:2500,redMean:70,blueMean:48,redMinusBlue:NaN
  },solarRegionWarmth(material(62,55,48),mask)),/invalid real-page/);
});

test("real-page visual runner checks Solar after the direct material captures",()=>{
  const source=readFileSync(new URL("../scripts/visual-check-material-ablation.mjs",import.meta.url),"utf8");
  assert.match(source,/solarRegionWarmth\(defaultPng, masks\.solar\)/);
  assert.match(source,/solarRegionWarmth\(svgPng, masks\.solar\)/);
  assert.match(source,/assertDirectPageSolarProjection/);
  assert.match(source,/material-svg-1440x900\.png/);
  assert.doesNotMatch(source,/mobileHarnessPath|home-h27-zodiac-frame/);
});
