import test from "node:test";
import assert from "node:assert/strict";
import {R22_ART_BANDS,R22_QUIET_BANDS,R22_ART_MATERIALS,R22_ART_FINISHES,r22ArtMode,r22ArtFinish,r22ArtBandsForFinish,r22ArtGeometry} from "../src/recurrence/r22-art-direction.js";
import {R22_SEMICIRCLE} from "../src/recurrence/r22-semicircle-geometry.js";

test("P10 tests ONLY explicit art opt-in; default R22 and R16 are unaffected",()=>{
 assert.equal(r22ArtMode(""),"");
 assert.equal(r22ArtMode("graphite"),"graphite");
 assert.equal(r22ArtMode("warm"),"warm");
 assert.equal(r22ArtMode("rainbow"),"");
 assert.equal(r22ArtMode("gap"),"");
});
test("P10 three sculpted bands have ZERO radial air gap",()=>{
 const bands=r22ArtGeometry();
 assert.deepEqual(bands.map(b=>b.key),["day","year","gregorian"]);
 assert.deepEqual(bands.map(b=>[b.inner,b.outer]),[[410,460],[460,510],[510,560]]);
 for(let i=1;i<bands.length;i++) assert.equal(bands[i].inner,bands[i-1].outer);
 assert.equal(bands.at(-1).outer-bands[0].inner,150);
 assert.equal(R22_SEMICIRCLE.fanEnd-R22_SEMICIRCLE.fanStart,180);
 assert.equal(R22_SEMICIRCLE.verticalScale,.66);
 assert.equal(R22_ART_BANDS.day.inner,410);
});
test("P10 material palettes are a family, not original purple/bronze/teal trifecta",()=>{
 const blueHue=/#(?:78aabd|aa97c8|c5a96f)/i;
 for(const palette of Object.values(R22_ART_MATERIALS)){
  for(const key of ["day","year","gregorian"]){
   const stops=palette[key];
   assert.equal(stops.length,3);
   stops.forEach(hex=>{
    assert.match(hex,/^#[0-9a-f]{6}$/i);
    assert.ok(!blueHue.test(hex));
   });
  }
  assert.match(palette.seam,/^#[0-9a-f]{6}$/i);
  assert.match(palette.marker,/^#[0-9a-f]{6}$/i);
 }
});

test("P10.1 finishes require explicit graphite art mode, never affect warm/P7/R16",()=>{
 for(const finish of ["bevel","satin","monolith","quiet"]){
  assert.equal(r22ArtFinish(finish,"graphite"),finish);
  assert.equal(r22ArtFinish(finish,"warm"),"");
  assert.equal(r22ArtFinish(finish,""),"");
 }
 assert.equal(r22ArtFinish("unknown","graphite"),"");
 assert.equal(r22ArtFinish(null,"graphite"),"");
});
test("P10.1 shared world-space illumination uses one 5-stop palette per finish",()=>{
 assert.equal(Object.keys(R22_ART_FINISHES).length,4);
 for(const [mode,spec] of Object.entries(R22_ART_FINISHES)){
  if(mode==="monolith"||mode==="quiet"){
   assert.deepEqual(Object.keys(spec.radial),["cx","cy","r","transform"]);
   assert.ok(spec.radial.r>0);
   assert.match(spec.radial.transform,/^matrix\(/);
  }else{
   assert.equal(spec.axis.length,4);
   assert.ok(spec.axis[0]<spec.axis[2]);
  }
  assert.equal(spec.colors.length,5);
  spec.colors.forEach(color=>assert.match(color,/^#[0-9a-f]{6}$/i));
 }
 assert.deepEqual(r22ArtGeometry().map(b=>[b.inner,b.outer]),[[410,460],[460,510],[510,560]]);
});

// Same palette and light field, different distribution of radial space.
test("P10.3 quiet hierarchy keeps 150 units total and zero seams",()=>{
 const quiet=r22ArtGeometry("quiet");
 assert.deepEqual(quiet.map(b=>[b.inner,b.outer]),[[410,466],[466,515],[515,560]]);
 assert.deepEqual(quiet.map(b=>b.outer-b.inner),[56,49,45]);
 assert.equal(quiet.at(-1).outer-quiet[0].inner,150);
 for(let i=1;i<quiet.length;i++)assert.equal(quiet[i-1].outer,quiet[i].inner);
 assert.equal(r22ArtBandsForFinish("quiet"),R22_QUIET_BANDS);
 assert.equal(r22ArtBandsForFinish("monolith"),R22_ART_BANDS);
 assert.deepEqual(R22_ART_FINISHES.quiet.radial,R22_ART_FINISHES.monolith.radial);
 assert.deepEqual(R22_ART_FINISHES.quiet.colors,R22_ART_FINISHES.monolith.colors);
 assert.deepEqual(r22ArtGeometry().map(b=>[b.inner,b.outer]),[[410,460],[460,510],[510,560]]);
});
