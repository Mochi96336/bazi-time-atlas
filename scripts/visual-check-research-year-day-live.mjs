import { mkdir,stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const out=path.resolve("tmp/research-live-visual");
const cases=[
 // R0: actual ORIGINAL Research, not an image of the legacy replacement tab.
 {route:"original",date:"2024-02-10",width:390,height:2000,name:"research-r1-original-390.png"},
 {route:"original-frame",width:320,height:2250,name:"research-r2-original-320.png"},
 {route:"original-frame",width:768,height:2250,name:"research-r2-original-768.png"},
 {route:"original",date:"2024-02-10",width:1440,height:2300,name:"research-r1-original-1440.png"},
 {route:"original",date:"2024-02-04",width:390,height:2000,name:"research-r1-lichun-day-390.png"},
 {route:"original",date:"2023-06-01",width:390,height:2000,name:"research-r1-normal-2023-390.png"},
 {route:"bare",width:390,height:2000,name:"research-r1-default-390.png"},
 // Retain captures of the older explicit-date permalink for compatibility.
 {date:"2024-02-01",width:390,height:1250,name:"research-live-before-390.png"},
 {date:"2024-02-04",width:390,height:1250,name:"research-live-boundary-390.png"},
 {date:"2024-02-10",width:390,height:1250,name:"research-live-after-390.png"},
 {date:"2024-02-10",width:1440,height:1100,name:"research-live-after-1440.png"}
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
   u.searchParams.set("delta","0");
 } else if(item.route!=="bare"){
   u.searchParams.set("mode","dates");
   u.searchParams.set("base","2024-02-01");
   u.searchParams.set("compare",item.date);
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
