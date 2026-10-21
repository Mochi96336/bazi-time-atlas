import { projectUnfoldedPhases } from "./r17-unfolded-phase-projection.js";

const NS="http://www.w3.org/2000/svg";
const C=Object.freeze({
  text:"#eef2f2",muted:"#b2bdc1",faint:"#87959a",
  closed:"#75cddd",open:"#dfb86d",unavailable:"#7c878d"
});

export function zeroProofNarrative(rows) {
  if(!Array.isArray(rows)||rows.length!==3)throw new TypeError("three projected phases are required");
  if(rows.some(row=>!row.available))return Object.freeze({
    state:"unavailable",title:"目前部分相位不可判定",
    detail:"目前的目標日期不足以完整判定三個離散相位。",
    bridge:"尚不能從離散條件下結論；實際太陽節界也需要獨立驗證。"
  });
  if(rows.every(row=>row.closed))return Object.freeze({
    state:"all-closed",title:"三個離散條件已歸零",
    detail:"公曆結構、年序與日序均同相位；節氣仍須在 02 驗真。",
    bridge:"三項離散相位同時歸零；真正的十二節界是否也回到原位置，接著交給 02 驗真。"
  });
  if(rows[1].closed&&rows[2].closed)return Object.freeze({
    state:"year-day-closed",title:"年序、日序已重合",
    detail:"公曆結構尚未回到基準，偏移量交給右側圖形說明。",
    bridge:"年序、日序已重遇；公曆只是季節位置代理。下一步，要看實際節界是否也接近基準。"
  });
  if(rows[0].closed)return Object.freeze({
    state:"gregorian-closed",title:"公曆結構已歸零",
    detail:"年序與日序仍有位移，因此還不是共同重遇。",
    bridge:"公曆結構先歸零，但年序與日序還有位移；即使離散條件都滿足，也仍須檢查節界。"
  });
  return Object.freeze({
    state:"mixed",title:"三個條件尚未同時重遇",
    detail:"從共同零點分別讀取未閉合週期的最短偏移。",
    bridge:"離散條件尚未一起重遇；它們與真正的太陽節界是兩種不同精度的判定。"
  });
}
const signedLabel=value=>value===null?"—":value===0?"0":(value>0?"+":"−")+Math.abs(value);
const color=row=>!row.available?C.unavailable:row.closed?C.closed:C.open;
function element(svg,name,attrs,content){
  const node=svg.ownerDocument.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  if(content!==undefined)node.textContent=content;
  svg.append(node);
  return node;
}

/**
 * Paint-only projection of recurrenceState. Do not create another time owner:
 * fractional x coordinates represent half-cycles *within* each phase, never
 * a shared number of years or days across the three rows.
 */
export function renderR17ZeroProof(svg,state,{mobile=false}={}){
  if(!svg)throw new TypeError("proof svg is required");
  const rows=projectUnfoldedPhases(state);
  const verdict=zeroProofNarrative(rows);
  const W=mobile?370:720,zero=W*(mobile?0.6:0.575);
  const half=Math.min(zero-27,W-zero-29);
  const [g,year,day]=rows;
  svg.replaceChildren();
  svg.setAttribute("viewBox","0 0 "+W+" 322");
  svg.dataset.figureGrammar="zero-proof-plate";
  svg.dataset.evidenceState=verdict.state;
  svg.dataset.gregorianSigned=String(g.signed);
  svg.dataset.yearSigned=String(year.signed);
  svg.dataset.daySigned=String(day.signed);
  const add=(name,attrs,value)=>element(svg,name,attrs,value);
  add("text",{x:26,y:26,fill:C.muted,"font-size":13},"公曆結構 / 400 年週期");
  add("text",{x:26,y:104,fill:color(g),"font-size":mobile?46:56,"font-weight":550},signedLabel(g.signed));
  add("text",{x:26,y:131,fill:C.muted,"font-size":13},
    g.closed?"公曆回到 0 相位":!g.available?"公曆位置不可判":"年 · 距共同零點的最短位移");
  add("path",{d:"M "+zero+" 79 V 304",stroke:C.muted,"stroke-width":1,
    "stroke-dasharray":"2 7",opacity:0.57,fill:"none"});
  add("text",{x:zero,y:64,fill:C.muted,"font-size":13,"text-anchor":"middle"},"共同 0");
  add("line",{x1:zero-half,y1:164,x2:zero+half,y2:164,stroke:C.muted,"stroke-width":1,opacity:0.3});
  add("text",{x:zero-half,y:186,fill:C.faint,"font-size":11},"−200");
  add("text",{x:zero+half,y:186,fill:C.faint,"font-size":11,"text-anchor":"end"},"+200");
  if(g.available){
    const x=zero+half*g.fraction;
    if(!g.closed)add("line",{x1:x,y1:164,x2:zero,y2:164,
      stroke:color(g),"stroke-width":4,"stroke-linecap":"round"});
    add("circle",{cx:x,cy:164,r:5.5,fill:color(g)});
  }
  for(const [i,row] of [year,day].entries()){
    const v=i===0?230:296;
    add("text",{x:26,y:v-11,fill:C.text,"font-size":16},row.label);
    add("text",{x:26,y:v+13,fill:C.muted,"font-size":12},
      row.closed?"回到基準":!row.available?"目前不可判":"週期 "+row.modulus+" "+row.unit);
    if(row.available&&!row.closed){
      const width=half*(i===0?0.77:0.61),x=zero+width*row.fraction;
      add("line",{x1:zero-width,y1:v,x2:zero+width,y2:v,stroke:C.muted,"stroke-width":1,opacity:0.3});
      add("line",{x1:x,y1:v,x2:zero,y2:v,stroke:color(row),"stroke-width":3,"stroke-linecap":"round"});
      add("circle",{cx:x,cy:v,r:5,fill:color(row)});
    }else add("circle",{cx:zero,cy:v,r:5,fill:color(row)});
    add("text",{x:W-25,y:v+5,fill:color(row),"font-size":14,"text-anchor":"end"},
      row.available?signedLabel(row.signed)+" "+row.unit:"—");
  }
  svg.dataset.proofReady="true";
  return verdict;
}
