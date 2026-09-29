import { mkdir,stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const out=path.resolve("tmp/research-live-visual");
const cases=[
 // R3 captures ONLY the original Research surface.
 {route:"original",date:"2024-02-10",width:390,height:2000,name:"research-original-390.png"},
 {route:"original-frame",width:320,height:2250,name:"research-original-320.png"},
 {route:"original-frame",width:768,height:2250,name:"research-original-768.png"},
 {route:"original",date:"2024-02-10",width:1440,height:2300,name:"research-original-1440.png"},
 {route:"original",date:"2026-09-13",delta:400,width:390,height:1700,name:"research-original-400y-390.png"},
 {route:"original",date:"2026-09-13",delta:400,width:1440,height:1700,name:"research-original-400y-1440.png"},
 {route:"original",date:"2024-02-04",width:390,height:2000,name:"research-original-lichun-day-390.png"},
 {route:"original",date:"2023-06-01",width:390,height:2000,name:"research-original-normal-2023-390.png"},
 {route:"original",date:"2023-01-03",width:390,height:2000,name:"research-original-cross-year-jiazi-390.png"},
 {route:"bare",width:390,height:2000,name:"research-original-default-390.png"}
];
function findBrowser(){
 if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
 for(const c of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
  const probe=spawnSync("sh",["-lc","command -v "+c],{encoding:"utf8"});
  if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
 }
 throw Error("Chromium missing");
}
await mkdir(out,{recursive:true});
const browser=findBrowser();
for(const item of cases){
 const u=new URL("recurrence.html",base);
 if(item.route==="original"){
   u.searchParams.set("date",item.date??"2024-02-10");
   u.searchParams.set("delta",String(item.delta??0));
 }
 const frame=new URL("scripts/fixtures/mobile-390.html",base);
 frame.searchParams.set("target","../../recurrence.html"+u.search);
 frame.searchParams.set("height",String(item.height));
 const responsive=new URL("scripts/fixtures/research-original-r0-390.html",base);
 responsive.searchParams.set("width",String(item.width));
 const url=item.route==="original-frame"?responsive:
   item.width===390?frame:u;
 const result=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu",
  "--hide-scrollbars","--run-all-compositor-stages-before-draw",
  "--force-device-scale-factor=1","--virtual-time-budget=4100",
  "--window-size="+(item.width<=390?500:item.width)+","+item.height,
  "--screenshot="+path.join(out,item.name),url.href],
  {encoding:"utf8",timeout:35000});
 if(result.status!==0)throw Error(item.name+" browser failed: "+result.stderr?.slice(-1000));
 const info=await stat(path.join(out,item.name));
 if(info.size<10000)throw Error(item.name+" screenshot empty");
 console.log("[research-live] "+item.name+" "+info.size+" bytes");
}
