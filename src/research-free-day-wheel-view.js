import { polar, annularSectorPath } from "./geometry.js";
import { heavenlyStems, earthlyBranches, sexagenaryCycle, cycleItem, wrapCycleIndex } from "./sexagenary-data.js";
import { dayWheelDateDestinations } from "./recurrence/day-wheel-date-destinations.js";
import { validateGregorianDate } from "./recurrence/gregorian-cycle.js";

const root = document.querySelector("#research-free-explorer");
const panel = document.querySelector("#research-free-day-wheel");
const svg = document.querySelector("#research-free-day-wheel-svg");
const directSelect = document.querySelector("#research-free-wheel-direct-select");
const NS = "http://www.w3.org/2000/svg";
const cx = 320;
const cy = 320;
const groups = panel && svg
  ? Object.fromEntries(["guides","stems","branches","cycle","selection"].map(key => [
      key, svg.querySelector('[data-free-cycle-group="' + key + '"]')
    ])) : null;
let selectedIndex = null;
let currentDateKey = null;
let currentIndex = null;
let preview = null;
let activePointerId = null;
const selectionNodes = [];

function svgEl(parent,tag,attrs={}) {
  const node = document.createElementNS(NS,tag);
  for(const [name,value] of Object.entries(attrs)) node.setAttribute(name,String(value));
  parent.append(node);
  return node;
}
function circleText(parent,radius,angle,text,className) {
  const {x,y}=polar(cx,cy,radius,angle);
  const node=svgEl(parent,"text",{x,y,class:className});
  node.textContent=text;
  return node;
}
function getDate(value) {
  const match=/^([0-9]{1,8})-([0-9]{2})-([0-9]{2})$/.exec(value??"");
  if(!match) return null;
  const date={year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
  return validateGregorianDate(date) ? date : null;
}
function formatDate(date) {
  if(!date) return "超出可用日期";
  return date.year + "/" + String(date.month).padStart(2,"0") + "/" + String(date.day).padStart(2,"0");
}
function text(id,value) {
  document.getElementById(id).textContent=value;
}

function drawWheel() {
  // The native picker and circular geometry share the SAME canonical cycle.
  // Do not create a second hard-coded list of 60 labels.
  const options=document.createDocumentFragment();
  sexagenaryCycle.forEach(day=>{
    const option=document.createElement("option");
    option.value=String(day.index);
    // Name-first labels let native keyboard typeahead locate the Ganzhi,
    // instead of matching the ordinal prefix for every option.
    option.textContent=day.name+" · "+String(day.ordinal).padStart(2,"0");
    options.append(option);
  });
  directSelect.replaceChildren(options);
  for(const radius of [150,205,275]) svgEl(groups.guides,"circle",{
    cx,cy,r:radius,class:"research-cycle-guide"
  });
  circleText(groups.guides,118,0,"天干 · 10","research-cycle-guide-label");
  circleText(groups.guides,175,0,"地支 · 12","research-cycle-guide-label");
  heavenlyStems.forEach((stem,index)=>{
    const angle=index*36;
    const point=polar(cx,cy,150,angle);
    const circle=svgEl(groups.stems,"circle",{cx:point.x,cy:point.y,r:20,class:"research-cycle-node"});
    const label=circleText(groups.stems,150,angle,stem.name,"research-cycle-node-label");
    selectionNodes.push({kind:"stem",index,circle,label});
  });
  earthlyBranches.forEach((branch,index)=>{
    const angle=index*30;
    const point=polar(cx,cy,205,angle);
    const circle=svgEl(groups.branches,"circle",{cx:point.x,cy:point.y,r:18,class:"research-cycle-node"});
    const label=circleText(groups.branches,205,angle,branch.name,"research-cycle-node-label");
    selectionNodes.push({kind:"branch",index,circle,label});
  });
  sexagenaryCycle.forEach((day,index)=>{
    const angle=index*6;
    const inner=polar(cx,cy,index%5===0?253:258,angle);
    const outer=polar(cx,cy,270,angle);
    const tick=svgEl(groups.cycle,"line",{
      x1:inner.x,y1:inner.y,x2:outer.x,y2:outer.y,
      class:"research-cycle-tick" + (index%5===0?" major":"")
    });
    const dotPoint=polar(cx,cy,275,angle);
    const dot=svgEl(groups.cycle,"circle",{
      cx:dotPoint.x,cy:dotPoint.y,r:index%5===0?4.8:3.5,
      class:"research-cycle-dot"+(index%5===0?" major":"")
    });
    if(index%5===0)circleText(groups.cycle,296,angle,String(day.ordinal).padStart(2,"0"),"research-cycle-index");
    const hit=svgEl(groups.cycle,"path",{
      d:annularSectorPath(cx,cy,242,306,angle-3,angle+3),
      class:"research-cycle-hit",role:"button",tabindex:"-1",
      "aria-label":day.name+"，第 "+day.ordinal+" 位"
    });
    svgEl(hit,"title").textContent=String(day.ordinal).padStart(2,"0")+" · "+day.name;
    hit.addEventListener("click",()=>setSelected(index,false));
    hit.addEventListener("keydown",event=>{
      if(event.key==="Enter" || event.key===" ") {
        event.preventDefault();
        setSelected(index,false);
      }
    });
    selectionNodes.push({kind:"day",index,tick,dot,hit});
  });
  svg.setAttribute("tabindex","0");
  svg.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    if(selectedIndex===null)return;
    const index=event.key==="Home"?0:event.key==="End"?59:
      selectedIndex+(event.key==="ArrowRight"?1:-1);
    setSelected(wrapCycleIndex(index),false);
  });
}

