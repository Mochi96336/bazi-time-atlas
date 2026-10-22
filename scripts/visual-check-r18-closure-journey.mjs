import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const folder=path.resolve("tmp/visual-check");
const browser=process.env.CHROMIUM_BIN??"chromium";
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--hide-scrollbars","--force-device-scale-factor=1",
 "--run-all-compositor-stages-before-draw","--virtual-time-budget=6500"];
function run(args,name){
 let result;
 for(let attempt=0;attempt<2;attempt++){
  result=spawnSync(browser,[...flags,...args],{encoding:"utf8",timeout:attempt?65000:50000,maxBuffer:16*1024*1024});
  if(result.status===0)return result.stdout;
 }
 throw Error("R18 browser "+name+" failed "+result.stderr?.slice(-1000));
}
function check(ok,msg){if(!ok)throw Error("R18 "+msg);}
await mkdir(folder,{recursive:true});
const scenes=[
 {key:"r18-A-desktop",variant:"lanes",delta:1980,width:1440,height:1560,kind:"local"},
 {key:"r18-A-mobile",variant:"lanes",delta:1980,width:390,height:1830,kind:"local"},
 {key:"r18-A-mobile-global",variant:"lanes",delta:24000,width:390,height:1830,kind:"all"},
 {key:"r18-B-desktop",variant:"gates",delta:1980,width:1440,height:1560,kind:"local"},
 {key:"r18-B-mobile",variant:"gates",delta:400,width:390,height:1830,kind:"gregorian"},
 {key:"r18-A-identity",variant:"lanes",delta:0,width:390,height:1830,kind:"identity"}
];
const captures=[];
for(const scene of scenes){
 const url=new URL("prototypes/research-r18-closure-journey.html?variant="+scene.variant+"&delta="+scene.delta,baseURL).href;
 const size="--window-size="+scene.width+","+scene.height;
 const dom=run([size,"--dump-dom",url],scene.key+" DOM");
 for(const tag of [
  'data-r18-ready="true"','data-r18-variant="'+scene.variant+'"',
  'data-r18-selected-delta="'+scene.delta+'"','data-r18-selected-kind="'+scene.kind+'"',
  'data-r18-first-local="1980"','data-r18-first-global="24000"',
  'data-r18-range="24000"','data-r18-range="2400"',
  'data-r18-evidence="recurrenceState"'
 ])check(dom.includes(tag),scene.key+" missing "+tag);
 check(!dom.includes('data-r18-selected-kind="all"')||scene.delta===24000,
   scene.key+" identity mistaken for recurrence");
 const outName=scene.key+".png",out=path.join(folder,outName);
 run([size,"--screenshot="+out,url],scene.key+" PNG");
 const bytes=(await stat(out)).size;
 check(bytes>(scene.width>1000?78000:40000),scene.key+" PNG too small "+bytes);
 captures.push({name:outName,width:scene.width,height:scene.height,variant:scene.variant,delta:scene.delta,bytes});
}
await writeFile(path.join(folder,"r18-capture-manifest.json"),JSON.stringify(captures,null,2)+"\n");
console.log("[r18-diagram] PASS "+JSON.stringify(captures));
