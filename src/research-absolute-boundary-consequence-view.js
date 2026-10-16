import {
  ABSOLUTE_BOUNDARY_CONSEQUENCE_24000 as CONSEQUENCE
} from "./research/seasonal-absolute-boundary-consequence.js";

const evidence=document.querySelector("#research-evidence");
const instrument=document.querySelector("#recurrence-instrument");
const determinacy=document.querySelector("#four-pillar-determinacy");
let panel=null;

function ensurePanel(){
  if(panel?.isConnected)return panel;
  if(!evidence||!determinacy)return null;

  panel=document.createElement("section");
  panel.id="absolute-boundary-consequence";
  panel.className="absolute-boundary-consequence research-recurrence-conclusion";
  panel.dataset.ready="true";
  panel.dataset.diagramGrammar="alignment-fork";
  panel.setAttribute("aria-label","+24,000 年對時間到八字映射的研究結論");
  panel.innerHTML=[
    '<header class="absolute-boundary-head research-conclusion-head">',
      '<div>',
        '<div class="eyebrow">研究結論 · 01 → 02 → 03</div>',
        '<h3>為什麼「年／月可回同柱」與「24,000 不是完整週期」能同時成立？</h3>',
        '<p>因為兩句話對齊的基準不同：一條固定太陽位置，一條固定公曆時間。把 reference frame 分開後，結論並不矛盾。</p>',
      '</div>',
    '</header>',
    '<div class="research-fork-source"><span>同一 +24,000 年離散候選</span></div>',
    '<div class="research-alignment-fork">',
      '<article data-alignment-claim="solar"><span>對齊同一太陽黃經</span><strong>年／月可回到同柱</strong><small>同一節界方向 + 60 年序閉合；實際干支與目前選定黃經看下方四柱判定帶。</small></article>',
      '<article data-alignment-claim="calendar"><span>固定推進 24,000 公曆年</span><strong>節界時間沒有重現</strong><small>12 / 12 節界提前 '+CONSEQUENCE.minBoundaryDays.toFixed(3)+'–'+CONSEQUENCE.maxBoundaryDays.toFixed(3)+' 天；證據已在 02 顯示，不在 03 重畫。</small></article>',
    '</div>',
    '<p class="absolute-boundary-note"><strong>日／時仍是「未能判定」：</strong>節界未重現可以否定整套固定精確週期，但不能直接偷換成「每個相隔 24,000 年的四柱一定不同」。深時間民用日、日界與地方時證據仍不足。</p>'
  ].join("");

  determinacy.insertAdjacentElement("afterend",panel);
  return panel;
}

function publishFixedEvidence(){
  const root=ensurePanel();
  if(!root)return;

  instrument.dataset.absoluteBoundaryConsequence="year-26026-research";
  instrument.dataset.absoluteBoundaryReferenceJie="displaced";
  instrument.dataset.absoluteBoundaryJieCount=String(CONSEQUENCE.boundaries.length);
  instrument.dataset.absoluteBoundaryMinDays=CONSEQUENCE.minBoundaryDays.toFixed(6);
  instrument.dataset.absoluteBoundaryMaxDays=CONSEQUENCE.maxBoundaryDays.toFixed(6);
}

if(evidence&&instrument&&determinacy){
  publishFixedEvidence();
}
