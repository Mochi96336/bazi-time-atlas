// R17 contextual design lab: the iframe owns dates, Ganzhi and calculations.
// This parent only projects existing published production phase attributes.
const iframe=document.querySelector("#production");
const scenario=document.querySelector("#scenario");
const buttons=[...document.querySelectorAll("[data-variant]")];
const params=new URLSearchParams(location.search);
const allowed=new Set(["400","1980","24000"]);
let delta=allowed.has(params.get("delta"))?params.get("delta"):"1980";
let variant=params.get("variant")==="original"?"original":"proof";
let child=null,observer=null;
scenario.value=delta;
function buttonState(){
  buttons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.variant===variant)));
  document.body.dataset.r17SelectedVariant=variant;
}
function fmt(v){return v===null?"—":v===0?"0":(v>0?"+":"−")+Math.abs(v)}
function read(inst) {
  const keys=["gregorianPhaseSigned","yearSequencePhaseSigned","dayPhaseSigned"];
  const phases=keys.map(key=>{
    const s=inst.dataset[key];
    if(s===undefined||s==="invalid"||s==="null")return null;
    const n=Number(s);return Number.isFinite(n)?n:null;
  });
  const years=Number(inst.dataset.deltaYears);
  if(!Number.isInteger(years)||inst.dataset.gregorianPhaseSigned===undefined)return null;
  return {phases,years};
}
function mark(doc,svg,name,attrs,content) {
  const el=doc.createElementNS("http://www.w3.org/2000/svg",name);
  Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
  if(content!==undefined)el.textContent=content;
  svg.append(el);return el;
}
function render() {
  if(!child)return;
  const {doc,inst,svg}=child;
  const state=read(inst);if(!state)return;
  const [g,y,d]=state.phases;
  const mobile=doc.defaultView.innerWidth<=680;
  const W=mobile?370:720;
  const zero=W*(mobile?.60:.575);
  const half=Math.min(zero-27,W-zero-29);
  const color=p=>p===null?"#7c878d":p===0?"#75cddd":"#dfb86d";
  const add=(name,attrs,content)=>mark(doc,svg,name,attrs,content);
  svg.setAttribute("viewBox","0 0 "+W+" 322");
  svg.replaceChildren();
  svg.dataset.r17Source="production-instrument";
  svg.dataset.r17GregorianSigned=String(g);
  svg.dataset.r17YearSigned=String(y);
  svg.dataset.r17DaySigned=String(d);
  svg.dataset.r17DeltaYears=String(state.years);
  add("text",{x:26,y:26,fill:"#b2bdc1","font-size":13},"公曆結構 / 400 年週期");
  add("text",{x:26,y:104,fill:color(g),"font-size":mobile?46:56,"font-weight":550},fmt(g));
  add("text",{x:26,y:131,fill:"#b2bdc1","font-size":13},
    g===0?"公曆回到 0 相位":g===null?"公曆位置不可判":"年 · 距共同零點的最短位移");
  add("path",{d:"M "+zero+" 79 V 304",stroke:"#b2bdc1","stroke-width":1,
    "stroke-dasharray":"2 7",opacity:.57,fill:"none"});
  add("text",{x:zero,y:64,fill:"#b2bdc1","font-size":13,"text-anchor":"middle"},"共同 0");
  add("line",{x1:zero-half,y1:164,x2:zero+half,y2:164,stroke:"#b2bdc1","stroke-width":1,opacity:.3});
  add("text",{x:zero-half,y:186,fill:"#87959a","font-size":11},"−200");
  add("text",{x:zero+half,y:186,fill:"#87959a","font-size":11,"text-anchor":"end"},"+200");
  if(g!==null) {
    const gx=zero+half*g/200;
    if(g!==0)add("line",{x1:gx,y1:164,x2:zero,y2:164,stroke:color(g),"stroke-width":4,"stroke-linecap":"round"});
    add("circle",{cx:gx,cy:164,r:5.5,fill:color(g)});
  }
  [{label:"年序",value:y,unit:"年",vertical:230,size:.77},
   {label:"日序",value:d,unit:"日",vertical:296,size:.61}].forEach(row=>{
    const p=row.value,v=row.vertical;
    add("text",{x:26,y:v-11,fill:"#eef2f2","font-size":16},row.label);
    add("text",{x:26,y:v+13,fill:"#b2bdc1","font-size":12},
      p===0?"回到基準":p===null?"目前不可判":"週期 60 "+row.unit);
    if(p!==null&&p!==0) {
      const width=half*row.size,px=zero+width*p/30;
      add("line",{x1:zero-width,y1:v,x2:zero+width,y2:v,stroke:"#b2bdc1","stroke-width":1,opacity:.3});
      add("line",{x1:px,y1:v,x2:zero,y2:v,stroke:color(p),"stroke-width":3,"stroke-linecap":"round"});
      add("circle",{cx:px,cy:v,r:5,fill:color(p)});
    }else add("circle",{cx:zero,cy:v,r:5,fill:color(p)});
    add("text",{x:W-25,y:v+5,"text-anchor":"end",fill:color(p),"font-size":14},
      p===null?"—":fmt(p)+" "+row.unit);
  });
  const evidence=g===0&&y===0&&d===0?"all-closed":y===0&&d===0?"year-day-closed":g===0?"gregorian-closed":"mixed";
  svg.dataset.r17EvidenceState=evidence;
  Object.assign(document.body.dataset,{
    r17ProductionReady:"true",
    r17YearStripPresent:String(!!doc.querySelector("#research-year-strip")),
    r17DeltaControlsPresent:String(!!doc.querySelector("#delta-slider")),
    r17PhaseEvidence:[g,y,d].join(","),
    r17CurrentDelta:String(state.years),
    r17EvidenceState:evidence,
    r17FigurePresent:String(svg.querySelectorAll("circle").length>=3)
  });
}
function apply(){
  buttonState();
  if(!child)return;
  child.doc.body.classList.toggle("r17-context-prototype",variant==="proof");
  render();
  document.body.dataset.r17ContextReady="true";
}
function mount(){
  observer?.disconnect();observer=null;child=null;
  document.body.dataset.r17ContextReady="false";
  document.body.dataset.r17ProductionReady="false";
  const doc=iframe.contentDocument;
  const inst=doc?.querySelector("#recurrence-instrument");
  const strip=doc?.querySelector("#research-year-strip");
  const fan=doc?.querySelector("#recurrence-instrument .research-fan-graphic");
  if(!doc||!inst||!strip||!fan||!doc.querySelector("#delta-slider")){
    document.body.dataset.r17ContextError="production-structure-missing";return;
  }
  const style=doc.createElement("style");
  style.textContent=[
    "body.r17-context-prototype #recurrence-instrument .recurrence-legend{display:none!important}",
    "body.r17-context-prototype #recurrence-wheel{display:none!important}",
    "body.r17-context-prototype #recurrence-instrument .research-fan-composition .research-fan-graphic{aspect-ratio:auto!important;height:auto!important;min-height:0!important;overflow:visible!important;position:relative!important}",
    "#r17-context-proof{width:100%;height:auto;display:none;max-width:740px;overflow:visible;position:relative;inset:auto}",
    "body.r17-context-prototype #r17-context-proof{display:block}",
    "body.r17-context-prototype #recurrence-instrument .research-fan-head{padding-top:0}",
    "body.r17-context-prototype #recurrence-instrument .research-current-state-phases{opacity:.5}",
    "body.r17-context-prototype #recurrence-instrument .research-fan-datum-note{display:none!important}",
    "body.r17-context-prototype #recurrence-instrument[data-research-mainline=phase-fan]{margin-top:38px!important}",
    "body.r17-context-prototype #research-discrete .discrete-derivation{margin-top:42px!important}",
    "@media(min-width:960px){body.r17-context-prototype #recurrence-instrument .research-fan-composition{grid-template-columns:minmax(0,.37fr) minmax(0,.63fr)!important;column-gap:clamp(28px,4vw,65px)!important}}",
    "@media(max-width:680px){body.r17-context-prototype #recurrence-instrument .research-fan-composition{gap:20px!important}}"
  ].join("\n");
  doc.head.append(style);
  const svg=doc.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.id="r17-context-proof";
  svg.setAttribute("role","img");
  svg.setAttribute("aria-label","R17 零點證明：公曆偏移與年、日序相位");
  fan.append(svg);
  child={doc,inst,svg};
  observer=new MutationObserver(render);
  observer.observe(inst,{attributes:true,attributeFilter:[
    "data-delta-years","data-global-closed","data-gregorian-phase-signed",
    "data-year-sequence-phase-signed","data-day-phase-signed"
  ]});
  let attempts=0;
  function settle(){
    if(read(inst)){
      apply();
      doc.defaultView.requestAnimationFrame(()=>{
        const top=strip.getBoundingClientRect().top+doc.defaultView.scrollY;
        doc.defaultView.scrollTo(0,Math.max(0,top-(doc.defaultView.innerWidth<=680?174:128)));
        // The live Ganzhi rail is sticky. Align the real strip heading BELOW
        // that rail, not to the frame origin (which clips the heading).
        doc.defaultView.requestAnimationFrame(()=>{
          const heading=strip.querySelector(".research-year-head");
          const rail=doc.querySelector("#research-time-state");
          if(!heading||!rail)return;
          const deficit=rail.getBoundingClientRect().bottom+18-heading.getBoundingClientRect().top;
          if(deficit>0)doc.defaultView.scrollBy({top:-Math.ceil(deficit),behavior:"instant"});
          doc.defaultView.requestAnimationFrame(()=>{
            const clearance=heading.getBoundingClientRect().top-rail.getBoundingClientRect().bottom;
            document.body.dataset.r17YearHeadClear=String(clearance>=10);
            document.body.dataset.r17YearHeadClearance=String(Math.round(clearance));
          });
        });
      });
    }else if(++attempts<350)doc.defaultView.requestAnimationFrame(settle);
    else document.body.dataset.r17ContextError="production-not-ready";
  }
  settle();
}
buttons.forEach(b=>b.addEventListener("click",()=>{variant=b.dataset.variant;apply()}));
scenario.addEventListener("change",()=>{
  delta=scenario.value;
  iframe.src="../recurrence.html?date=2026-09-13&delta="+delta;
});
iframe.addEventListener("load",mount);
buttonState();
iframe.src="../recurrence.html?date=2026-09-13&delta="+delta;
