import {mkdir,stat,writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import path from "node:path";
const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const output=path.resolve("tmp/visual-check");
const browser=process.env.CHROMIUM_BIN??"chromium";
const common=["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars",
  "--force-device-scale-factor=1","--virtual-time-budget=9000"];
function run(flags,what){
 const r=spawnSync(browser,[...common,...flags],{encoding:"utf8",timeout:55000,maxBuffer:10*1024*1024});
 if(r.status!==0)throw new Error(what+" Chromium failed: "+r.stderr?.slice(-1400));
 return r.stdout;
}
function assert(yes,what){if(!yes)throw new Error(what)}
await mkdir(output,{recursive:true});
const rows=[
 {key:"desktop-proof",width:1440,height:1700,delta:1980,variant:"proof",phase:"-20,0,0"},
 {key:"mobile-proof",width:390,height:1700,delta:1980,variant:"proof",phase:"-20,0,0"},
 {key:"mobile-all-closed",width:390,height:1700,delta:24000,variant:"proof",phase:"0,0,0"},
 {key:"mobile-open-year-day",width:390,height:1700,delta:400,variant:"proof",phase:"0,-20,-3"},
 {key:"desktop-original",width:1440,height:1700,delta:1980,variant:"original",phase:"-20,0,0"}
];
const evidence=[];
for(const row of rows){
 const url=new URL("prototypes/research-r17-in-context.html?delta="+row.delta+"&variant="+row.variant,baseURL).href;
 const size="--window-size="+row.width+","+row.height;
 const dom=run([size,"--dump-dom",url],row.key+" DOM");
 for(const [attr,want] of Object.entries({
  "data-r17-context-ready":"true","data-r17-production-ready":"true",
  "data-r17-year-strip-present":"true","data-r17-delta-controls-present":"true",
  "data-r17-figure-present":"true","data-r17-year-head-clear":"true","data-r17-current-delta":String(row.delta),
  "data-r17-selected-variant":row.variant,"data-r17-phase-evidence":row.phase,
  "data-r17-claim-state":row.delta===24000?"all-closed":row.delta===1980?"year-day-closed":"gregorian-closed",
  "data-r17-claim-has-numeric-residual":"false"
 }))assert(dom.includes(attr+'="'+want+'"'),row.key+" missing "+attr+"="+want+"; "+dom.slice(-2200));
 assert(!dom.includes("production-structure-missing"),row.key+" failed to load production nodes");
 const fileName="research-r17-context-"+row.key+".png";
 const file=path.join(output,fileName);
 run([size,"--screenshot="+file,url],row.key+" screenshot");
 const bytes=(await stat(file)).size;
 assert(bytes>24000,row.key+" tiny screenshot: "+bytes);
 evidence.push({key:row.key,delta:row.delta,variant:row.variant,phase:row.phase,fileName,bytes,url});
}
await writeFile(path.join(output,"research-r17-context-evidence.json"),JSON.stringify({baseURL,evidence},null,2)+"\n");
console.log("[r17-context] PASS live production controls + figure: "+JSON.stringify(evidence));
