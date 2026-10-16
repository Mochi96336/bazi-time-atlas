import { SEASONAL_DRIFT_26026_RESEARCH as DATA, indexForLongitude } from "../src/research/seasonal-drift-26026-research-data.js";
import { BAZI_JIE_BOUNDARIES, baziJieDriftSummary } from "../src/research/bazi-seasonal-boundaries.js";

const NS="http://www.w3.org/2000/svg";
const summary=baziJieDriftSummary(DATA.driftDays,indexForLongitude);
const rows=summary.rows.map(row=>({
  ...row,
  advanceDays:-row.driftDays
}));
const meanAdvance=-DATA.meanDriftDays;

function svgEl(tag,attrs,parent,text){
  const node=document.createElementNS(NS,tag);
  Object.entries(attrs||{}).forEach(([key,value])=>node.setAttribute(key,String(value)));
  if(text!=null)node.textContent=text;
  parent.appendChild(node);
  return node;
}
function clear(svg,viewBox){svg.replaceChildren();svg.setAttribute("viewBox",viewBox)}
function polar(cx,cy,r,degrees){
  const a=degrees*Math.PI/180;
  return {x:cx+Math.cos(a)*r,y:cy-Math.sin(a)*r};
}
function signed(value,digits=2){
  if(Math.abs(value)<0.0005)return "0 d";
  return (value>0?"+":"−")+Math.abs(value).toFixed(digits)+" d";
}
function advanceText(value,digits=3){return "提前 "+value.toFixed(digits)+" 天"}

function renderSummary(){
  document.querySelector("#zero-count").textContent=summary.displacedCount+" / "+summary.count;
  const range=advanceText(summary.minAdvanceDays)+"–"+summary.maxAdvanceDays.toFixed(3)+" 天";
  document.querySelector("#zero-range").textContent=range;
  document.querySelector("#ring-range").textContent=range;
  document.querySelector("#mean-advance").textContent=advanceText(meanAdvance);
  document.querySelector("#shape-span").textContent=DATA.peakToPeakDays.toFixed(3)+" d peak-to-peak";
}

function drawZero(){
  const svg=document.querySelector("#zero-proof-svg");
  clear(svg,"0 0 1080 390");
  const left=72,right=28,top=56,bottom=84,max=15;
  const width=1080-left-right,height=390-top-bottom;
  [0,5,10,15].forEach(tick=>{
    const y=top+(tick/max)*height;
    svgEl("line",{x1:left,x2:1080-right,y1:y,y2:y,class:tick===0?"lab-zero":"lab-grid"},svg);
    svgEl("text",{x:left-12,y:y+4,"text-anchor":"end",class:"lab-axis-label"},svg,tick===0?"0 = 重合":tick+" d");
  });
  rows.forEach((row,index)=>{
    const x=left+(index+.5)/rows.length*width;
    const y=top+(row.advanceDays/max)*height;
    svgEl("line",{x1:x,x2:x,y1:top,y2:y,class:"lab-boundary-line"},svg);
    svgEl("circle",{cx:x,cy:y,r:row.yearBoundary?7:5,class:"lab-boundary-dot"+(row.yearBoundary?" is-year":"")},svg);
    svgEl("text",{x,y:y+18,"text-anchor":"middle",class:"lab-boundary-value"},svg,row.advanceDays.toFixed(1));
    svgEl("text",{x,y:390-bottom+38,"text-anchor":"middle",class:"lab-term-label"},svg,row.termName);
  });
}

