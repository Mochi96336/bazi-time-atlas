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
  panel.dataset.targetYearFrameIndependentlyValidated="false";
  panel.setAttribute("aria-label","+24,000 年對時間到八字映射的研究結論");
  panel.innerHTML=[
    '<header class="absolute-boundary-head research-conclusion-head">',
      '<div>',
        '<h3>年柱、月柱一樣，為什麼還不算週期？</h3>',
        '<p>因為「一樣」和「週期」比的是兩件不同的事。</p>',
      '</div>',
    '</header>',
    
    '<div class="research-alignment-fork">',
      '<article data-alignment-claim="solar"><span>比「太陽走到同一個位置」</span><strong>年柱、月柱可以一樣</strong><small>等太陽走到同一個位置再比，年柱和月柱會回到同一組干支。但那一刻已經不是日曆上的同一天。</small></article>',
      '<article data-alignment-claim="calendar"><span>比「日曆上的同一天」</span><strong>節氣沒有回到原位</strong><small>固定往後 24,000 個公曆年，十二個節都提早 '+CONSEQUENCE.minBoundaryDays.toFixed(1)+'–'+CONSEQUENCE.maxBoundaryDays.toFixed(1)+' 天（02 的圖；深時間模型推算，26026 年框架尚未獨立驗證）。週期要的是這一種：同一天、同一刻，四柱全部一樣。</small></article>',
    '</div>',
    '<p class="absolute-boundary-note"><strong>日柱、時柱是「不知道」，不是「一定不同」。</strong>上面的誤差圖只說明它們算不準，不能反過來說 24,000 年後的四柱一定不一樣。</p>'
  ].join("");

  // Research redesign R4: the pillar verdict is the 03 figure; the two
  // reference frames explain it on demand, inside "why this is not a
  // contradiction" right after the verdict.
  const why=document.querySelector("#research-evidence-why");
  if(why)why.append(panel);
  else determinacy.insertAdjacentElement("afterend",panel);
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
