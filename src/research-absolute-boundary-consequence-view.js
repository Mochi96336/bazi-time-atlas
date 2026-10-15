import {
  ABSOLUTE_BOUNDARY_CONSEQUENCE_24000 as CONSEQUENCE
} from "./research/seasonal-absolute-boundary-consequence.js";
import { indexForLongitude } from "./research/seasonal-drift-26026-research-data.js";

const NS="http://www.w3.org/2000/svg";
const evidence=document.querySelector("#research-evidence");
const instrument=document.querySelector("#recurrence-instrument");
const determinacy=document.querySelector("#four-pillar-determinacy");
let panel=null;
let rendered=false;

function baseYear(){
  const match=/^(\d{1,7})-/.exec(instrument?.dataset.baseDate??"");
  return match?Number(match[1]):null;
}

function aligned(){
  return baseYear()===CONSEQUENCE.baseYear &&
    Number(instrument?.dataset.deltaYears)===CONSEQUENCE.deltaYears;
}

function ensurePanel(){
  if(panel?.isConnected)return panel;
  if(!evidence||!determinacy)return null;
  panel=document.createElement("section");
  panel.id="absolute-boundary-consequence";
  panel.className="absolute-boundary-consequence";
  panel.hidden=true;
  panel.dataset.ready="false";
  panel.setAttribute("aria-label","+24,000 年 absolute 節氣邊界對年柱與月柱的研究後果");
  panel.innerHTML=[
    '<header class="absolute-boundary-head">',
      '<div>',
        '<div class="eyebrow">02 → 03 · Absolute boundary consequence</div>',
        '<h3>離散三層回來了，但 12 個「節」在 TT / Gregorian 參考格上沒有回到原相位。</h3>',
        '<p>把 02 的全年 absolute seasonal drift 放到八字使用的 12 個「節」，只回答 TT 參考格上的節界是否重現。它不是西元 26026 某個真實民用年月日時的四柱判決。</p>',
      '</div>',
      '<div class="absolute-boundary-verdict">',
        '<span>TT / Gregorian reference</span>',
        '<strong>12 / 12 節界未重現</strong>',
        '<small>要落到未來民用時刻的年／月柱，仍需 deep-time Earth rotation / civil-time 對應；Day / Hour 也仍未解。</small>',
      '</div>',
    '</header>',
    '<div class="absolute-boundary-stats">',
      '<div class="primary"><span>節界覆蓋</span><strong>12 / 12</strong><small>全部 target crossing 都離開原 TT reference phase</small></div>',
      '<div><span>12 節位移範圍</span><strong id="absolute-boundary-range">—</strong><small id="absolute-boundary-largest">—</small></div>',
      '<div><span>立春 · year/month reference boundary</span><strong id="absolute-boundary-li-chun">—</strong><small>相對 365.2425-day Gregorian mean-year lattice</small></div>',
    '</div>',
    '<div class="absolute-boundary-strip-wrap">',
      '<div class="absolute-boundary-strip-key"><span>立春錨定 · 365.2425-day Gregorian mean-year · TT phase</span><strong>淡帶＝同一 reference phase 落在不同節界 sector 的區間</strong></div>',
      '<svg id="absolute-boundary-strip" viewBox="0 0 1200 190" role="img" aria-label="+24,000 年十二個八字節界的 absolute disagreement windows"></svg>',
      '<div id="absolute-boundary-buttons" class="absolute-boundary-buttons" aria-label="十二節邊界；點選可同步 02 的黃經游標"></div>',
    '</div>',
    '<div class="absolute-boundary-pillar-summary">',
      '<div data-pillar="year"><span>Year boundary · TT reference</span><strong>立春界位移 10.883 天</strong><small>證明 reference lattice 不閉合；尚未直接判定未來 civil-time 年柱。</small></div>',
      '<div data-pillar="month"><span>Month boundaries · TT reference</span><strong>12 個節界全部位移</strong><small>各節提前 10.235–14.177 天；尚未直接判定特定民用時刻月柱。</small></div>',
      '<div data-pillar="day"><span>日柱</span><strong>仍未由此層解析</strong><small>需要 Earth-rotation / civil-day phase 與日界約定。</small></div>',
      '<div data-pillar="hour"><span>時柱</span><strong>仍未由此層解析</strong><small>還需要 civil/local time、經度與已解析日干。</small></div>',
    '</div>',
    '<details class="absolute-boundary-metrics"><summary>技術量 · boundary-window union</summary><div><strong id="absolute-boundary-union">—</strong><span id="absolute-boundary-union-percent">—</span><small>這只是 reference-phase 幾何窗口，不是人口機率，也不是「40% 的八字不同」。</small></div></details>',
    '<p class="absolute-boundary-note"><strong>限制：</strong><span id="absolute-boundary-note-copy">—</span></p>'
  ].join("");
  determinacy.insertAdjacentElement("beforebegin",panel);
  return panel;
}

function svgEl(tag,attrs,parent){
  const node=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.appendChild(node);
  return node;
}

function phaseX(day){
  const left=52;
  const right=1148;
  return left+(day/CONSEQUENCE.cycleDays)*(right-left);
}