function ellipseRadius(parameters,longitude,exaggeration){
  const e=Math.min(.35,parameters.eccentricity*exaggeration);
  const theta=longitude*Math.PI/180;
  const peri=parameters.perihelionSolarLongitudeDegrees*Math.PI/180;
  return (1-e*e)/(1+e*Math.cos(theta-peri));
}
function orbitPath(cx,cy,baseR,parameters,exaggeration){
  const pts=[];
  for(let longitude=0;longitude<=360;longitude+=3){
    const angle=(longitude+180)*Math.PI/180;
    const r=ellipseRadius(parameters,longitude%360,exaggeration)*baseR;
    const x=cx+Math.cos(angle)*r;
    const y=cy-Math.sin(angle)*r;
    pts.push((longitude===0?"M ":"L ")+x.toFixed(2)+" "+y.toFixed(2));
  }
  return pts.join(" ")+" Z";
}
function arcPath(cx,cy,r,startDeg,endDeg){
  const span=endDeg-startDeg;
  const steps=Math.max(3,Math.ceil(Math.abs(span)/2));
  const pts=[];
  for(let i=0;i<=steps;i++){
    const p=polar(cx,cy,r,startDeg+span*i/steps);
    pts.push((i===0?"M ":"L ")+p.x.toFixed(2)+" "+p.y.toFixed(2));
  }
  return pts.join(" ");
}
function drawRing(){
  const svg=document.querySelector("#solar-ring-svg");
  clear(svg,"0 0 1080 430");
  const cx=540,cy=220,orbitR=112,timeR=178;
  svgEl("circle",{cx,cy,r:timeR,class:"lab-reference-ring"},svg);
  svgEl("path",{d:orbitPath(cx,cy,orbitR,DATA.baseEllipse,10),class:"lab-orbit-base"},svg);
  svgEl("path",{d:orbitPath(cx,cy,orbitR,DATA.targetEllipse,10),class:"lab-orbit-target"},svg);
  svgEl("circle",{cx,cy,r:9,class:"lab-sun"},svg);
  svgEl("text",{x:cx,y:cy-18,"text-anchor":"middle",class:"lab-center-kicker"},svg,"同一太陽黃經");
  svgEl("text",{x:cx,y:cy+34,"text-anchor":"middle",class:"lab-center-value"},svg,"到達時間提前");
  rows.forEach(row=>{
    const baseAngle=90-row.longitudeDegrees;
    const shift=row.advanceDays*(360/365.2425);
    const targetAngle=baseAngle+shift;
    const spokeA=polar(cx,cy,orbitR+18,baseAngle);
    const spokeB=polar(cx,cy,timeR-10,baseAngle);
    svgEl("line",{x1:spokeA.x,y1:spokeA.y,x2:spokeB.x,y2:spokeB.y,class:"lab-spoke"},svg);
    const base1=polar(cx,cy,timeR-6,baseAngle);
    const base2=polar(cx,cy,timeR+6,baseAngle);
    svgEl("line",{x1:base1.x,y1:base1.y,x2:base2.x,y2:base2.y,class:"lab-time-base"},svg);
    svgEl("path",{d:arcPath(cx,cy,timeR,baseAngle,targetAngle),class:"lab-time-arc"},svg);
    const target=polar(cx,cy,timeR,targetAngle);
    svgEl("circle",{cx:target.x,cy:target.y,r:4,class:"lab-time-target"},svg);
    const label=polar(cx,cy,timeR+28,baseAngle);
    svgEl("text",{x:label.x,y:label.y+3,"text-anchor":Math.abs(label.x-cx)<18?"middle":label.x<cx?"end":"start",class:"lab-ring-label"},svg,row.termName);
  });
}

function drawResidual(){
  const svg=document.querySelector("#shape-residual-svg");
  clear(svg,"0 0 760 360");
  const left=104,right=36,top=34,bottom=26;
  const width=760-left-right,rowH=(360-top-bottom)/rows.length;
  const min=-2.5,max=2.5;
  const xFor=value=>left+(value-min)/(max-min)*width;
  [-2,-1,0,1,2].forEach(tick=>{
    const x=xFor(tick);
    svgEl("line",{x1:x,x2:x,y1:top-8,y2:360-bottom,class:tick===0?"lab-residual-zero":"lab-grid"},svg);
    svgEl("text",{x,y:20,"text-anchor":"middle",class:"lab-axis-label"},svg,signed(tick,0));
  });
  rows.forEach((row,index)=>{
    const residual=row.advanceDays-meanAdvance;
    const y=top+(index+.5)*rowH;
    svgEl("text",{x:left-12,y:y+3,"text-anchor":"end",class:"lab-term-label"},svg,row.termName);
    svgEl("line",{x1:xFor(0),x2:xFor(residual),y1:y,y2:y,class:"lab-residual-line"},svg);
    svgEl("circle",{cx:xFor(residual),cy:y,r:4,class:"lab-residual-dot"},svg);
  });
}

const params=new URLSearchParams(location.search);
const allowed=new Set(["zero","ring","decompose"]);
const requested=params.get("direction")||"zero";
const direction=allowed.has(requested)?requested:"zero";
document.querySelectorAll(".diagram-direction").forEach(section=>section.classList.toggle("is-active",section.dataset.direction===direction));
document.querySelectorAll("[data-direction-link]").forEach(link=>{
  const active=link.dataset.directionLink===direction;
  link.classList.toggle("is-active",active);
  if(active)link.setAttribute("aria-current","page");
});
renderSummary();
drawZero();
drawRing();
drawResidual();
const claim=document.createElement("p");
claim.className="claim-boundary";
claim.textContent=DATA.claimBoundary.targetYearFrameIndependentlyValidated
  ?"target-year frame independently validated"
  :"研究邊界：year 26026 frame 尚未在目標年獨立驗證；圖解不把 research result 畫成 production authority。";
document.querySelector(".diagram-direction.is-active")?.appendChild(claim);
document.documentElement.dataset.diagramLabReady="true";
document.documentElement.dataset.diagramDirection=direction;