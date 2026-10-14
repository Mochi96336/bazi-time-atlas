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

function ensureStyles(){
  if(document.querySelector('link[data-absolute-boundary-consequence-styles]'))return;
  const link=document.createElement("link");
  link.rel="stylesheet";
  link.href="./research-absolute-boundary-consequence.css";
  link.dataset.absoluteBoundaryConsequenceStyles="1";
  document.head.appendChild(link);
}

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
        '<h3>曆法三層回來了，但年／月柱的節氣邊界沒有回來。</h3>',
        '<p>把 02 的全年 absolute seasonal drift 直接放到八字使用的 12 個「節」。這裡回答的是邊界是否重現，不把 shape-only 結果當完整節氣誤差。</p>',
      '</div>',
      '<div class="absolute-boundary-verdict">',
        '<span>目前最強結論</span>',
        '<strong>年／月界未重現</strong>',
        '<small>特定民用時刻的完整四柱仍需 Day / Hour 與深時間 civil-time 證據。</small>',
      '</div>',
    '</header>',
    '<div class="absolute-boundary-stats">',
      '<div class="primary"><span>12 個節的全年相位窗口</span><strong id="absolute-boundary-union">—</strong><small id="absolute-boundary-union-percent">—</small></div>',
      '<div><span>立春 · 年＋月界</span><strong id="absolute-boundary-li-chun">—</strong><small>目標邊界相對 Gregorian cycle 提前</small></div>',
      '<div><span>12 節提前範圍</span><strong id="absolute-boundary-range">—</strong><small id="absolute-boundary-largest">—</small></div>',
    '</div>',
    '<div class="absolute-boundary-strip-wrap">',
      '<div class="absolute-boundary-strip-key"><span>一個回歸年 · Li Chun → next Li Chun · TT phase</span><strong>淡帶＝相同公曆相位會落在不同月界 sector 的區間</strong></div>',
      '<svg id="absolute-boundary-strip" viewBox="0 0 1200 190" role="img" aria-label="+24,000 年十二個八字節界的 absolute disagreement windows"></svg>',
      '<div id="absolute-boundary-buttons" class="absolute-boundary-buttons" aria-label="十二節邊界；點選可同步 02 的黃經游標"></div>',
    '</div>',
    '<div class="absolute-boundary-pillar-summary">',
      '<div data-pillar="year"><span>年柱</span><strong>立春界位移 10.883 天</strong><small>不能再把 +24,000 當作年界 exact recurrence。</small></div>',
      '<div data-pillar="month"><span>月柱</span><strong>12 個月界全部位移</strong><small>各節提前 10.235–14.177 天。</small></div>',
      '<div data-pillar="day"><span>日柱</span><strong>仍未由此層解析</strong><small>需要 absolute civil-day phase 與日界約定。</small></div>',
      '<div data-pillar="hour"><span>時柱</span><strong>仍未由此層解析</strong><small>還需要地方時計時、經度與已解析日干。</small></div>',
    '</div>',
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
  end.textContent="next 立春";
}

function setText(id,value){
  const node=document.querySelector("#"+id);
  if(node)node.textContent=value;
}

function render(){
  const root=ensurePanel();
  if(!root)return;
  setText("absolute-boundary-union",CONSEQUENCE.unionWindowDays.toFixed(3)+" d");
  setText("absolute-boundary-union-percent","全年 TT 相位 "+CONSEQUENCE.unionWindowPercent.toFixed(3)+"% · 非人口機率");
  setText("absolute-boundary-li-chun","提前 "+CONSEQUENCE.liChunBoundary.widthDays.toFixed(3)+" d");
  setText("absolute-boundary-range",CONSEQUENCE.minBoundaryDays.toFixed(3)+"–"+CONSEQUENCE.maxBoundaryDays.toFixed(3)+" d");
  setText("absolute-boundary-largest","最大："+CONSEQUENCE.largestBoundary.name+" · "+CONSEQUENCE.largestBoundary.widthDays.toFixed(3)+" d");
  setText(
    "absolute-boundary-note-copy",
    "這是 uniform-TT / Gregorian-cycle 下的幾何 boundary window："+
    CONSEQUENCE.boundaries.length+" 個節界的聯集為 "+CONSEQUENCE.unionWindowDays.toFixed(3)+
    " 天。它不是人口上的錯誤率，也不是西元 26026 的 UTC／政治時區預測；year-26026 frame 尚未獨立驗證，因此維持 research-only。"
  );
  renderStrip();
  root.dataset.ready="true";
  rendered=true;
}

