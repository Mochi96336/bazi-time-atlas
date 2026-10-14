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

function dump(seasonalView,delta=24000){
  const url=new URL("recurrence.html",base);
  url.searchParams.set("date","2026-09-13");
  url.searchParams.set("delta",String(delta));
  if(seasonalView)url.searchParams.set("seasonalView",seasonalView);

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
    throw Error("prototype browser failed:\n"+(result.stderr??"").slice(-5000));
  }
  return {url:url.href,dom:result.stdout??"",stderr:result.stderr??""};
}

function fragment(dom){
  const start=dom.indexOf('id="seasonal-drift-prototype"');
  const end=start>=0?dom.indexOf('class="seasonal-drift-secondary-rail"',start):-1;
  return start>=0?dom.slice(start,end>start?end:start+16000):dom.slice(0,16000);
}

function requireTokens(probe,tokens,label){
  const missing=tokens.filter(token=>!probe.dom.includes(token));
  if(!missing.length)return;
  throw Error(
    label+" missing "+missing.join(", ")+"\n"+
    "url: "+probe.url+"\n"+
    "stderr:\n"+probe.stderr.slice(-5000)+"\n"+
    "prototype DOM:\n"+fragment(probe.dom).slice(0,16000)
  );
}

const total=dump("total");
requireTokens(total,[
  'data-ready="true"',
  'data-mode="total"',
  'class="seasonal-drift-curve-path"',
  'seasonal-orbit-target',
  'class="seasonal-drift-gap-line"',
  'id="seasonal-drift-selected-total-human">提前 10.883 天',
  'id="seasonal-drift-phase-value">−12.206 d',
  'data-case-aligned="true"',
  '已收起 · Berger shape-only / 近回歸工具',
  'data-case-state="aligned"',
  'id="absolute-boundary-consequence"',
  'data-ready="true"',
  'id="absolute-boundary-union">146.481 d',
  '全年 TT 相位 40.105% · 非人口機率',
  '年／月界未重現',
  'shape-only-secondary',
  'shape-only-determinacy-details'
],"total seasonal prototype");

const alignedToolsTag=total.dom.match(/<details[^>]*id="secondary-astronomy-tools"[^>]*>/)?.[0]??"";
if(!alignedToolsTag||/\sopen(?:\s|=|>)/.test(alignedToolsTag)){
  throw Error("aligned +24k state did not collapse secondary astronomy tools: "+total.url);
}

const split=dump("split");
requireTokens(split,[
  'data-ready="true"',
  'data-mode="split"',
  'id="seasonal-drift-selected-shape">+1.322 d',
  'id="seasonal-drift-shape-span">4.022 d',
  'data-seasonal-drift-mode="split" aria-pressed="true"',
  'seasonal-orbit-target'
],"split seasonal prototype");

if(split.dom.includes('class="seasonal-drift-gap-line"')){
  throw Error("split seasonal prototype kept the total-view zero-gap marker: "+split.url);
}

const identity=dump("total",0);
requireTokens(identity,[
  'data-case-aligned="false"',
  'id="absolute-boundary-consequence"',
  'data-active="false"',
  'data-case-state="other"',
  '目前 Δ = 0 年 · 展開快速模型'
],"non-24k seasonal prototype");
const otherToolsTag=identity.dom.match(/<details[^>]*id="secondary-astronomy-tools"[^>]*>/)?.[0]??"";
if(!otherToolsTag||!/\sopen(?:\s|=|>)/.test(otherToolsTag)){
  throw Error("non-24k state did not keep secondary astronomy tools open: "+identity.url);
}
if(identity.dom.includes("shape-only-secondary")){
  throw Error("non-24k state incorrectly demoted canonical determinacy: "+identity.url);
}

console.log("[seasonal-drift-prototype] PASS total + split + non-24k gating and Research 03 handoff");
