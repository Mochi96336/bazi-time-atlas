import test from "node:test";
import assert from "node:assert/strict";
import {createR22GuidedPlaybackController} from "../src/recurrence/r22-guided-playback-controller.js";
import {r22TeachingStops} from "../src/recurrence/r22-phase-motion-model.js";

function clock(){
 let serial=0,now=0;
 const frames=new Map(),timers=new Map(),cancelled=[];
 const requestFrame=fn=>{const id=++serial;frames.set(id,fn);return id;};
 const cancelFrame=id=>{cancelled.push(id);frames.delete(id);};
 const setTimer=(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;};
 const clearTimer=id=>{cancelled.push(id);timers.delete(id);};
 const frame=advanceMs=>{
  now+=advanceMs;
  const [id,fn]=frames.entries().next().value??[];
  assert.ok(id,"no pending frame");frames.delete(id);fn(now);
 };
 const timer=()=>{
  const [id,entry]=timers.entries().next().value??[];
  assert.ok(id,"no pending timer");timers.delete(id);entry.fn();
  return entry.ms;
 };
 return {frames,timers,cancelled,requestFrame,cancelFrame,setTimer,clearTimer,frame,timer};
}
function buttons(){
 const button={attr:{},setAttribute(k,v){this.attr[k]=v;}};
 const icon={textContent:"▶"},label={textContent:"播放"};
 return {button,icon,label};
}
function make(options={}){
 let delta=options.initialDelta??0;
 let base=options.base??{year:2026,month:9,day:13};
 const records=[],stages=[],stops=[];
 const engine=clock(),ui=buttons();
 const controller=createR22GuidedPlaybackController({
  playButton:ui.button,playIcon:ui.icon,playLabel:ui.label,
  getDelta:()=>delta,setDelta:(v,opt)=>{delta=v;records.push({v,opt});},
  getStops:()=>r22TeachingStops(base),maxDelta:()=>24000,
  requestFrame:engine.requestFrame,cancelFrame:engine.cancelFrame,
  setTimer:engine.setTimer,clearTimer:engine.clearTimer,
  yearsPerSecond:20,approachYears:20,skipNoticeMs:600,holdMs:1600,
  getReducedMotion:()=>Boolean(options.reduced),
  onStageChange:s=>stages.push(s),onStop:s=>stops.push(s)
 });
 return {controller,engine,ui,records,stages,stops,get delta(){return delta;},
  setBase(v){base=v;},setDelta(v){delta=v;}};
}
function toHold(r){
 for(let guard=0;guard<12;guard++){
  if(r.controller.stage==="hold")return;
  if(r.controller.stage==="skip")r.engine.timer();
  else if(r.controller.stage==="approach"){
   r.engine.frame(0); // First frame may make no progression.
   if(r.controller.stage==="approach")r.engine.frame(1200);
  } else throw Error("unexpected stage "+r.controller.stage);
 }
 throw Error("failed to approach checkpoint");
}

test("R22 2026 teaching stops are clamped to exact milestones, not crossed on dropped frames",()=>{
 const r=make();r.controller.start();
 const expected=[400,1200,1980,8000,24000];
 assert.equal(r.ui.button.attr["aria-label"],"暫停時間推演");
 for(const year of expected){
  toHold(r);
  assert.equal(r.delta,year);
  assert.equal(r.stages.at(-1).stage,"hold");
  assert.equal(r.stages.at(-1).target,year);
  assert.equal(r.ui.label.textContent,"暫停");
  if(year!==24000){
   assert.equal(r.engine.timer(),1600);
  }
 }
 assert.equal(r.controller.playing,true,"final closure should remain visible during hold");
 assert.equal(r.engine.timer(),1600);
 assert.equal(r.controller.playing,false);
 assert.equal(r.controller.stage,"complete");
 assert.equal(r.delta,24000);
 assert.equal(r.ui.button.attr["aria-label"],"播放時間推演");
 assert.deepEqual(r.stops.at(-1),{commit:true,reason:"complete"});
 for(const year of expected){
  assert.ok(r.records.some(x=>x.v===year),"exact checkpoint "+year+" not emitted");
 }
 assert.ok(r.stages.some(x=>x.stage==="skip"&&x.from===0&&x.to===380));
 assert.ok(r.records.filter(x=>x.opt.source==="playback").every(x=>Number.isInteger(x.v)));
 assert.ok(r.records.filter(x=>x.opt.source==="playback").every(x=>x.opt.syncQuery===false));
});

