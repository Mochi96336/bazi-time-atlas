import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile,readFile} from "node:fs/promises";
import path from "node:path";

const host=process.env.BASE_URL??"http://127.0.0.1:4173/";
const browser=process.env.CHROMIUM_BIN??"chromium";
const output=path.resolve("tmp/visual-check");
await mkdir(output,{recursive:true});
function run(args,name){
 const command=[ "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--disable-gpu","--hide-scrollbars","--force-device-scale-factor=1",
  "--run-all-compositor-stages-before-draw","--virtual-time-budget=8500",...args];
 const r=spawnSync(browser,command,{encoding:"utf8",timeout:70000,maxBuffer:16*1024*1024});
 if(r.status!==0)throw Error("[r22-p0] "+name+" chromium failed "+r.stderr?.slice(-1100));
 return r.stdout;
}
function check(ok,msg){if(!ok)throw Error("[r22-p0] "+msg);}
const scenes=[
 {width:320,height:1200,delta:1200,signed:"0,0,-9"},
 {width:390,height:1250,delta:0,signed:"0,0,0"},
 {width:390,height:1250,delta:400,signed:"0,-20,-3"},
 {width:390,height:1250,delta:1200,signed:"0,0,-9"},
 {width:390,height:1250,delta:1980,signed:"-20,0,0"},
 {width:390,height:1250,delta:8000,signed:"0,20,0"},
 {width:390,height:1250,delta:24000,signed:"0,0,0"},
 {width:768,height:1200,delta:1200,signed:"0,0,-9"},
 {width:1440,height:1200,delta:1200,signed:"0,0,-9"},
 {width:1440,height:1200,delta:24000,signed:"0,0,0"},
 // The exact +2937 year alignment provided in the user's current screenshot:
 // Gregorian +137 / Year -3 / Day -23.
 {width:320,height:1200,delta:2937,signed:"137,-3,-23"},
 {width:1440,height:1200,delta:2937,signed:"137,-3,-23"},
 // R16 P1 opt-in: same actual original SVG, not reconstructed art.
 // Capture 0/+400/+1200/+24000, mobile and desktop, next to original.
 {width:320,height:1200,delta:1200,signed:"0,0,-9",polish:true},
 {width:390,height:1250,delta:400,signed:"0,-20,-3",polish:true},
 {width:390,height:1250,delta:24000,signed:"0,0,0",polish:true},
 {width:1440,height:1200,delta:1200,signed:"0,0,-9",polish:true},
 {width:1440,height:1200,delta:24000,signed:"0,0,0",polish:true},
 {width:320,height:1200,delta:2937,signed:"137,-3,-23",polish:true},
 {width:1440,height:1200,delta:2937,signed:"137,-3,-23",polish:true}
];
const evidence=[];
const baselineImageBytes=new Map();
for(const s of scenes){
 const uri=new URL("scripts/fixtures/r22-native-fan-baseline.html",host);
 uri.searchParams.set("date","2026-09-13");
 uri.searchParams.set("delta",String(s.delta));
 uri.searchParams.set("width",String(s.width));
 uri.searchParams.set("height",String(s.height));
 if(s.polish)uri.searchParams.set("polish","1");
 const w=Math.max(s.width,500);
 const size="--window-size="+w+","+s.height;
 const name="r22-p0-original-fan-"+s.width+"-delta-"+s.delta+(s.polish?"-r16-polish":"");
 const dom=run([size,"--dump-dom",uri.href],name+" DOM");
 const probe=dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0]??"";
 check(probe.includes('data-ready="true"'),name+" not loaded: "+probe.slice(0,450));
 check(probe.includes('data-width="'+s.width+'"'),name+" not true viewport "+s.width);
 check(probe.includes('data-delta="'+s.delta+'"'),name+" wrong timeline Δ");
 check(probe.includes('data-moduli="400,60,60"'),name+" changed genuine cycle units");
 check(probe.includes('data-signed="'+s.signed+'"'),name+" unexpected signed phases "+probe.slice(0,500));
 check(probe.includes('data-layers="3"'),name+" not the existing three-layer fan");
 check(probe.includes('data-visual-mode="signed-shortest-fan"'),name+" wrong fan");
 check(probe.includes('data-fan-in-viewport="true"'),name+" test framed the page header, not the semicircle; "+
  probe.match(/data-fan-top="(-?\d+)"/)?.[0]);
 check(probe.includes('data-r16-polish="'+(s.polish?"true":"baseline")+'"'),name+" unexpected P1 opt-in state");
 check(probe.includes('data-phase-cells="160"'),name+" did not retain all 40+60+60 cells");
 check(probe.includes('data-clip-active-labels="false"'),name+" phase labels clipped outside SVG");
 if(s.polish&&s.delta!==24000){
  check(probe.includes('data-active-label-font="'+(s.width<=480?29:16)+'"'),name+" active phase text size not applied");
 }
 // P1 must keep the original line grid exactly: the washed-out version was
 // visually rejected after comparing the ACTUAL unfolded fan screenshots.
 check(probe.includes('data-sector-stroke-width="0.9px"'),name+" changed original sector divisions");
 check(probe.includes('data-minor-tick-width="1px"'),name+" changed original minor ticks");
 check(probe.includes('data-major-tick-width="1.35px"'),name+" changed original major ticks");
 const out=path.join(output,name+".png");
 run([size,"--screenshot="+out,uri.href],name+" screenshot");
 const bytes=(await stat(out)).size;
 check(bytes>25000,name+" blank screenshot ("+bytes+" bytes)");
 // The previous "green" visual suite captured only the untouched page header
 // for BOTH variants. Refuse acceptance unless every paired PNG really differs.
 const key=s.width+"/"+s.delta;
 const png=await readFile(out);
 if(s.polish){
  const before=baselineImageBytes.get(key);
  check(before&&(!png.equals(before)),name+" screenshot pixel bytes identical to default: fan NOT visible");
 }else{
  baselineImageBytes.set(key,png);
 }
 evidence.push({...s,bytes,file:name+".png"});
}
await writeFile(path.join(output,"r22-p0-evidence.json"),JSON.stringify({status:"captured-current-native-main",
 sampling:"real browser capture, existing recurrence-wheel, not prototype reconstruction",scenes:evidence},null,2)+"\n");
console.log("[r22-p0] PASS "+JSON.stringify(evidence));
