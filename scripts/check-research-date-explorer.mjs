import { spawnSync } from "node:child_process";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";

function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const browser of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const p=spawnSync("sh",["-lc","command -v "+browser],{encoding:"utf8"});
    if(p.status===0&&p.stdout.trim())return p.stdout.trim();
  }
  throw Error("No Chromium/Chrome executable available");
}
function dump(path,budget=9000){
  const url=new URL(path,baseURL).href;
  const p=spawnSync(findBrowser(),[
    "--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",
    "--force-device-scale-factor=1","--run-all-compositor-stages-before-draw",
    "--virtual-time-budget="+budget,"--window-size=500,1800","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:24*1024*1024});
  if(p.status!==0)throw Error("Chromium failed: "+url+"\n"+p.stderr?.slice(-1300));
  return {url,dom:p.stdout};
}
function opening(dom,id,kind="section"){
  const p=dom.indexOf('id="'+id+'"'); if(p<0)return "";
  const a=dom.lastIndexOf("<"+kind,p), b=dom.indexOf(">",p);
  return a<0||b<0?"":dom.slice(a,b+1);
}
function attr(tag,name){
  return tag.match(new RegExp(name+'="([^"]*)"'))?.[1]??null;
}

// Public Research must contain ONLY the original instrument / strip path.
const home=dump("recurrence.html");
const instrument=opening(home.dom,"recurrence-instrument");
const strip=opening(home.dom,"research-year-strip");
if(
  home.dom.includes('id="research-free-explorer"') ||
  home.dom.includes('id="research-one-year-story"') ||
  home.dom.includes('id="research-free-day-wheel"') ||
  home.dom.includes('research-date-explorer.css') ||
  home.dom.includes('research-free-day-wheel.css') ||
  attr(instrument,"data-target-date")===null ||
  attr(strip,"data-ready")!=="true" ||
  !home.dom.includes('id="research-year-full-cycle"') ||
  !home.dom.includes("日序走過 6 輪") ||
  home.dom.includes('class="research-cycles-card') ||
  !home.dom.includes('id="research-cycle-comparison" class="research-cycle-inline"')
) throw Error("R3 public Research still exposes or depends on the retired parallel UI: "+home.url);
console.log("[research-r3] PASS public Research has one original instrument + one original Year strip");

// Preserve old shared URLs without resurrecting their UI: old compare becomes
// the original date at delta=0 and audit metadata remembers the old base.
const legacy=dump("recurrence.html?mode=dates&base=2024-02-01&compare=2024-02-10&wheel=open");
const legacyInstrument=opening(legacy.dom,"recurrence-instrument");
const legacyStrip=opening(legacy.dom,"research-year-strip");
if(
  legacy.dom.includes('id="research-free-explorer"') ||
  attr(legacyInstrument,"data-base-date")!=="2024-02-10" ||
  attr(legacyInstrument,"data-target-date")!=="2024-02-10" ||
  attr(legacyInstrument,"data-delta-years")!=="0" ||
  attr(legacyInstrument,"data-legacy-date-link-migrated")!=="compare-to-original-date" ||
  attr(legacyInstrument,"data-legacy-date-link-base")!=="2024-02-01" ||
  attr(legacyStrip,"data-ready")!=="true"
) throw Error("Legacy ?mode=dates URL did not migrate safely into the original date owner: "+legacy.url);
console.log("[research-r3] PASS old mode=dates link migrates compare→original date owner, no second UI");

// True native geometry + R1/R2 authority/gesture guards.
for(const suffix of ["?bare=1","?interactive=1","?boundary=1","?preciseBoundary=before","?preciseBoundary=after","?width=320","?width=768","?desktop=1","?deep=1","?precise=1"]){
  const proof=dump("scripts/fixtures/research-original-r0-390.html"+suffix,15000);
  const tag=opening(proof.dom,"probe","output");
  if(
    attr(tag,"data-ready")!=="true" ||
    attr(tag,"data-original-strip")!=="visible" ||
    attr(tag,"data-original-evidence")!=="visible" ||
    attr(tag,"data-duplicate-story")!=="absent"
  ) throw Error("Original-strip proof failed "+suffix+": "+(attr(tag,"data-error")??proof.url));
}
console.log("[research-r3] PASS 320/390/768/1440 original strip, Li Chun ambiguity, drag guards and deep-delta ownership");