function renderStrip(){
  const svg=panel?.querySelector("#absolute-boundary-strip");
  const buttons=panel?.querySelector("#absolute-boundary-buttons");
  if(!svg||!buttons)return;
  svg.replaceChildren();
  buttons.replaceChildren();

  const y=78;
  svgEl("line",{x1:52,x2:1148,y1:y,y2:y,class:"absolute-boundary-axis"},svg);

  for(const boundary of CONSEQUENCE.boundaries){
    for(const piece of boundary.pieces){
      const x1=phaseX(piece.start);
      const x2=phaseX(piece.end);
      svgEl("rect",{
        x:x1,
        y:y-12,
        width:Math.max(1,x2-x1),
        height:24,
        rx:3,
        class:boundary.isYearBoundary
          ?"absolute-boundary-window year-boundary"
          :"absolute-boundary-window"
      },svg);
    }

    const baseX=phaseX(boundary.basePhaseDay);
    const targetX=phaseX(boundary.targetPhaseDay);
    svgEl("line",{
      x1:baseX,x2:baseX,y1:y-22,y2:y+24,
      class:boundary.isYearBoundary
        ?"absolute-boundary-base-tick year-boundary"
        :"absolute-boundary-base-tick"
    },svg);
    svgEl("circle",{
      cx:targetX,cy:y,r:3.8,
      class:boundary.isYearBoundary
        ?"absolute-boundary-target-dot year-boundary"
        :"absolute-boundary-target-dot"
    },svg);

    const label=svgEl("text",{
      x:baseX,
      y:boundary.isYearBoundary?42:(Math.round(boundary.basePhaseDay/30)%2===0?118:139),
      class:boundary.isYearBoundary
        ?"absolute-boundary-term year-boundary"
        :"absolute-boundary-term",
      "text-anchor":"middle"
    },svg);
    label.textContent=boundary.name;

    const button=document.createElement("button");
    button.type="button";
    button.dataset.longitude=String(boundary.longitude);
    button.dataset.yearBoundary=String(boundary.isYearBoundary);
    button.innerHTML='<span>'+boundary.name+(boundary.isYearBoundary?" · 年界":"")+'</span>'+
      '<strong>提前 '+boundary.widthDays.toFixed(3)+' d</strong>'+
      '<small>'+boundary.monthTransition+'</small>';
    button.addEventListener("click",()=>{
      const scrub=document.querySelector("#seasonal-drift-scrub");
      if(!(scrub instanceof HTMLInputElement))return;
      scrub.value=String(indexForLongitude(boundary.longitude));
      scrub.dispatchEvent(new Event("input",{bubbles:true}));
      document.querySelector("#seasonal-drift-prototype")?.scrollIntoView({behavior:"smooth",block:"center"});
    });
    buttons.appendChild(button);
  }

  const start=svgEl("text",{x:52,y:174,class:"absolute-boundary-axis-label","text-anchor":"start"},svg);
  start.textContent="立春";
  const end=svgEl("text",{x:1148,y:174,class:"absolute-boundary-axis-label","text-anchor":"end"},svg);
  end.textContent="365.2425 d";
}

function setText(id,value){
  const node=document.querySelector("#"+id);
  if(node)node.textContent=value;
}

function render(){
  const root=ensurePanel();
  if(!root)return;
  setText("absolute-boundary-union",CONSEQUENCE.unionWindowDays.toFixed(3)+" d");
  setText("absolute-boundary-union-percent","= "+CONSEQUENCE.unionWindowPercent.toFixed(3)+"% of this reference cycle");
  setText("absolute-boundary-li-chun","提前 "+CONSEQUENCE.liChunBoundary.widthDays.toFixed(3)+" d");
  setText("absolute-boundary-range",CONSEQUENCE.minBoundaryDays.toFixed(3)+"–"+CONSEQUENCE.maxBoundaryDays.toFixed(3)+" d");
  setText("absolute-boundary-largest","最大："+CONSEQUENCE.largestBoundary.name+" · "+CONSEQUENCE.largestBoundary.widthDays.toFixed(3)+" d");
  setText(
    "absolute-boundary-note-copy",
    "這是立春錨定、365.2425-day proleptic-Gregorian mean-year 的 uniform-TT reference lattice。"+
    CONSEQUENCE.boundaries.length+" 個節界在此參考格上的 union 為 "+CONSEQUENCE.unionWindowDays.toFixed(3)+
    " 天；它不能直接升格成西元 26026 某個真實民用年月日時的年／月柱結論，也不是人口錯誤率。year-26026 frame 尚未在目標年獨立驗證，因此維持 research-only。"
  );
  renderStrip();
  root.dataset.ready="true";
  rendered=true;
}

function sync(){
  const root=ensurePanel();
  if(!root)return;
  const active=aligned();
  root.hidden=!active;
  root.dataset.active=String(active);

  if(active&&!rendered)render();

  if(active){
    instrument.dataset.absoluteBoundaryConsequence="year-26026-research";
    instrument.dataset.absoluteBoundaryReferenceJie="displaced";
    instrument.dataset.absoluteBoundaryUnionDays=CONSEQUENCE.unionWindowDays.toFixed(6);
    instrument.dataset.absoluteBoundaryUnionPercent=CONSEQUENCE.unionWindowPercent.toFixed(6);


  }else{
    delete instrument.dataset.absoluteBoundaryConsequence;
    delete instrument.dataset.absoluteBoundaryReferenceJie;
    delete instrument.dataset.absoluteBoundaryUnionDays;
    delete instrument.dataset.absoluteBoundaryUnionPercent;


  }
}

if(evidence&&instrument&&determinacy){
  sync();
  new MutationObserver(sync).observe(instrument,{
    attributes:true,
    attributeFilter:["data-base-date","data-delta-years"]
  });
}