test("R22 pause in pending skip cancels timer, and a stale callback cannot restart playback",()=>{
 const r=make();r.controller.start();
 assert.equal(r.controller.stage,"skip");
 const [,old]=r.engine.timers.entries().next().value;
 assert.equal(r.delta,380);
 r.controller.stop({commit:false,reason:"manual-takeover"});
 assert.equal(r.controller.playing,false);
 assert.equal(r.controller.stage,"idle");
 assert.equal(r.engine.timers.size,0);
 assert.equal(r.engine.frames.size,0);
 const recorded=r.records.length;
 old.fn();
 assert.equal(r.records.length,recorded);
 assert.equal(r.controller.playing,false);
 assert.deepEqual(r.stops,[{commit:false,reason:"manual-takeover"}]);
 r.setDelta(960);
 r.controller.start();
 assert.equal(r.controller.target,1200);
 assert.equal(r.delta,1180);
});

test("R22 pausing a milestone hold cannot auto-restart after timer cancellation",()=>{
 const r=make();r.controller.start();toHold(r);
 const [,old]=r.engine.timers.entries().next().value;
 r.controller.toggle();
 assert.equal(r.controller.playing,false);
 assert.equal(r.controller.stage,"idle");
 old.fn();
 assert.equal(r.controller.playing,false);
 assert.equal(r.delta,400);
 r.controller.start();
 assert.equal(r.controller.target,1200);
});

test("R22 base changes recompute local Year+Day stop instead of retaining +1980",()=>{
 const r=make();r.controller.start();
 r.controller.stop({commit:false});r.setBase({year:2100,month:3,day:1});
 r.setDelta(8000);
 r.controller.start();
 assert.equal(r.controller.target,16080);
 assert.equal(r.delta,16060);
 r.controller.stop({commit:false});
 r.setBase({year:1900,month:3,day:1});
 r.setDelta(1200);r.controller.start();
 assert.equal(r.controller.target,6180);
 assert.equal(r.delta,6160);
});

test("R22 reduced-motion mode steps to one exact milestone per click; no animation or timers",()=>{
 const r=make({reduced:true});const expected=[400,1200,1980,8000,24000];
 for(const year of expected){
  r.controller.toggle();
  assert.equal(r.delta,year);
  assert.equal(r.controller.playing,false);
  assert.equal(r.controller.stage,"step");
  assert.equal(r.stages.at(-1).target,year);
  assert.equal(r.engine.frames.size,0);
  assert.equal(r.engine.timers.size,0);
  assert.equal(r.records.at(-1).opt.syncQuery,true);
 }
 r.controller.toggle();
 assert.equal(r.delta,400,"restart from first milestone after resetting at +24000");
 assert.ok(r.records.some(x=>x.v===0&&x.opt.source==="playback-reset"));
});

test("R22 APIs reject impossible speeds, use the supplied original button, and stop idempotently",()=>{
 const r=make();
 r.controller.stop({commit:false});
 assert.equal(r.stops.length,0);
 assert.equal(r.ui.button.attr["aria-pressed"],"false");
 assert.throws(()=>createR22GuidedPlaybackController({}),TypeError);
 assert.throws(()=>createR22GuidedPlaybackController({
  getDelta:()=>0,setDelta:()=>{},getStops:()=>[],maxDelta:()=>24000,
  requestFrame:()=>{},cancelFrame:()=>{},setTimer:()=>{},clearTimer:()=>{},
  yearsPerSecond:0
 }),RangeError);
});
