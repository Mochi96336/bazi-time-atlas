import { spawnSync } from "node:child_process";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";

function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const c of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+c],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw Error("Chromium missing");
}

const browser=findBrowser();

function dump(seasonalView,delta=0,hash=""){
  const url=new URL("recurrence.html",base);
  url.searchParams.set("date","2026-09-13");
  url.searchParams.set("delta",String(delta));
  if(seasonalView)url.searchParams.set("seasonalView",seasonalView);
  if(hash)url.hash=hash;

  const result=spawnSync(browser,[
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--enable-logging=stderr",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=5000",
    "--dump-dom",
    url.href
  ],{encoding:"utf8",timeout:35000,maxBuffer:20*1024*1024});

  if(result.status!==0){
    throw Error("seasonal evidence browser failed:\n"+(result.stderr??"").slice(-5000));
  }
  return {url:url.href,dom:result.stdout??"",stderr:result.stderr??""};
}

function requireTokens(probe,tokens,label){
  const missing=tokens.filter(token=>!probe.dom.includes(token));
  if(!missing.length)return;
  throw Error(label+" missing "+missing.join(", ")+"\nurl: "+probe.url);
}

function detailsTag(dom,id){
  return dom.match(new RegExp('<details[^>]*id="'+id+'"[^>]*>'))?.[0]??"";
}

for(const delta of [0,400,1980,24000]){
  const total=dump("total",delta);
  requireTokens(total,[
    'id="seasonal-drift-evidence"',
    'data-diagram-grammar="zero-line-proof"',
    'id="seasonal-boundary-proof-svg"',
    'class="seasonal-proof-zero"',
    'class="seasonal-orbit-time-ring"',
    'data-ready="true"',
    'data-mode="total"',
    'class="seasonal-drift-curve-path"',
    'data-grammar="absolute-plus-residual"',
    'class="seasonal-residual-path"',
    '0 = 全年平均'
    '0 = 完全重合',
    '先看結論 · 八字節界',
    'id="seasonal-drift-selected-total-human">提前 10.883 天',
    'id="absolute-boundary-consequence"',
    'research-recurrence-conclusion',
    '≠ 完整「時間 → 八字」精確週期',
    'data-diagram-grammar="pillar-verdict"',
    'data-diagram-grammar="alignment-fork"',
    '固定推進 24,000 公曆年',
    '節界時間沒有重現',
    'id="four-pillar-determinacy"',
    'data-mode="shared-seasonal"',
    'data-selected-longitude="315"',
    '年／月可回同柱 · 日／時未能判定',
    '探索工具 · 目前 Δ = '+delta.toLocaleString("en-US")+' 年 · 不影響上方固定 24,000 年主線'
  ],"always-visible main story @ delta="+delta);

  if(total.dom.includes("seasonal-drift-case-gate")||total.dom.includes("data-case-aligned")){
    throw Error("retired +24k gate returned: "+total.url);
  }

  const tools=detailsTag(total.dom,"secondary-astronomy-tools");
  if(!tools||/\sopen(?:\s|=|>)/.test(tools)){
    throw Error("other-delta sandbox must stay closed by default: "+total.url);
  }

  const decomposition=detailsTag(total.dom,"seasonal-drift-decomposition");
  if(!decomposition||/\sopen(?:\s|=|>)/.test(decomposition)){
    throw Error("drift decomposition must stay folded in the main 02 story: "+total.url);
  }
}


const split=dump("split",0);
requireTokens(split,[
  'data-mode="split"',
  'id="seasonal-drift-selected-shape">−1.322 d',
  'id="seasonal-drift-shape-span">4.022 d',
  'data-seasonal-drift-mode="split" aria-pressed="true"',
  '研究方法：共同提前與年內起伏怎麼分開？',
  'seasonal-orbit-target'
],"split fixed deep-dive story");
const splitDecomposition=detailsTag(split.dom,"seasonal-drift-decomposition");
if(!splitDecomposition||!/\sopen(?:\s|=|>)/.test(splitDecomposition)){
  throw Error("split query must open the drift decomposition detail: "+split.url);
}
if(!split.dom.includes('class="seasonal-residual-path"')||!split.dom.includes('class="seasonal-drift-curve-path"')){
  throw Error("split mode lost one of the always-visible coupled curves: "+split.url);
}

const deep=dump("total",0,"near-recurrence-detail");
const deepTools=detailsTag(deep.dom,"secondary-astronomy-tools");
if(!deepTools||!/\sopen(?:\s|=|>)/.test(deepTools)){
  throw Error("deep link did not reopen the folded delta sandbox: "+deep.url);
}

console.log("[seasonal-drift-evidence] PASS fixed +24k story stays visible across delta sandbox states");