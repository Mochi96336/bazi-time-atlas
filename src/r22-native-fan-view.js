import {r22PhaseSnapshot} from "./recurrence/r22-phase-motion-model.js";

// R22 P2 is a view-only opt-in over the actual R16 wheel and time owner.
// It never adds an alternate delta slider, timeline or canonical calendar.
const enabled=new URLSearchParams(location.search).get("r22")==="1";
if(enabled){
 const root=document.documentElement;
 const section=document.querySelector("#research-discrete");
 const instrument=document.querySelector("#recurrence-instrument");
 const thesis=document.querySelector("#research-discrete-thesis");
 const controls=section?.querySelector(".discrete-derivation");
 if(!section||!instrument||!thesis||!controls)throw Error("R22 original Research structure missing");
 root.dataset.researchR22="true";

 // Put the real wheel and its original controls first in the DOM and screen-reader
 // order; CSS order alone would not repair keyboard/reading order.
 const hero=document.createElement("div");
 hero.className="r22-hero-preface";
 hero.innerHTML='<span class="r22-chapter-number">01 · 同一零點</span>'+
  '<h3 id="r22-fan-title">還差多少，三層才會同時對齊？</h3>'+
  '<p>沿用原本的三層半圓。標記表示距離基準零點的最短相位差，不是實際累積旋轉圈數。</p>';
 section.insertBefore(hero,thesis);
 section.insertBefore(instrument,thesis);
 section.insertBefore(controls,thesis);
 instrument.setAttribute("aria-labelledby","r22-fan-title");
 // One unobtrusive narrative caption for the ORIGINAL play button, not a new controller.
 const cue=document.createElement("p");
 cue.id="r22-playback-cue";
 cue.className="r22-playback-cue";
 cue.setAttribute("role","status");
 cue.setAttribute("aria-live","polite");
 cue.textContent="播放將逐年接近重要對齊點；大段時間會明確跳轉。";
 controls.querySelector(".research-delta-public-slider")?.after(cue);

 const reading=document.createElement("section");
 reading.className="r22-phase-reading";
 reading.setAttribute("aria-label","目前三項距離零點的差值");
 reading.innerHTML='<span class="r22-reading-index">相位對照 · 真實整數年取樣</span>'+
  '<div class="r22-reading-delta"><span>經過</span> <strong id="r22-current-delta">—</strong> <span>年</span></div>'+
  '<h4 id="r22-verdict" aria-live="polite">讀取目前的對齊條件</h4>'+
  '<p id="r22-description"></p>'+
  '<div class="r22-reading-layers" role="list" aria-label="三種不同量綱的最短相位差">'+
    '<div role="listitem" class="r22-reading-layer" data-r22-key="gregorian">'+
      '<span>外層 · 公曆結構 <small>400 年</small></span><strong>—</strong></div>'+
    '<div role="listitem" class="r22-reading-layer" data-r22-key="yearSequence">'+
      '<span>中層 · 名義年序 <small>60 年</small></span><strong>—</strong></div>'+
    '<div role="listitem" class="r22-reading-layer" data-r22-key="day">'+
      '<span>內層 · 日序 <small>60 日</small></span><strong>—</strong></div>'+
  '</div>'+
  '<p class="r22-model-caveat">三層各有自己的單位；亮起的 0 表示該項離散閉合，並不等於完整八字重遇。</p>';
 instrument.querySelector(".research-fan-graphic").after(reading);
 const labels={gregorian:"公曆",yearSequence:"年序",day:"日序"};
 const units={gregorian:"年",yearSequence:"年",day:"日"};
 const signed=v=>v===0?"0":v>0?"+"+v:"−"+Math.abs(v);
 const fmt=v=>v.toLocaleString("en-US");
 let last=null;
 function update(){
  const baseText=instrument.dataset.baseDate;
  const delta=Number(instrument.dataset.deltaYears);
  if(!baseText||!Number.isInteger(delta)||delta<0)return;
  const parts=baseText.split("-").map(Number);
  if(parts.length!==3||parts.some(n=>!Number.isInteger(n)))return;
  const base={year:parts[0],month:parts[1],day:parts[2]};
  const signature=baseText+"/"+delta;
  if(signature===last)return;
  const state=r22PhaseSnapshot(base,delta);
  const closed=state.closedKeys;
  const missing=["gregorian","yearSequence","day"].filter(key=>!state.layers[key].closed);
  let verdict,detail,status;
  if(delta===0){
   status="identity";verdict="三個零點重合，這是基準狀態";
   detail="從 Δ＝0 出發，觀察不同週期如何分離，再在共同倍數重新相遇。";
  }else if(!state.targetValid){
   status="invalid";verdict="此年份的同月同日不存在";
   detail="日序沒有有效日數，不能把缺失資料畫成歸零。";
  }else if(state.commonClosed){
   status="all";verdict="三項同時回到 0";
   detail="這是離散候選；是否真正重回相同節氣與四柱，仍需研究 02／03 驗真。";
  }else if(closed.length===2){
   status="two";const key=missing[0],offset=signed(state.layers[key].signed);
   verdict=closed.map(k=>labels[k]).join("與")+"已對齊";
   detail="還差"+labels[key]+" "+offset+" "+units[key]+"。";
  }else if(closed.length===1){
   status="one";verdict="只有"+labels[closed[0]]+"回到 0";
   detail=missing.map(key=>labels[key]+" "+signed(state.layers[key].signed)+" "+units[key]).join("；")+"。";
  }else{
   status="none";verdict="三項尚未同時對齊";
   detail="比較三層標記與共同零點的距離，觀察何時出現雙重對齊。";
  }
  document.querySelector("#r22-current-delta").textContent=fmt(delta);
  // Avoid repeating the same live-region announcement on every playback year.
  const verdictNode=document.querySelector("#r22-verdict");
  const detailNode=document.querySelector("#r22-description");
  if(verdictNode.textContent!==verdict)verdictNode.textContent=verdict;
  if(detailNode.textContent!==detail)detailNode.textContent=detail;
  for(const key of ["gregorian","yearSequence","day"]){
   const layer=state.layers[key],entry=reading.querySelector('[data-r22-key="'+key+'"]');
   entry.dataset.r22Closed=String(layer.closed);
   entry.dataset.r22Available=String(layer.available);
   entry.querySelector("strong").textContent=layer.available
     ?(layer.closed?"0":signed(layer.signed))+" "+units[key]
     :"無法判定";
   entry.dataset.r22Gap=layer.available?String(layer.signed):"invalid";
  }
  root.dataset.r22Ready="true";
  root.dataset.r22Status=status;
  instrument.dataset.r22Status=status;
  instrument.dataset.r22ClosureCount=String(closed.length);
  last=signature;
 }
 const observer=new MutationObserver(update);
 observer.observe(instrument,{attributes:true,attributeFilter:["data-base-date","data-delta-years"]});
 update();
}