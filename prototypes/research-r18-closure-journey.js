import { buildClosureJourney,classifyJourneyPoint } from "../src/recurrence/r18-closure-journey.js";
import { projectUnfoldedPhases } from "../src/recurrence/r17-unfolded-phase-projection.js";
import { validateGregorianDate } from "../src/recurrence/gregorian-cycle.js";
const query=new URLSearchParams(location.search);
const dateMatch=/^(\d{4,7})-(\d{2})-(\d{2})$/.exec(query.get("date")??"2026-09-13");
const parsedDate=dateMatch&&{year:Number(dateMatch[1]),month:Number(dateMatch[2]),day:Number(dateMatch[3])};
const base=parsedDate&&validateGregorianDate(parsedDate)&&parsedDate.year+24000<=10000000
 ?parsedDate:{year:2026,month:9,day:13};
const model=buildClosureJourney(base);
const svgNS="http://www.w3.org/2000/svg";
const colors={g:"#6ecac8",year:"#eac78a",day:"#b5a4d8",both:"#f1f5f2",muted:"#a9babd",line:"#52646a"};
const requestedDelta=query.has("delta")?Number(query.get("delta")):model.firstLocal??0;
let selected=Number.isInteger(requestedDelta)&&requestedDelta>=0&&requestedDelta<=24000
 ?requestedDelta:model.firstLocal??0;
