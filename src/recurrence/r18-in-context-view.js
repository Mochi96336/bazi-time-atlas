import { buildClosureJourney,classifyJourneyPoint } from "./r18-closure-journey.js";

const NS="http://www.w3.org/2000/svg";
const C={text:"#ebf0ee",muted:"#a8b9bb",line:"#536569",year:"#eac78a",day:"#b5a4d8",all:"#6ecac8"};
let key=null,journey=null,previousMobile=null;
const isMobile=()=>matchMedia("(max-width:680px)").matches;
const fmt=n=>n.toLocaleString("en-US");
function add(svg,tag,attrs,content){
 const n=svg.ownerDocument.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
 if(content!==undefined)n.textContent=content;
 svg.append(n);return n;
}
function baseSvg(svg,start,end,height,mobile){
 const w=mobile?340:800,left=mobile?104:175,right=w-18,y=height-33;
 const x=d=>left+(right-left)*(d-start)/(end-start);
 svg.replaceChildren();
 svg.setAttribute("viewBox","0 0 "+w+" "+height);
 svg.dataset.axisUnit="elapsed-years";
 svg.dataset.startYear=String(start);svg.dataset.endYear=String(end);
 add(svg,"line",{x1:left,y1:y,x2:right,y2:y,stroke:C.line,opacity:.6});
 const ticks=start===0&&end===24000?[0,8000,16000,24000]:
  [0,.25,.5,.75,1].map(f=>start+Math.round((end-start)*f));
 for(const d of [...new Set(ticks)]){
  const px=x(d);
  add(svg,"line",{x1:px,y1:y-4,x2:px,y2:y+4,stroke:C.line});
  add(svg,"text",{x:px,y:y+19,fill:C.muted,"font-size":12,
    "text-anchor":d===start?"start":d===end?"end":"middle"},fmt(d));
 }
 return {x,y};
}
function overview(svg,model,mobile){
 const {x,y}=baseSvg(svg,0,24000,334,mobile);
 // Every endpoint is an actual recurrence event; the dashed portion is
 // elapsed time towards first closure, never a continuously-held condition.
 const lanes=[
  {at:1200,y:63,label:"公曆＋年序",note:"首次 +1,200",color:C.year,events:model.overview.gregorianYear},
  {at:model.firstLocal,y:125,label:"年序＋日序",note:"局部 +"+fmt(model.firstLocal),
    color:C.day,events:[],local:true},
  {at:8000,y:187,label:"公曆＋日序",note:"首次 +8,000",color:C.day,events:model.overview.gregorianDay},
  {at:24000,y:249,label:"三項共同",note:"首次 +24,000",color:C.all,events:model.overview.all}
 ];
 for(const lane of lanes){
  add(svg,"text",{x:8,y:lane.y-12,fill:C.text,"font-size":mobile?13:15},lane.label);
  add(svg,"text",{x:8,y:lane.y+8,fill:C.muted,"font-size":12},lane.note);
  add(svg,"line",{x1:x(0),y1:lane.y,x2:x(24000),y2:lane.y,stroke:C.line,opacity:.2});
  if(lane.at===null)continue;
  add(svg,"line",{x1:x(0),y1:lane.y,x2:x(lane.at),y2:lane.y,
    stroke:C.muted,opacity:.68,"stroke-dasharray":"2 6"});
  add(svg,"circle",{cx:x(lane.at),cy:lane.y,r:mobile?6:8,fill:"none",
    stroke:lane.color,"stroke-width":2,"data-r18-first-closure":lane.at,
    ...(lane.local?{"data-r18-local-marker":lane.at}:{})});
  add(svg,"circle",{cx:x(lane.at),cy:lane.y,r:3,fill:lane.color});
  for(const d of lane.events)if(d>lane.at)
   add(svg,"circle",{cx:x(d),cy:lane.y,r:mobile?1.7:2.4,fill:lane.color,opacity:.5});
 }
 svg.dataset.graphGrammar="independent-event-lanes";
 svg.dataset.cursorPlacement="axis-only";
 svg.dataset.ready="true";
}
function local(svg,model,mobile){
 const {x}=baseSvg(svg,model.detailStart,model.detailEnd,206,mobile);
 for(const row of [
  {label:"年序",y:60,values:model.detail.year,color:C.year},
  {label:"日序",y:109,values:model.detail.day,color:C.day},
  {label:"兩者重遇",y:158,values:model.detail.yearDay,color:C.text}
 ]){
  add(svg,"text",{x:8,y:row.y+3,fill:C.text,"font-size":mobile?13:15},row.label);
  add(svg,"line",{x1:x(model.detailStart),y1:row.y,x2:x(model.detailEnd),y2:row.y,
    stroke:C.line,opacity:.25});
  for(const d of row.values){
   const major=d===model.firstLocal;
   add(svg,"line",{x1:x(d),y1:row.y-(major?8:4),x2:x(d),y2:row.y+(major?8:4),
    stroke:major?C.text:row.color,"stroke-width":major?3:1.5,opacity:major?1:.72,
    "data-r18-event":d});
  }
 }
 svg.dataset.ready="true";
}
function cursor(svg,delta,_top,_bottom){
 svg.querySelectorAll("[data-r18-cursor]").forEach(n=>n.remove());
 const start=Number(svg.dataset.startYear),end=Number(svg.dataset.endYear);
 if(delta<start||delta>end)return;
 const box=svg.viewBox.baseVal,w=box.width,left=w===340?104:175,right=w-18;
 const px=left+(right-left)*(delta-start)/(end-start);
 // The observation marker occupies only the axis band, so it NEVER covers
 // recurrence circles, including +1,200 and the baseline-dependent +1,980.
 const cy=box.height-33;
 add(svg,"path",{d:"M "+px+" "+(cy-19)+" l -6 -10 h 12 Z",
  fill:C.text,stroke:"none","data-r18-cursor":"true",
  "data-r18-selected-year":delta,"data-r18-readhead":"axis-only"});
 add(svg,"line",{x1:px,y1:cy-18,x2:px,y2:cy+2,stroke:C.text,"stroke-width":2,
  "data-r18-cursor":"true","data-r18-readhead":"axis-only"});
}
/** Only the base date invalidates the 24k event cache; the normal Δ path repaints cursors. */
export function renderR18Context(root,state){
 if(!root||!state)throw new TypeError("canonical R18 state required");
 const d=state.baseDate,next=[d.year,d.month,d.day].join("-");
 const mobile=isMobile();
 const repaint=key!==next||previousMobile!==mobile;
 if(key!==next){
  key=next;journey=null;
  try{journey=buildClosureJourney(d);}catch(error){
   root.dataset.r18Ready="unavailable";
   root.querySelector("#r18-context-headline").textContent="此基準日期無法完整推算 24,000 年";
   root.querySelector("#r18-context-detail").textContent=error.message;
   root.querySelectorAll("svg").forEach(n=>n.replaceChildren());
   return null;
  }
 }
 // Keep the unavailable status stable across subsequent Δ events on the same
 // out-of-range baseline; never dereference a null journey.
 if(!journey)return null;
 const overviewSvg=root.querySelector("#r18-context-overview");
 const localSvg=root.querySelector("#r18-context-local");
 if(repaint){
  overview(overviewSvg,journey,mobile);
  local(localSvg,journey,mobile);
  root.dataset.r18OverviewPaints=String((Number(root.dataset.r18OverviewPaints)||0)+1);
 }
 previousMobile=mobile;
 cursor(overviewSvg,state.deltaYears,46,253);
 cursor(localSvg,state.deltaYears,40,171);
 const classified=state.deltaYears<=24000?classifyJourneyPoint(journey,state.deltaYears):null;
 root.querySelector("#r18-context-headline").textContent=
  classified?.headline??"超出圖示 24,000 年的比較範圍";
 root.querySelector("#r18-context-detail").textContent=
  classified?.detail??"離散相位仍由正式時間模型判讀。";
 root.querySelector("#r18-context-current").textContent="選取 Δ "+fmt(state.deltaYears)+" 年";
 root.querySelector("#r18-context-local-label").textContent=
  "局部 "+fmt(journey.detailStart)+"～"+fmt(journey.detailEnd)+" 年 · 首次年＋日 +"+fmt(journey.firstLocal);
 root.querySelector("#r18-context-local-note").textContent=
  "紫色節點是這個基準日期的首次年＋日重遇（+"+fmt(journey.firstLocal)+"）；白色三角形位在時間軸下方，表示目前選取的 Δ。";
 const localButton=root.querySelector('[data-r19-delta="local"]');
 if(localButton){
  localButton.textContent="局部 +"+fmt(journey.firstLocal);
  localButton.disabled=journey.firstLocal===null;
 }
 root.querySelectorAll("[data-r19-delta]").forEach(button=>{
  const value=button.dataset.r19Delta==="local"?journey.firstLocal:Number(button.dataset.r19Delta);
  button.setAttribute("aria-pressed",String(value===state.deltaYears));
 });
 overviewSvg.setAttribute("aria-label","真實 Δ 年份：公曆＋年序首次 1,200；年序＋日序首次 "+
  fmt(journey.firstLocal)+"；公曆＋日序首次 8,000；三項共同首次 24,000。"+
  "目前選取 "+fmt(state.deltaYears)+" 年，讀頭不覆蓋任何事件。");
 localSvg.setAttribute("aria-label","依基準日期移動的局部時間窗 "+
  fmt(journey.detailStart)+" 至 "+fmt(journey.detailEnd)+" 年；首次年序日序重遇 "+
  fmt(journey.firstLocal)+" 年，目前選取 "+fmt(state.deltaYears)+" 年。");
 root.dataset.r18Ready="true";
 root.dataset.r18BaseDate=next;
 root.dataset.r18FirstLocal=String(journey.firstLocal);
 root.dataset.r18DetailStart=String(journey.detailStart);
 root.dataset.r18DetailEnd=String(journey.detailEnd);
 root.dataset.r18SelectedDelta=String(state.deltaYears);
 root.dataset.r18Model="recurrenceState";
 root.dataset.r18EventCache=key;
 return classified;
}
