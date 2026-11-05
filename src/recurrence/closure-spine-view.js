import {
  CLOSURE_FAN,CLOSURE_RINGS,CLOSURE_MILESTONES,CLOSURE_STEPS,
  closureStateForStep,closureRuns,closureCells
} from "./closure-spine-model.js";

const NS="http://www.w3.org/2000/svg";
const $=id=>document.getElementById(id);
const svg=$("closure-fan");
const bands=$("fan-bands"),cells=$("fan-cells"),datum=$("fan-datum");
const markers=$("fan-markers"),labels=$("fan-labels");
const startStep=Number(new URLSearchParams(location.search).get("step")??1);
let step=Number.isInteger(startStep)&&startStep>=0&&startStep<=CLOSURE_STEPS?startStep:1;
let interval=null;

function polar(radius,deg) {
  const a=deg*Math.PI/180;
  return {x:CLOSURE_FAN.cx+radius*Math.cos(a),y:CLOSURE_FAN.cy+radius*Math.sin(a)};
}
function attrs(tag,props,parent){
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(props))el.setAttribute(key,String(value));
  parent.append(el);
  return el;
}
function lineAt(inner,outer,angle,extra,parent) {
  const a=polar(inner,angle),b=polar(outer,angle);
  return attrs("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,...extra},parent);
}
function annulus(inner,outer,a,b) {
  const p1=polar(outer,a),p2=polar(outer,b),p3=polar(inner,b),p4=polar(inner,a);
  return `M ${p1.x} ${p1.y} A ${outer} ${outer} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${inner} ${inner} 0 0 0 ${p4.x} ${p4.y} Z`;
}
function arc(radius,a,b) {
  const p1=polar(radius,a),p2=polar(radius,b);
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}`;
}
function drawStatic() {
  // Flat monochrome annuli, no gradients, gaps or ornamental event track.
  const fills={day:"#202823",year:"#29312b",gregorian:"#343c34"};
  for(const ring of CLOSURE_RINGS) {
    attrs("path",{d:annulus(ring.inner,ring.outer,CLOSURE_FAN.start,CLOSURE_FAN.end),
      class:"fan-band",fill:fills[ring.key]},bands);
  }
  for(const cell of closureCells()) {
    attrs("path",{
      d:annulus(cell.inner,cell.outer,cell.startAngle+.06,cell.endAngle-.06),
      fill:fills[cell.ring],
      class:"fan-cell"+(cell.index%10===0?" major":""),
      "data-phase-cell":cell.index,
      "data-ring":cell.ring
    },cells);
  }
  for(const radius of [270,360,450,560]) {
    attrs("path",{d:arc(radius,CLOSURE_FAN.start,CLOSURE_FAN.end),class:"fan-arc"},datum);
  }
  // Two short datum stubs locate zero without drawing a false bridge
  // through a nonzero middle ring (the +8,000 year counterexample).
  lineAt(252,270,CLOSURE_FAN.zero,{class:"zero-guide"},datum);
  lineAt(560,590,CLOSURE_FAN.zero,{class:"zero-guide"},datum);
  const origin=polar(595,CLOSURE_FAN.zero);
  attrs("text",{x:origin.x,y:origin.y,class:"origin-title","text-anchor":"middle"},labels).textContent="基準 0";
  for(const ring of CLOSURE_RINGS) {
    const p=polar((ring.inner+ring.outer)/2,-148);
    attrs("text",{x:p.x,y:p.y,class:"ring-title","text-anchor":"middle"},labels).textContent=ring.title;
  }
}
const signedText=n=>n===0?"0":n>0?"+"+n:"−"+Math.abs(n);
function description(snapshot) {
  if(snapshot.allClosed)
    return snapshot.step===0?"起點：三圈共同歸零；尚未經過任何時間步進。":
      "第 60 步：三段接縫連成一條，三圈完整重合。";
  const closed=snapshot.rings.filter(r=>r.closed).map(r=>r.title).reverse();
  const open=snapshot.rings.filter(r=>!r.closed).map(r=>r.title).reverse();
  return "歸零：" +closed.join("、")+"；偏離："+open.join("、")+"。";
}
function drawSnapshot() {
  const snapshot=closureStateForStep(step);
  markers.replaceChildren();
  for(const ring of snapshot.rings) {
    if(ring.closed)continue;
    lineAt(ring.inner+12,ring.outer-12,ring.angle,{
      class:"phase-mark","data-ring-phase":ring.key,
      "data-phase-signed":ring.signed,"data-return-angle":ring.angle.toFixed(3)
    },markers);
  }
  // Closure is an actual uninterrupted geometry, *only* where touching
  // annuli have zero phase. At +8,000 the middle ring stays visibly broken.
  for(const run of closureRuns(snapshot)){
    lineAt(run.inner,run.outer,CLOSURE_FAN.zero,{
      class:"closure-run","data-closed-rings":run.keys.join(",")
    },markers);
  }
  $("current-time").textContent="Δ +"+snapshot.deltaYears.toLocaleString("en-US")+" 年";
  $("step-output").textContent="第 "+step+" / 60 步";
  $("geometry-caption").textContent=description(snapshot);
  svg.setAttribute("aria-label",description(snapshot));
  $("step-slider").value=String(step);
  for(const ring of snapshot.rings) {
    $("value-"+ring.key).textContent=signedText(ring.signed);
    const stateEl=$("state-"+ring.key);
    stateEl.textContent=ring.closed?"接到共同零點":"偏離共同零點";
    stateEl.classList.toggle("is-closed",ring.closed);
  }
  for(const button of document.querySelectorAll(".milestones button")) {
    button.setAttribute("aria-current",String(Number(button.dataset.step)===step));
  }
  $("previous-step").disabled=step===0;
  $("next-step").disabled=step===CLOSURE_STEPS;
  $("original-link").href="../recurrence.html?date=2026-09-13&delta="+snapshot.deltaYears+"#recurrence-instrument";
}
function stopPlayback() {
  if(interval!==null)clearInterval(interval);
  interval=null;
  $("play-steps").textContent="播放 400 年步進";
  $("play-steps").setAttribute("aria-pressed","false");
}
function setStep(next,{stop=true}={}) {
  if(stop)stopPlayback();
  const clamped=Math.max(0,Math.min(CLOSURE_STEPS,Math.round(next)));
  if(!Number.isFinite(clamped))return;
  step=clamped;
  drawSnapshot();
}
function togglePlayback(){
  if(interval!==null){stopPlayback();return;}
  if(step===CLOSURE_STEPS)setStep(0);
  $("play-steps").textContent="暫停";
  $("play-steps").setAttribute("aria-pressed","true");
  // Deliberate integer snapshots: shortest signed phase jumps at ±half-cycle.
  // Smooth interpolation would invent a false rotation through the fan.
  interval=setInterval(()=>{
    if(step>=CLOSURE_STEPS){stopPlayback();return;}
    setStep(step+1,{stop:false});
    if(step===CLOSURE_STEPS)stopPlayback();
  },360);
}
drawStatic();
drawSnapshot();
$("step-slider").addEventListener("input",event=>setStep(Number(event.target.value)));
$("previous-step").addEventListener("click",()=>setStep(step-1));
$("next-step").addEventListener("click",()=>setStep(step+1));
$("play-steps").addEventListener("click",togglePlayback);
document.querySelectorAll(".milestones button").forEach(button=>
  button.addEventListener("click",()=>setStep(Number(button.dataset.step)))
);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopPlayback()});
window.__closureSpineDebug=Object.freeze({snapshot:()=>closureStateForStep(step),setStep});
