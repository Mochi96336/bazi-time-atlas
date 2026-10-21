import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const output=path.resolve("tmp/visual-check");
const browser=process.env.CHROMIUM_BIN??"chromium";
const args=["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars",
  "--force-device-scale-factor=1","--run-all-compositor-stages-before-draw","--virtual-time-budget=6500"];
const check=(ok,msg)=>{if(!ok)throw new Error(msg)};
function run(flags,key){
 let error="";
 for(let i=0;i<2;i++){
  const result=spawnSync(browser,[...args,...flags],{encoding:"utf8",
   timeout:i===0?50000:65000,maxBuffer:12*1024*1024});
  if(result.status===0)return result.stdout;
  error=result.stderr?.slice(-1200)??"no stderr";
 }
 throw new Error(key+" browser failed: "+error);
}
await mkdir(output,{recursive:true});
const cases=[
 {key:"r17-desktop-local",width:1440,height:3300,delta:1980,visual:"r17",phase:["-20","0","0"],evidence:"year-day-closed"},
 {key:"r17-mobile-local",width:390,height:4750,delta:1980,visual:"r17",phase:["-20","0","0"],evidence:"year-day-closed"},
 {key:"r17-mobile-gregorian",width:390,height:4750,delta:400,visual:"r17",phase:["0","-20","-3"],evidence:"gregorian-closed"},
 {key:"r17-mobile-global",width:390,height:4750,delta:24000,visual:"r17",phase:["0","0","0"],evidence:"all-closed"},
 {key:"r16-default",width:1440,height:3300,delta:1980,visual:"r16",phase:["-20","0","0"]}
];
const captures=[];
for(const scene of cases){
 const r17=scene.visual==="r17"?"&r17=1":"";
 const url=new URL("recurrence.html?date=2026-09-13&delta="+scene.delta+r17,baseURL).href;
 const size="--window-size="+scene.width+","+scene.height;
 const dom=run([size,"--dump-dom",url],scene.key+" DOM");
 check(dom.includes('data-research-visual="'+scene.visual+'"'),scene.key+" wrong visual mode");
 check(dom.includes('id="recurrence-wheel"'),scene.key+" original SVG missing");
 check(dom.includes('id="delta-slider"'),scene.key+" original Δ controls missing");
 check(dom.includes('id="research-year-strip"'),scene.key+" authentic year strip missing");
 if(scene.visual==="r17"){
  const svg=dom.match(/<svg[^>]*id="r17-production-proof"[^>]*>/)?.[0]??"";
  const instrument=dom.match(/<section[^>]*id="recurrence-instrument"[^>]*>/)?.[0]??"";
  check(svg.includes('data-proof-ready="true"'),scene.key+" proof not drawn");
  check(svg.includes('data-evidence-state="'+scene.evidence+'"'),scene.key+" false closure state");
  check(svg.includes('data-gregorian-signed="'+scene.phase[0]+'"'),scene.key+" Gregorian offset wrong");
  check(svg.includes('data-year-signed="'+scene.phase[1]+'"'),scene.key+" Year offset wrong");
  check(svg.includes('data-day-signed="'+scene.phase[2]+'"'),scene.key+" Day offset wrong");
  check(instrument.includes('data-r17-proof-source="recurrenceState"'),scene.key+" copied state source");
  check(instrument.includes('data-delta-years="'+scene.delta+'"'),scene.key+" delta not owned by production");
  check(dom.includes("離散 → 節界")||dom.includes('data-research-visual="r17"'),scene.key+" bridge missing");
 } else {
  check(!dom.includes('data-proof-ready="true"'),scene.key+" R16 unexpectedly draws R17");
  check(dom.includes('data-phase-geometry="signed-shortest-fan"'),scene.key+" R16 proof geometry changed");
 }
 const file="research-production-"+scene.key+".png",filepath=path.join(output,file);
 run([size,"--screenshot="+filepath,url],scene.key+" image");
 const bytes=(await stat(filepath)).size;
 check(bytes>(scene.width===390?65000:85000),scene.key+" screenshot too small "+bytes);
 captures.push({key:scene.key,file,bytes,delta:scene.delta,visual:scene.visual,url});
}
await writeFile(path.join(output,"research-r17-production-optin.json"),JSON.stringify(captures,null,2)+"\n");
console.log("[r17-production] PASS "+JSON.stringify(captures));
