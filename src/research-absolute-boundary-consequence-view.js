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
  panel.setAttribute("aria-label","+24,000 年對時間到八字映射的研究結論");
  panel.innerHTML=[
    '<header class="absolute-boundary-head research-conclusion-head">',
      '<div>',
        '<div class="eyebrow">研究結論 · 01 → 02 → 03</div>',
        '<h3>24,000 年不是完整「時間 → 八字」映射的精確週期。</h3>',
        '<p>01 的離散年序／日序可以閉合；在 02 選同一太陽黃經位置時，年序也回到原位，月支又由同一黃經決定，所以年柱與月柱可以回到同柱。可是這些節界相對固定推進 24,000 個公曆年全部提前約 10–14 天，因此公曆／TT 時間落到八字節界的映射沒有一起重現。</p>',
      '</div>',
    '</header>',
    '<div class="research-conclusion-grid">',
      '<article data-conclusion="solar"><span>對齊太陽位置</span><strong>年／月可回到同柱</strong><small>同一黃經 + 60 年序閉合；目前選定太陽位置的實際干支看下方。</small></article>',
      '<article data-conclusion="calendar"><span>對齊公曆／TT 相位</span><strong>12 / 12 節界未重現</strong><small>十二「節」提前 '+CONSEQUENCE.minBoundaryDays.toFixed(3)+'–'+CONSEQUENCE.maxBoundaryDays.toFixed(3)+' 天；證據已在 02 顯示，不在 03 重畫。</small></article>',
      '<article data-conclusion="full"><span>完整四柱</span><strong>日／時仍未定</strong><small>深時間地球自轉、民用／地方鐘面與日界仍不足以唯一判定日柱／時柱。</small></article>',
    '</div>',
    '<p class="absolute-boundary-note"><strong>判讀邊界：</strong>「同一太陽位置的年／月柱可重現」與「相隔固定 24,000 年的所有時間都回到同一八字」不是同一件事；這裡否定的是整套固定週期，不代表每一個相隔 24,000 年的具體時刻都必然得到不同四柱。</p>'
  ].join("");

  determinacy.insertAdjacentElement("beforebegin",panel);
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