function paintSelection(index) {
  const day=cycleItem(index);
  groups.selection.replaceChildren();
  const inner=polar(cx,cy,232,index*6);
  const outer=polar(cx,cy,294,index*6);
  svgEl(groups.selection,"line",{
    x1:inner.x,y1:inner.y,x2:outer.x,y2:outer.y,class:"research-cycle-ray"
  });
  const cap=polar(cx,cy,275,index*6);
  svgEl(groups.selection,"circle",{
    cx:cap.x,cy:cap.y,r:7,class:"research-cycle-cap"
  });
  selectionNodes.forEach(node=>{
    const active=node.kind==="stem"?node.index===day.stemIndex:
      node.kind==="branch"?node.index===day.branchIndex:node.index===day.index;
    if(node.kind==="day"){
      node.tick.classList.toggle("active",active);
      node.dot.classList.toggle("active",active);
      node.dot.classList.toggle("is-current",node.index===currentIndex&&!active);
      node.dot.setAttribute("r",active?7:node.index%5===0?4.8:3.5);
      node.hit.setAttribute("aria-pressed",String(active));
    }else{
      node.circle.classList.toggle("active",active);
      node.label.classList.toggle("active",active);
    }
  });
  text("research-free-wheel-name",day.name);
  text("research-free-wheel-center-name",day.name);
  text("research-free-wheel-center-count",String(day.ordinal).padStart(2,"0")+"/60");
  svg.setAttribute("aria-label","六十日轉盤，目前探索 "+day.name+"，第 "+day.ordinal+" 位；左右方向鍵切換干支");
}

function setSelected(index,linked) {
  if(!root || root.dataset.ready!=="true" || !getDate(root.dataset.targetDate))return;
  selectedIndex=wrapCycleIndex(index);
  panel.dataset.selectedIndex=String(selectedIndex);
  panel.dataset.selectionLinked=String(linked);
  directSelect.value=String(selectedIndex);
  const date=getDate(root.dataset.targetDate);
  preview=dayWheelDateDestinations(date,selectedIndex);
  panel.dataset.currentDate=root.dataset.targetDate;
  panel.dataset.selectedName=preview.selectedName;
  panel.dataset.previousDate=preview.previous.date?formatDate(preview.previous.date):"unavailable";
  panel.dataset.nextDate=preview.next.date?formatDate(preview.next.date):"unavailable";
  panel.dataset.previousOffset=String(preview.previous.offsetDays);
  panel.dataset.nextOffset=String(preview.next.offsetDays);
  paintSelection(selectedIndex);
  text("research-free-wheel-status",linked?"跟隨比較日 · 可選其他干支":
    "探索位置 · 日期尚未修改");
  text("research-free-wheel-current-date",formatDate(date));
  text("research-free-wheel-current-name",preview.currentName);
  for(const [side,sideName] of [["previous","前一次"],["next","後一次"]]) {
    const value=preview[side];
    const button=document.getElementById("research-free-wheel-"+side);
    button.disabled=!value.date;
    text("research-free-wheel-"+side+"-date",formatDate(value.date));
    text("research-free-wheel-"+side+"-delta",
      value.date?sideName+" · "+(value.offsetDays>0?"+":"")+value.offsetDays+" 日":"無可用日期");
  }
  document.getElementById("research-free-wheel-return").hidden=linked;
}

