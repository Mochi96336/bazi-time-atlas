import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const browser=process.env.CHROMIUM_BIN??"chromium";
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const dir=path.resolve("tmp/visual-check");
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars",
 "--force-device-scale-factor=1","--virtual-time-budget=6500","--run-all-compositor-stages-before-draw"];
function chromium(args,name){
 let last;
 for(let i=0;i<2;i++){
  const r=spawnSync(browser,[...flags,...args],{encoding:"utf8",timeout:i?70000:53000,maxBuffer:18*1024*1024});
  if(r.status===0)return r.stdout;
  last=r.stderr?.slice(-950);
 }
 throw Error(name+" Chromium failed: "+last);
}
function assert(ok,msg){if(!ok)throw Error("[r20-return] "+msg)}
await mkdir(dir,{recursive:true});
const scenes=[
 {name:"r20-return-desktop",width:1440,height:4400,date:"2026-09-13",delta:1980,local:1980},
 {name:"r20-return-mobile",width:390,height:5700,date:"2026-09-13",delta:1980,local:1980},
 {name:"r20-return-mobile-400",width:390,height:5700,date:"2026-09-13",delta:400,local:1980},
 {name:"r20-return-mobile-1900",width:390,height:5700,date:"1900-03-01",delta:6180,local:6180},
 {name:"r20-return-mobile-2100",width:390,height:5700,date:"2100-03-01",delta:16080,local:16080}
];
const images=[];
for(const s of scenes){
 const url=new URL("recurrence.html?date="+s.date+"&delta="+s.delta+"&r20=1",base);
 const size="--window-size="+s.width+","+s.height;
 const dom=chromium([size,"--dump-dom",url.href],s.name+" DOM");
 const h=dom.match(/<html[^>]*>/)?.[0]??"";
 const box=dom.match(/<div[^>]*id="r18-context"[^>]*>/)?.[0]??"";
 const svg=dom.match(/<svg[^>]*id="r18-context-overview"[^>]*>/)?.[0]??"";
 for(const token of [
  'data-research-visual="r18"','data-research-rhythm="r20"'
 ])assert(h.includes(token),s.name+" missing "+token);
 for(const token of [
  'data-r18-ready="true"','data-r18-first-local="'+s.local+'"',
  'data-r18-selected-delta="'+s.delta+'"','data-r18-model="recurrenceState"',
  'data-r18-diagram-variant="return-spans"'
 ])assert(box.includes(token),s.name+" missing "+token);
 for(const token of [
  'data-graph-grammar="verified-return-spans"','data-span-semantics="endpoints-only"',
  'data-rhythm-tracks="4"','data-cursor-placement="axis-only"',
  'data-r20-layout="'+(s.width===390?"full-width-mobile":"labeled-desktop")+'"',
  'data-axis-left="'+(s.width===390?"18":"175")+'"',
  'data-axis-right="'+(s.width===390?"322":"782")+'"'
 ])assert(svg.includes(token),s.name+" missing "+token);
 assert((dom.match(/data-r20-span-to="/g)||[]).length>12,s.name+" no repeated arches");
 assert((dom.match(/data-r20-span-role="origin-to-first"/g)||[]).length===4,
  s.name+" must distinguish four identity-to-first bridges");
 assert((dom.match(/data-r20-closure-year="24000"/g)||[]).length===4,s.name+" global closure misrepresented");
 assert((dom.match(/id="delta-slider"/g)||[]).length===1,s.name+" cloned native slider");
 assert((dom.match(/data-r19-delta="/g)||[]).length===6,s.name+" old precise controls missing");
 assert(dom.includes('data-r20-meaning="elapsed-spans-not-phase"'),s.name+" curve misinterpretation note missing");
 const filename=s.name+".png",full=path.join(dir,filename);
 chromium([size,"--screenshot="+full,url.href],s.name+" screenshot");
 const bytes=(await stat(full)).size;
 assert(bytes>(s.width===390?60000:100000),s.name+" screenshot blank");
 images.push({...s,filename,bytes});
}
// Browser-handler test, not just static DOM: Δ, base change and R16/R19 fallback.
for(const width of [390,1440]){
 const url=new URL("scripts/fixtures/research-r20-return-rhythm.html",base);
 const dump=chromium(["--window-size="+width+",1080","--virtual-time-budget=26000","--dump-dom",url.href],
  "interactive-"+width);
 const out=dump.match(/<output[^>]*id="r20-check"[^>]*>/)?.[0]??"";
 assert(out.includes('data-ready="true"'),"R20 controls failed at "+width+": "+out);
 assert(out.includes('data-r19-fallback="true"')&&out.includes('data-r16-fallback="true"'),
   "R20 leaked into legacy visual variants at "+width);
}
await writeFile(path.join(dir,"r20-return-rhythm-scenes.json"),JSON.stringify(images,null,2)+"\n");
console.log("[r20-return] PASS "+JSON.stringify(images));