let variant=query.get("variant")==="gates"?"gates":"lanes";
const mobile=()=>matchMedia("(max-width:680px)").matches;
const format=d=>d.toLocaleString("en-US");
function put(svg,tag,attrs,content){
 const n=document.createElementNS(svgNS,tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
 if(content!==undefined)n.textContent=content;
 svg.append(n);return n;
}
function text(svg,x,y,label,{size=13,color=colors.muted,anchor="start",weight=400}={}){
 return put(svg,"text",{x,y,fill:color,"font-size":size,"font-weight":weight,"text-anchor":anchor},label);
}
function line(svg,x1,y1,x2,y2,{color=colors.line,width=1,opacity=1,dash=null}={}){
 const attrs={x1,y1,x2,y2,stroke:color,"stroke-width":width,opacity};
 if(dash)attrs["stroke-dasharray"]=dash;
 return put(svg,"line",attrs);
}
function geom(svg,{range,bottom,startYear=0}){
 const isPhone=mobile(),W=isPhone?370:1000, x0=isPhone?103:212,x1=W-(isPhone?18:33);
 svg.replaceChildren();
 svg.setAttribute("viewBox","0 0 "+W+" "+bottom);
 const x=d=>x0+(x1-x0)*(d-startYear)/range;
 const axisY=bottom-36;
 const ticks=range===24000?[0,4000,8000,12000,16000,20000,24000]:[0,600,1200,1800,2400].map(d=>d+startYear);
 line(svg,x0,axisY,x1,axisY,{opacity:.8});
 ticks.forEach(d=>{
  const px=x(d);line(svg,px,axisY-4,px,axisY+4);
  const show= isPhone?(range===24000?(d%8000===0):true):true;
  if(show)text(svg,px,axisY+22,d===0?"0":format(d),{size:isPhone?11:12,anchor:d===startYear?"start":d===startYear+range?"end":"middle"});
 });
 text(svg,x0,axisY+37,"經過年數 Δ · 年",{size:isPhone?11:12});
 svg.dataset.r18Range=String(range);
 svg.dataset.r18StartYear=String(startYear);
 svg.dataset.r18EndYear=String(startYear+range);
 svg.dataset.r18Scale="delta-years";
 svg.dataset.r18View=isPhone?"mobile":"desktop";
 return {x,W,x0,x1,axisY};
}
function cursor(svg,x,top,bottom,range,startYear=0){
 if(selected<startYear||selected>startYear+range)return;
 line(svg,x(selected),top,x(selected),bottom,{color:colors.both,width:1.5,opacity:.75,dash:"3 6"});
 const cx=x(selected);put(svg,"circle",{cx,cy:top,r:4,fill:colors.both,"data-r18-cursor":selected});
}
function timeline(svgId,{range,lanes,firstLocal=false,bottom=350,startYear=0}){
 const svg=document.getElementById(svgId);
 const {x,x0,x1,axisY}=geom(svg,{range,bottom,startYear});
 const isPhone=mobile(),start=range===24000?90:82,gap=isPhone?57:64;
 lanes.forEach(({label,events,color,note},i)=>{
  const y=start+i*gap;
  text(svg,isPhone?8:15,y-5,label,{size:isPhone?12:16,color:colors.both,weight:550});
  if(note)text(svg,isPhone?8:15,y+13,note,{size:isPhone?10:12});
  line(svg,x0,y,x1,y,{opacity:.25});
  events.forEach(d=>{
   const px=x(d),emphasis=(d===model.firstLocal||d===24000);
   line(svg,px,y-(emphasis?11:6),px,y+(emphasis?11:6),{
    color:emphasis?colors.both:color,width:emphasis?3:range===24000?1.7:1.9,opacity:emphasis?1:.68
   }).setAttribute("data-r18-event",String(d));
  });
  if(events.includes(selected))put(svg,"circle",{cx:x(selected),cy:y,r:5,fill:colors.both});
 });
 cursor(svg,x,start-25,axisY-16,range,startYear);
 if(firstLocal&&model.firstLocal!==null&&model.firstLocal>=startYear&&model.firstLocal<=startYear+range){
  const xx=x(model.firstLocal);
  text(svg,Math.min(xx+8,x1-6),start-26,"首次年＋日："+format(model.firstLocal),{
   size:isPhone?10:13,color:colors.both,anchor:xx>x1-125?"end":"start"
  });
 }
 svg.dataset.r18LaneCount=String(lanes.length);
 svg.dataset.r18Evidence="recurrenceState";
 return svg;
}
function renderA(){
 timeline("r18-overview",{range:24000,bottom:390,lanes:[
  {label:"公曆",note:"每 400 年",events:model.overview.gregorian,color:colors.g},
  {label:"公曆＋年序",note:"首次 1,200",events:model.overview.gregorianYear,color:colors.year},
  {label:"公曆＋日序",note:"首次 8,000",events:model.overview.gregorianDay,color:colors.day},
  {label:"三項同時",note:"首次 24,000",events:model.overview.all,color:colors.both}
 ]});
 timeline("r18-local",{range:model.detailYears,startYear:model.detailStart,bottom:325,firstLocal:true,lanes:[
  {label:"60 年序",note:"每 60 年",events:model.detail.year,color:colors.year},
  {label:"60 日序",note:"實際日數",events:model.detail.day,color:colors.day},
  {label:"年＋日",note:"共同歸零",events:model.detail.yearDay,color:colors.both}
 ]});
}
function renderB(){
 const svg=document.getElementById("r18-gates");
 const {x,x0,x1,axisY}=geom(svg,{range:24000,bottom:395});
 const isPhone=mobile();
 const levels=[
  {name:"公曆＋年序",text:"首次 +1,200",at:1200,color:colors.year,events:model.overview.gregorianYear},
  {name:"公曆＋日序",text:"首次 +8,000",at:8000,color:colors.day,events:model.overview.gregorianDay},
  {name:"三項歸零",text:"首次 +24,000",at:24000,color:colors.g,events:model.overview.all}
 ];
 levels.forEach((r,i)=>{
  const y=95+i*80;
  text(svg,isPhone?8:14,y-11,r.name,{size:isPhone?12:16,color:colors.both,weight:550});
  text(svg,isPhone?8:14,y+9,r.text,{size:isPhone?10:12});
  // A dotted journey is a route to the first event, never a span of closure.
  // Only the endpoint itself means the condition is satisfied.
  line(svg,x0,y,x(r.at),y,{color:colors.muted,width:1.5,opacity:.66,dash:"2 6"});
  put(svg,"circle",{cx:x(r.at),cy:y,r:9,fill:"none",stroke:r.color,"stroke-width":1.7});
  put(svg,"circle",{cx:x(r.at),cy:y,r:4,fill:r.color,"data-r18-first-closure":String(r.at)});
  r.events.forEach(d=>{if(d>r.at)put(svg,"circle",{cx:x(d),cy:y,r:2.4,fill:r.color,opacity:.55,"data-r18-event":d});});
 });
 if(model.firstLocal!==null){
  const localX=x(model.firstLocal);
  line(svg,localX,65,localX,axisY-20,{color:colors.both,opacity:.43,dash:"3 5"});
  text(svg,Math.max(x0+14,Math.min(localX+10,x1-10)),60,"局部 "+format(model.firstLocal),{
   size:isPhone?10:12,color:colors.both
  });
 }
 cursor(svg,x,66,axisY-17,24000);
 svg.dataset.r18Evidence="recurrenceState";
 svg.dataset.r18LaneCount="3";
 timeline("r18-local-b",{range:model.detailYears,startYear:model.detailStart,bottom:325,firstLocal:true,lanes:[
  {label:"年序",note:"60 年循環",events:model.detail.year,color:colors.year},
  {label:"日序",note:"依真實日數",events:model.detail.day,color:colors.day},
  {label:"年＋日",note:"第一次重遇",events:model.detail.yearDay,color:colors.both}
 ]});
}
function renderSelection(){
 const point=classifyJourneyPoint(model,selected);
 const rows=projectUnfoldedPhases(point.state);
 document.querySelector("#selected-title").textContent=point.headline;
 document.querySelector("#selected-detail").textContent=point.detail;
 document.querySelector("#selected-phases").textContent=rows.map(r=>
  r.label+"："+(r.signed===null?"不可判":r.signed===0?"0":(r.signed>0?"+":"−")+Math.abs(r.signed)+" "+r.unit)
 ).join("　／　");
 document.querySelectorAll("[data-delta]").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.delta==="local"?model.firstLocal:Number(b.dataset.delta))===selected)));
 document.body.dataset.r18SelectedDelta=String(selected);
 document.body.dataset.r18SelectedKind=point.kind;
 document.body.dataset.r18FirstLocal=String(model.firstLocal);
 document.body.dataset.r18FirstGlobal=String(model.firstGlobal);
 document.body.dataset.r18DetailStart=String(model.detailStart);
 document.body.dataset.r18DetailEnd=String(model.detailEnd);
 document.body.dataset.r18BaseDate=[base.year,String(base.month).padStart(2,"0"),String(base.day).padStart(2,"0")].join("-");
}
function render(){
 if(variant==="lanes")renderA();else renderB();
 document.querySelector("#r18-local").setAttribute("aria-label","局部 "+format(model.detailStart)+" 至 "+format(model.detailEnd)+" 年：年序、日序與第一次共同歸零");
 document.querySelector("#r18-local-b").setAttribute("aria-label","局部 "+format(model.detailStart)+" 至 "+format(model.detailEnd)+" 年：年序、日序與第一次共同歸零");
 const windowLabel=format(model.detailStart)+"～"+format(model.detailEnd)+" 年";
 document.querySelectorAll("[data-r18-local-range]").forEach(n=>n.textContent=windowLabel);
 renderSelection();
 document.body.dataset.r18Ready="true";
 document.body.dataset.r18Variant=variant;
}
document.querySelectorAll("[data-variant]").forEach(b=>b.addEventListener("click",()=>{
 variant=b.dataset.variant;
 const url=new URL(location.href);url.searchParams.set("variant",variant);
 history.replaceState(null,"",url.pathname+url.search+url.hash);
 const lanes=variant==="lanes";
 document.getElementById("figures-a").classList.toggle("hidden",!lanes);
 document.getElementById("figures-b").classList.toggle("hidden",lanes);
 document.getElementById("r18-derivation").classList.toggle("hidden",lanes);
 document.getElementById("variant-heading").textContent=lanes?"先看所有閉合事件，再放大局部":"看各項條件在什麼年份交會";
 document.getElementById("variant-explain").textContent=lanes
 ?"所有軸都代表經過年數 Δ。上圖看 0～24,000 年，下面的局部窗口會移動到此日期的首次年＋日重遇附近，並明確標出不同尺度。"
 :"三條條件列的端點代表它們首次共同達成的真正 Δ 年數；年／日局部重遇依基準日期變動，並不冒充三項閉合。下面的獨立比例小圖呈現局部。";
 document.querySelectorAll("[data-variant]").forEach(n=>n.setAttribute("aria-pressed",String(n===b)));
 render();
}));
document.querySelector('[data-delta="local"]').textContent="首次局部 +"+format(model.firstLocal);
document.querySelector("#r18-baseline").textContent=[base.year,base.month,base.day].join("/");
document.querySelectorAll("[data-delta]").forEach(b=>b.addEventListener("click",()=>{
 selected=b.dataset.delta==="local"?model.firstLocal:Number(b.dataset.delta);
 const url=new URL(location.href);url.searchParams.set("delta",String(selected));
 history.replaceState(null,"",url.pathname+url.search+url.hash);
 render();
}));
matchMedia("(max-width:680px)").addEventListener?.("change",render);
if(variant==="gates"){
 document.querySelector('[data-variant="gates"]').setAttribute("aria-pressed","true");
 document.querySelector('[data-variant="lanes"]').setAttribute("aria-pressed","false");
 document.getElementById("figures-a").classList.add("hidden");
 document.getElementById("figures-b").classList.remove("hidden");
 document.getElementById("r18-derivation").classList.remove("hidden");
 document.getElementById("variant-heading").textContent="看各項條件在什麼年份交會";
 document.getElementById("variant-explain").textContent="三條條件列的端點代表它們首次共同達成的真正 Δ 年數；年／日局部重遇依基準日期變動，並不冒充三項閉合。下面的獨立比例小圖呈現局部。";
}
render();
