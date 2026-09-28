import { spawnSync } from "node:child_process";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";

function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const browser of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const probe=spawnSync("sh",["-lc","command -v "+browser],{encoding:"utf8"});
    if (probe.status===0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  throw new Error("No Chromium/Chrome executable available");
}

function dump(path,budget=7000) {
  const url = new URL(path,baseURL).href;
  const browser = spawnSync(findBrowser(),[
    "--headless=new","--no-sandbox","--disable-gpu",
    "--force-device-scale-factor=1","--hide-scrollbars",
    "--run-all-compositor-stages-before-draw","--virtual-time-budget="+budget,
    "--window-size=500,1000","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:20*1024*1024});
  if(browser.status!==0) {
    process.stderr.write(browser.stderr??"");
    throw new Error("Chromium explorer probe failed: "+url);
  }
  return {url,dom:browser.stdout};
}

function tag(dom,id,kind="section") {
  const pos=dom.indexOf('id="'+id+'"');
  if(pos<0) return "";
  const start=dom.lastIndexOf("<"+kind,pos);
  if(start<0) return "";
  return dom.slice(start,dom.indexOf(">",pos)+1);
}

function attr(opening,name) {
  return opening.match(new RegExp(name+'="([^"]*)"'))?.[1] ?? null;
}

// R0 regression: the default /recurrence.html MUST be the original Research
// instrument, original year strip and original evidence. Never make the
// replacement "一年怎麼走" story the public entry again.
const original=dump("recurrence.html",8500);
const originalRoot=tag(original.dom,"research-free-explorer");
const originalYearStrip=tag(original.dom,"research-year-strip");
const originalMode=/<body[^>]*>/.exec(original.dom)?.[0]??"";
if(
  !originalMode.includes('data-research-mode="annual"') ||
  !originalRoot.includes(" hidden") ||
  attr(originalYearStrip,"data-ready")!=="true" ||
  tag(original.dom,"research-discrete").includes(" hidden") ||
  tag(original.dom,"research-astronomy").includes(" hidden") ||
  tag(original.dom,"research-evidence").includes(" hidden") ||
  original.dom.includes('id="research-advanced-details"') ||
  original.dom.includes('class="research-mode-switch"')
) throw new Error("Bare Research entry MUST show original full Research and original year strip: "+original.url);
console.log("[explorer] PASS public Research entry restores original full research and year strip");

for(const path of [
  "recurrence.html?delta=0",
  "recurrence.html?mode=annual",
  "recurrence.html#research-discrete"
]){
  const legacy=dump(path);
  if(
    !(/<body[^>]*data-research-mode="annual"/.test(legacy.dom)) ||
    !tag(legacy.dom,"research-free-explorer").includes(" hidden") ||
    tag(legacy.dom,"research-discrete").includes(" hidden") ||
    attr(tag(legacy.dom,"research-year-strip"),"data-ready")!=="true"
  ) throw new Error("Existing annual deep link must remain inside the annual-only evidence mode: "+legacy.url);
}
console.log("[explorer] PASS explicit annual/query/hash deep links retain original recurrence authority");

const interaction=dump("scripts/fixtures/research-date-explorer-390.html",15000);
const probe=tag(interaction.dom,"probe","output");
if(attr(probe,"data-ready")!=="true") throw new Error(
  "Independent date explorer interaction proof failed: "+
  (attr(probe,"data-error")??"missing probe")+": "+interaction.url
);
const expected={
  "data-initial-mode":"dates",
  "data-wheel-select-preview-not-commit":"true",
  "data-wheel-keyboard-and-return":"true",
  "data-wheel-direct-picker-preview":"true",
  "data-wheel-direct-picker-invalid-recovery":"true",
  "data-wheel-same-date-refresh-preserves-exploration":"true",
  "data-wheel-strict-same-day-sixty":"true",
  "data-wheel-next-previous-roundtrip":"true",
  "data-wheel-annual-isolation":"true",
  "data-day-step-forward-and-back":"true",
  "data-day-step-sixty-cycle":"true",
  "data-day-step-advanced-sixty-hidden":"true",
  "data-day-step-advanced-reveals-sixty":"true",
  "data-day-step-share-url":"true",
  "data-mobile-glance-after-step":"true",
  "data-newyear-nominal-vs-active":"true",
  "data-out-of-range-preserves-state":"true",
  "data-boundary-reverse-step-recovers":"true",
  "data-initial-day-phase":"9",
  "data-initial-year-phase":"0",
  "data-initial-year-status":"model-estimated",
  "data-initial-day-changed":"true",
  "data-initial-astronomy-hidden":"true",
  "data-initial-four-pillars-hidden":"true",
  "data-mobile-viewport":"390",
  "data-mobile-tabs-in-bounds":"true",
  "data-mobile-form-in-bounds":"true",
  "data-one-year-story-first-screen":"true",
  "data-one-year-linked-playhead-first-screen":"true",
  "data-one-year-scrub-daily-and-boundary":"true",
  "data-one-year-scrub-dirty-edit-protected":"true",
  "data-one-year-scrub-burst-synchronized":"true",
  "data-one-year-slider-calendar-aligned":"true",
  "data-one-year-actual-not-nominal":"true",
  "data-one-year-dynamic-lichun":"true",
  "data-one-year-two-era-band":"true",
  "data-one-year-zoom-after-lichun":"true",
  "data-one-year-zoom-boundary-day-band":"true",
  "data-one-year-zoom-hides-far-date":"true",
  "data-one-year-leap-motion":"true",
  "data-one-year-switches-at-lichun":"true",
  "data-one-year-365-vs-366":"true",
  "data-one-year-advanced-evidence-retained":"true",
  "data-changed-day-phase":"10",
  "data-reversed-day-phase":"50",
  "data-reversed-elapsed-days":"-10",
  "data-invalid-hidden":"true",
  "data-recovered":"true",
  "data-annual-preserved":"true",
  "data-free-restored":"true"
};
for(const [name,value] of Object.entries(expected)){
  if(attr(probe,name)!==value) throw new Error(
    "Unexpected explorer fixture "+name+"="+attr(probe,name)+" expected "+value+": "+interaction.url
  );
}
console.log("[explorer] 49 year-playhead updates: "+attr(probe,"data-one-year-scrub-burst-milliseconds")+" ms (Chromium fixture)");
console.log("[explorer] PASS 390px real interactions, date edits, swap, invalid leap, mode isolation and URL restoration");

const direct=dump("recurrence.html?mode=dates&base=2024-02-04&compare=2024-02-10");
const root=tag(direct.dom,"research-free-explorer");
const hiddenOriginal=tag(direct.dom,"research-discrete");
if(
  attr(root,"data-ready")!=="true" ||
  attr(root,"data-base-active-year-status")!=="unresolved" ||
  attr(root,"data-target-active-year-status")!=="model-estimated" ||
  attr(root,"data-active-year-phase")!=="unavailable" ||
  attr(root,"data-day-phase")!=="6" ||
  !hiddenOriginal.includes(" hidden")
) throw new Error("Direct Li Chun boundary day must leave active year unresolved and hide annual-only evidence: "+direct.url);
console.log("[explorer] PASS Li Chun date-only uncertainty and separated nominal/day phases");

const invalid=dump("recurrence.html?mode=dates&base=2025-02-29&compare=2024-02-10");
const invalidRoot=tag(invalid.dom,"research-free-explorer");
if(
  attr(invalidRoot,"data-url-valid")!=="false" ||
  !invalid.dom.includes("分享網址日期不合法") ||
  attr(invalidRoot,"data-base-date")!=="2024-02-01"
) throw new Error("Malformed deep links must fail visibly and recover to a valid pair: "+invalid.url);
console.log("[explorer] PASS malformed deep-link fallback is visible and calendar-safe");

const annual=dump("recurrence.html?date=2026-09-13&delta=1980");
const annualRoot=tag(annual.dom,"research-free-explorer");
if(
  !annualRoot.includes(" hidden") ||
  attr(tag(annual.dom,"recurrence-instrument"),"data-delta-years")!=="1980" ||
  [tag(annual.dom,"research-discrete"),tag(annual.dom,"research-astronomy"),tag(annual.dom,"research-evidence")].some(value=>value.includes(" hidden"))
) throw new Error("Existing annual URL must keep its original recurrence and evidence sections visible: "+annual.url);
console.log("[explorer] PASS legacy annual deep link remains authoritative and unchanged");

const wheelLink=dump("recurrence.html?mode=dates&base=2024-02-01&compare=2024-02-10&wheel=open");
const linkedPanel=tag(wheelLink.dom,"research-free-day-wheel","details");
const linkedRoot=tag(wheelLink.dom,"research-free-explorer");
if(
  attr(linkedRoot,"data-ready")!=="true" ||
  attr(linkedPanel,"data-ready")!=="true" ||
  attr(linkedPanel,"data-selection-linked")!=="true" ||
  attr(linkedPanel,"data-current-date")!=="2024-02-10" ||
  !/\sopen(?:=|\s|>)/.test(linkedPanel) ||
  !wheelLink.dom.includes('id="research-free-day-wheel-svg"')
) throw new Error("Free-date wheel deep link failed: "+JSON.stringify({
  rootReady:attr(linkedRoot,"data-ready"),
  panelReady:attr(linkedPanel,"data-ready"),
  linked:attr(linkedPanel,"data-selection-linked"),
  date:attr(linkedPanel,"data-current-date"),
  opened:/\sopen(?:=|\s|>)/.test(linkedPanel),
  svg:wheelLink.dom.includes('id="research-free-day-wheel-svg"'),
  panelTag:linkedPanel.slice(0,450)
})+": "+wheelLink.url);
console.log("[explorer] PASS explicit free-wheel deep link initializes the separate selectable wheel");