function followCommittedDate(force=false) {
  if(!root || root.dataset.ready!=="true"){
    if(panel)panel.dataset.ready="false";
    if(directSelect)directSelect.disabled=true;
    for(const direction of ["previous","next"]) {
      const button=document.getElementById("research-free-wheel-"+direction);
      if(button)button.disabled=true;
    }
    return;
  }
  const date=getDate(root.dataset.targetDate);
  if(!date)return;
  directSelect.disabled=false;
  // Li Chun chunk refinement can rerender the same free-date model. It must
  // not discard a deliberately explored Day position unless the committed
  // calendar date genuinely changed or invalid input has just recovered.
  if(!force && currentDateKey===root.dataset.targetDate && panel.dataset.ready==="true")return;
  currentDateKey=root.dataset.targetDate;
  // The only arithmetic used by this wheel is the pure resolver, which
  // obtains its own canonical current index from the validated date.
  currentIndex=dayWheelDateDestinations(date,0).currentIndex;
  setSelected(currentIndex,true);
  panel.dataset.ready="true";
}

function pointIndex(event) {
  const matrix=svg.getScreenCTM();
  if(!matrix)return null;
  const point=svg.createSVGPoint();
  point.x=event.clientX;
  point.y=event.clientY;
  const local=point.matrixTransform(matrix.inverse());
  const radius=Math.hypot(local.x-cx,local.y-cy);
  if(radius<242 || radius>310)return null;
  const angle=(Math.atan2(local.y-cy,local.x-cx)*180/Math.PI+360)%360;
  return wrapCycleIndex(Math.floor((angle+3)/6));
}

if(root && panel && svg && directSelect){
  drawWheel();
  directSelect.addEventListener("change",()=>{
    const raw=directSelect.value;
    if(!/^(?:[0-9]|[1-5][0-9])$/.test(raw))return;
    const index=Number(raw);
    if(root.dataset.ready!=="true"){
      // An uncommitted or invalid date must never leave a false selection.
      if(selectedIndex!==null)directSelect.value=String(selectedIndex);
      return;
    }
    setSelected(index,false);
  });
  svg.addEventListener("pointerdown",event=>{
    if(event.pointerType==="mouse"&&event.button!==0)return;
    const index=pointIndex(event);
    if(index===null)return;
    activePointerId=event.pointerId;
    svg.setPointerCapture?.(event.pointerId);
    setSelected(index,false);
    event.preventDefault();
  });
  svg.addEventListener("pointermove",event=>{
    if(activePointerId!==event.pointerId)return;
    const index=pointIndex(event);
    if(index!==null&&index!==selectedIndex)setSelected(index,false);
    event.preventDefault();
  });
  const release=event=>{
    if(event.pointerId!==activePointerId)return;
    if(svg.hasPointerCapture?.(event.pointerId))svg.releasePointerCapture(event.pointerId);
    activePointerId=null;
  };
  svg.addEventListener("pointerup",release);
  svg.addEventListener("pointercancel",release);
  document.getElementById("research-free-wheel-return").addEventListener("click",()=>followCommittedDate(true));
  for(const direction of ["previous","next"]){
    document.getElementById("research-free-wheel-"+direction).addEventListener("click",()=>{
      if(!preview||!preview[direction].date||root.dataset.ready!=="true")return;
      root.dispatchEvent(new CustomEvent("research-free-wheel:jump",{
        detail:{
          direction,
          selectedIndex,
          fromDate:currentDateKey
        }
      }));
    });
  }
  new MutationObserver(records=>{
    if(records.some(record=>["data-target-date","data-ready"].includes(record.attributeName))){
      followCommittedDate();
    }
  }).observe(root,{attributes:true,attributeFilter:["data-target-date","data-ready"]});
  followCommittedDate();
  if (new URL(location.href).searchParams.get("wheel")==="open" &&
      document.body.dataset.researchMode==="dates") panel.open=true;
}