function demoteDeterminacy(){
  let details=determinacy.querySelector(":scope > .shape-only-determinacy-details");
  if(details)return;
  const grid=determinacy.querySelector(":scope > .determinacy-grid");
  const foot=determinacy.querySelector(":scope > .determinacy-foot");
  if(!grid||!foot)return;
  details=document.createElement("details");
  details.className="shape-only-determinacy-details";
  const summary=document.createElement("summary");
  summary.innerHTML="<span>展開 shape-only 四柱卡片</span><strong>僅解釋共同 phase 扣除後的年內 shape</strong>";
  grid.insertAdjacentElement("beforebegin",details);
  details.append(summary,grid,foot);
}

function restoreDeterminacy(){
  const details=determinacy.querySelector(":scope > .shape-only-determinacy-details");
  if(!details)return;
  const grid=details.querySelector(".determinacy-grid");
  const foot=details.querySelector(".determinacy-foot");
  if(grid)details.insertAdjacentElement("beforebegin",grid);
  if(foot)details.insertAdjacentElement("beforebegin",foot);
  details.remove();
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
    instrument.dataset.absoluteBoundaryYearMonthRecurrence="displaced";
    instrument.dataset.absoluteBoundaryUnionDays=CONSEQUENCE.unionWindowDays.toFixed(6);
    instrument.dataset.absoluteBoundaryUnionPercent=CONSEQUENCE.unionWindowPercent.toFixed(6);

    determinacy.classList.add("shape-only-secondary");
    determinacy.dataset.absolutePrimary="true";
    const label=determinacy.querySelector(".determinacy-label");
    const scopeLabel=determinacy.querySelector(".determinacy-scope span");
    if(label)label.textContent="shape-only 輔助判定";
    if(scopeLabel)scopeLabel.textContent="春分歸零後的舊模型內結論";
    let note=determinacy.querySelector(".determinacy-secondary-note");
    if(!note){
      note=document.createElement("div");
      note.className="determinacy-secondary-note";
      determinacy.querySelector(".determinacy-head")?.insertAdjacentElement("afterend",note);
    }
    note.textContent="下列卡片只保留「共同 phase 已扣除」後的 shape-only 歸因；+24,000 的年／月界主結論以上方 absolute boundary consequence 為準。";
    demoteDeterminacy();
  }else{
    delete instrument.dataset.absoluteBoundaryConsequence;
    delete instrument.dataset.absoluteBoundaryYearMonthRecurrence;
    delete instrument.dataset.absoluteBoundaryUnionDays;
    delete instrument.dataset.absoluteBoundaryUnionPercent;

    determinacy.classList.remove("shape-only-secondary");
    delete determinacy.dataset.absolutePrimary;
    const label=determinacy.querySelector(".determinacy-label");
    const scopeLabel=determinacy.querySelector(".determinacy-scope span");
    if(label)label.textContent="可判定範圍";
    if(scopeLabel)scopeLabel.textContent="目前可支持的最強結論";
    determinacy.querySelector(".determinacy-secondary-note")?.remove();
    restoreDeterminacy();
  }
}

if(evidence&&instrument&&determinacy){
  ensureStyles();
  sync();
  new MutationObserver(sync).observe(instrument,{
    attributes:true,
    attributeFilter:["data-base-date","data-delta-years"]
  });
}
