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

const url=new URL("recurrence.html",base);
url.searchParams.set("date","2026-09-13");
url.searchParams.set("delta","24000");

const browser=findBrowser();
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

const dom=result.stdout??"";
const start=dom.indexOf('id="seasonal-drift-prototype"');
const end=start>=0?dom.indexOf('id="astronomy-term-grid"',start):-1;
const fragment=start>=0?dom.slice(start,end>start?end:start+12000):dom.slice(0,12000);

const required=[
  'data-ready="true"',
  'class="seasonal-drift-curve-path"',
  'seasonal-orbit-target',
  'id="seasonal-drift-selected-total">−10.883 d',
  'id="seasonal-drift-phase-value">−12.206 d'
];
const missing=required.filter(token=>!dom.includes(token));
if(missing.length){
  throw Error(
    "seasonal prototype did not initialize; missing "+missing.join(", ")+"\n"+
    "stderr:\n"+(result.stderr??"").slice(-6000)+"\n"+
    "prototype DOM:\n"+fragment.slice(0,12000)
  );
}

console.log("[seasonal-drift-prototype] live browser initialized and rendered linked curve/orbit");
