import { spawnSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const browser=process.env.CHROMIUM_BIN??["chromium","chromium-browser","google-chrome","google-chrome-stable"]
  .map(name=>spawnSync("sh",["-lc",`command -v ${name}`],{encoding:"utf8"}))
  .find(p=>p.status===0)?.stdout.trim();
if(!browser)throw new Error("Now F2: a real system Chromium is required");
const flags=["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--hide-scrollbars","--force-device-scale-factor=1","--virtual-time-budget=6500",
  "--run-all-compositor-stages-before-draw"];
const cases=[
  {width:320,height:844},{width:390,height:844},{width:480,height:844},
  {width:481,height:844},{width:820,height:900},{width:821,height:900},
  {width:1440,height:900},{width:2047,height:1038},
  {width:481,height:844,long:true},{width:1440,height:900,long:true},
  {width:1440,height:900,edit:true},{width:390,height:844,tools:true}
];
function attribute(dom,name){
  const tag=dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0]??"";
  return tag.match(new RegExp(`data-${name}="([^"]*)"`))?.[1]??null;
}
function num(dom,name){const n=Number(attribute(dom,name));if(!Number.isFinite(n))throw new Error("non-finite "+name);return n;}
function assert(ok,why,c){if(!ok)throw new Error(`Now F2 ${c.width}px ${c.edit?"editing":c.long?"long-year":c.tools?"tools":"normal"}: ${why}`);}
const out=path.resolve("tmp/visual-check");
mkdirSync(out,{recursive:true});
for(const c of cases){
  const args=new URLSearchParams({width:String(c.width),height:String(c.height)});
  if(c.long)args.set("long","1");
  if(c.edit)args.set("edit","1");
  if(c.tools)args.set("tools","1");
  const url=new URL("scripts/fixtures/now-readout-layout.html?"+args,baseURL).href;
  // Chromium has a 500px minimum window; the iframe owns the exact requested width.
  const viewport=[`--window-size=${Math.max(500,c.width+80)},${Math.max(900,c.height+80)}`];
  const result=spawnSync(browser,[...flags,...viewport,"--dump-dom",url],
    {encoding:"utf8",timeout:60000,maxBuffer:10*1024*1024});
  if(result.status!==0)throw new Error("Now F2 browser failure: "+url+" / "+result.stderr?.slice(-1400));
  const dom=result.stdout;
  assert(attribute(dom,"ready")==="true","fixture not ready: "+attribute(dom,"error"),c);
  assert(num(dom,"inner-width")===c.width,"wrong iframe width",c);
  assert(num(dom,"scroll-width")<=c.width+2,"page horizontal overflow",c);
  if(c.width>480){
    assert(attribute(dom,"grid-type")==="grid","not a genuine layout grid",c);
    assert(attribute(dom,"now-position")==="static","Now is floating or absolute-positioned",c);
    assert(num(dom,"civil-center-error")<=2,"civil timestamp lost radial axis",c);
    assert(num(dom,"zone-center-error")<=2,"timezone not centered under date",c);
    assert(attribute(dom,"zone-below")==="true","timezone competes with the date",c);
    if(c.edit){
      assert(attribute(dom,"editor-open")==="true","inline editor never opened",c);
      assert(attribute(dom,"now-hidden-for-edit")==="true","Now collides with open editor",c);
    }else{
      assert(attribute(dom,"now-visible")==="true","Now not visible",c);
      assert(num(dom,"now-height")>=34,"Now hitbox too small",c);
      assert(num(dom,"now-gap")>=1&&num(dom,"now-gap")<=27,"Now detached from its time group",c);
      assert(num(dom,"now-same-baseline")<=13,"Now not aligned to civil text",c);
    }
  }else{
    assert(attribute(dom,"mobile-now-visible")==="true","mobile Now missing",c);
    assert(num(dom,"mobile-now-height")>=40,"mobile Now hitbox below floor",c);
    assert(num(dom,"mobile-now-gap")>=2&&num(dom,"mobile-now-gap")<=16,
      "Now not attached to the mobile time input",c);
    assert(num(dom,"mobile-same-baseline")<=5,"time and Now are not aligned",c);
    assert(attribute(dom,"mobile-caption-above")==="true","Zodiac still crowds action row",c);
    assert(attribute(dom,"mobile-caption-within-dock")==="true","Zodiac clipped",c);
    assert(num(dom,"mobile-input-width")>=130,"exact-time input squeezed",c);
    assert(Math.abs(num(dom,"mobile-zodiac-font")-12)<=.25,"Zodiac type shrunk",c);
  }
  const label=`${c.width}x${c.height}${c.long?"-long":""}${c.edit?"-edit":""}${c.tools?"-tools":""}`;
  if(["320x844","390x844","481x844","1440x900","1440x900-edit"].includes(label)){
    const file=path.join(out,"now-f2-"+label+".png");
    const img=spawnSync(browser,[...flags,...viewport,"--screenshot="+file,url],{timeout:60000});
    assert(img.status===0&&statSync(file).size>10000,"screenshot missing or empty",c);
  }
  console.log(`[now-f2] PASS ${label}: ${c.width>480?
    "center="+num(dom,"civil-center-error").toFixed(2)+"/gap="+num(dom,"now-gap").toFixed(1):
    "input="+num(dom,"mobile-input-width").toFixed(0)+"/gap="+num(dom,"mobile-now-gap").toFixed(1)
  }`);
}
