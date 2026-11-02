import test from "node:test";
import assert from "node:assert/strict";
import {R22_ART_BANDS,R22_ART_MATERIALS,r22ArtMode,r22ArtGeometry} from "../src/recurrence/r22-art-direction.js";
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
 assert.deepEqual(bands.map(b=>[b.inner,b.outer]),[[270,360],[360,450],[450,560]]);
 for(let i=1;i<bands.length;i++) assert.equal(bands[i].inner,bands[i-1].outer);
 assert.equal(bands.at(-1).outer-bands[0].inner,290);
 assert.equal(R22_SEMICIRCLE.fanEnd-R22_SEMICIRCLE.fanStart,180);
 assert.equal(R22_SEMICIRCLE.verticalScale,.66);
 assert.equal(R22_ART_BANDS.day.inner,270);
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
