import test from "node:test";
import assert from "node:assert/strict";
import {R22_SEMICIRCLE,r22EllipsePoint,r22EllipseSweep} from "../src/recurrence/r22-semicircle-geometry.js";
import {phaseAngleOnFan,phaseFanCells} from "../src/recurrence/phase-fan-geometry.js";
import {r22PhaseSnapshot} from "../src/recurrence/r22-phase-motion-model.js";

test("P6 is mathematically a COMPLETE 180-degree low ellipse, not the old 160-degree fan",()=>{
 const g=R22_SEMICIRCLE;
 assert.equal(g.fanStart,-180);assert.equal(g.fanEnd,0);
 assert.equal(g.fanEnd-g.fanStart,180);
 assert.ok(g.verticalScale<.8&&g.verticalScale>.5);
 assert.equal(g.centerAngle,-90);
 for(const radius of Object.values(g.radii)){
  const left=r22EllipsePoint(radius,-180);
  const top=r22EllipsePoint(radius,-90);
  const right=r22EllipsePoint(radius,0);
  assert.ok(Math.abs(left.x-(600-radius))<1e-8);
  assert.ok(Math.abs(right.x-(600+radius))<1e-8);
  assert.ok(Math.abs(top.x-600)<1e-8);
  assert.ok(Math.abs(left.y-820)<1e-8);
  assert.ok(Math.abs(right.y-820)<1e-8);
  assert.ok(Math.abs(top.y-(820-radius*g.verticalScale))<1e-8);
  assert.ok(r22EllipseSweep(radius).includes(" A "+radius+" "+Number((radius*g.verticalScale).toFixed(3))+" 0 0 1 "));
 }
 assert.equal(new Set(Object.values(g.radii)).size,3);
 assert.equal(g.radii.day,315);
 assert.equal(g.radii.year,405);
 assert.equal(g.radii.gregorian,505);
 assert.throws(()=>r22EllipsePoint(-1,-90),RangeError);
 assert.throws(()=>r22EllipseSweep(400,0,210),RangeError);
});

test("P6 zero stays at top; signed ±half period span full left/right ends",()=>{
 const g=R22_SEMICIRCLE;
 for(const modulus of [60,400]){
  const angle=phase=>phaseAngleOnFan({phase,modulus,fanStart:g.fanStart,fanEnd:g.fanEnd});
  assert.equal(angle(0),-90);
  assert.equal(angle(modulus/2),0);
  assert.ok(angle(modulus/2+1)<-170);
  assert.equal(angle(modulus-1),-90-90/(modulus/2));
  const cells=phaseFanCells({modulus,sectors:modulus===400?40:60,fanStart:g.fanStart,fanEnd:g.fanEnd});
  assert.equal(cells[0].startAngle,-180);
  assert.equal(cells.at(-1).endAngle,0);
 }
 const p=r22PhaseSnapshot({year:2026,month:9,day:13},1200);
 assert.deepEqual([p.fanStart,p.fanEnd,p.zeroDatumAngle],[-180,0,-90]);
 assert.equal(p.layers.gregorian.fanAngle,-90);
 assert.equal(p.layers.yearSequence.fanAngle,-90);
 assert.equal(p.layers.day.signed,-9);
 assert.equal(p.layers.day.fanAngle,-117);
 assert.equal(p.displaySemantics,"folded-shortest-signed-residue-not-rotation");
});
