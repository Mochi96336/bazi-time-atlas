import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const browser=process.env.CHROMIUM_BIN??"chromium";
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const dest=path.resolve("tmp/visual-check");
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars",
 "--force-device-scale-factor=1","--virtual-time-budget=7000","--run-all-compositor-stages-before-draw"];
function run(args,key){
 let last;
 for(let i=0;i<2;i++){
  const result=spawnSync(browser,[...flags,...args],{encoding:"utf8",timeout:i?70000:53000,maxBuffer:20*1024*1024});
  if(result.status===0)return result.stdout;
  last=result.stderr?.slice(-1200);
 }
 throw Error(key+" browser failed "+last);
}
function check(ok,message){if(!ok)throw Error("R18 real page: "+message)}
await mkdir(dest,{recursive:true});
const scenes=[
 {key:"r18-context-desktop-local",width:1440,height:4400,date:"2026-09-13",delta:1980,local:1980,start:0},
 {key:"r18-context-mobile-local",width:390,height:5700,date:"2026-09-13",delta:1980,local:1980,start:0},
 {key:"r18-context-mobile-selected400",width:390,height:5700,date:"2026-09-13",delta:400,local:1980,start:0},
 {key:"r18-context-mobile-1900",width:390,height:5700,date:"1900-03-01",delta:6180,local:6180,start:4620},
 {key:"r18-context-mobile-2100",width:390,height:5700,date:"2100-03-01",delta:16080,local:16080,start:14520}
];
const artifacts=[];
for(const scene of scenes){
 const url=new URL("recurrence.html?date="+scene.date+"&delta="+scene.delta+"&r18=1",base).href;
 const size="--window-size="+scene.width+","+scene.height;
 const dom=run([size,"--dump-dom",url],scene.key+" DOM");
 const shell=dom.match(/<div[^>]*id="r18-context"[^>]*>/)?.[0]??"";
 const inst=dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0]??"";
 const overview=dom.match(/<svg[^>]*id="r18-context-overview"[^>]*>/)?.[0]??"";
 const local=dom.match(/<svg[^>]*id="r18-context-local"[^>]*>/)?.[0]??"";
 for(const [part,tag] of [
  [shell,'data-r18-ready="true"'],[shell,'data-r18-first-local="'+scene.local+'"'],
  [shell,'data-r18-detail-start="'+scene.start+'"'],[shell,'data-r18-selected-delta="'+scene.delta+'"'],
  [shell,'data-r18-model="recurrenceState"'],[shell,'data-r18-overview-paints="1"'],
  [inst,'data-r18-proof-source="recurrenceState"'],
  [overview,'data-axis-unit="elapsed-years"'],[local,'data-axis-unit="elapsed-years"']
 ])check(part.includes(tag),scene.key+" missing "+tag);
 check(dom.includes('data-research-visual="r18"'),scene.key+" wrong visual mode");
 check(dom.includes('id="research-year-strip"')&&dom.includes('id="delta-slider"'),
  scene.key+" original controls lost");
 check(dom.includes('id="recurrence-wheel"')&&dom.includes('id="r17-production-proof"'),
  scene.key+" old rollback graphics missing");
 const filename=scene.key+".png",filepath=path.join(dest,filename);
 run([size,"--screenshot="+filepath,url],scene.key+" screenshot");
 const bytes=(await stat(filepath)).size;
 check(bytes>(scene.width<500?60000:100000),scene.key+" blank or tiny PNG "+bytes);
 artifacts.push({...scene,filename,bytes});
}
// Browser-executed controls must preserve one expensive event scan per date.
for(const width of [390,1440]){
 const url=new URL("scripts/fixtures/research-r18-production-interactions.html",base).href;
 const dom=run(["--window-size="+width+",1050","--virtual-time-budget=25000","--dump-dom",url],
   "interaction-"+width);
 const probe=dom.match(/<output[^>]*id="status"[^>]*>/)?.[0]??"";
 check(probe.includes('data-ready="true"'),"interaction "+width+" "+probe.slice(0,500));
 check(probe.includes('data-cached="true"'),"24k work re-scanned on Δ");
 check(probe.includes('data-r16-fallback="true"')&&probe.includes('data-r17-fallback="true"'),
  "legacy modes regressed");
}
await writeFile(path.join(dest,"research-r18-context-scenes.json"),JSON.stringify(artifacts,null,2)+"\n");
console.log("[r18-in-context] PASS "+JSON.stringify(artifacts));
