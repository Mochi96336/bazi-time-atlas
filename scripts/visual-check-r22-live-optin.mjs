import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const browser=process.env.CHROMIUM_BIN??"chromium";
const out=path.resolve("tmp/visual-check");
await mkdir(out,{recursive:true});
function run(args,label){
 const p=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu",
  "--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1",
  "--virtual-time-budget=8500","--run-all-compositor-stages-before-draw",...args],
  {encoding:"utf8",timeout:75000,maxBuffer:20*1024*1024});
 if(p.status!==0)throw Error("[r22-p2] "+label+" Chrome exit "+p.status+" "+p.stderr?.slice(-600));
 return p.stdout;
}
function assert(check,label){if(!check)throw Error("[r22-p2] "+label);}
const scenes=[
 {w:320,h:1330,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:0,signed:"0,0,0",status:"identity"},
 {w:390,h:1350,date:"2026-09-13",d:0,autoPlay:true,expectedDelta:400,signed:"0,-20,-3",status:"one"},
 {w:390,h:1350,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one"},
 {w:390,h:1350,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:1980,signed:"-20,0,0",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:8000,signed:"0,20,0",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:24000,signed:"0,0,0",status:"all"},
 {w:768,h:1220,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:1440,h:1100,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:1350,date:"1900-03-01",d:6180,signed:"180,0,0",status:"two"},
 {w:390,h:1350,date:"2100-03-01",d:16080,signed:"80,0,0",status:"two"}
];
const records=[];
for(const s of scenes){
 const url=new URL("scripts/fixtures/r22-live-optin.html",base);
 Object.entries({width:s.w,height:s.h,date:s.date,delta:s.d}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 if(s.autoPlay)url.searchParams.set("autoPlay","first");
 const win="--window-size="+Math.max(500,s.w)+","+s.h;
 const label="r22-p2-original-"+s.w+"-"+s.date+"-"+s.d+(s.autoPlay?"-reduced-step":"");
 const modeFlags=s.autoPlay?["--force-prefers-reduced-motion=reduce"]:[];
 const dom=run([win,...modeFlags,"--dump-dom",url.href],label+" DOM");
 const p=dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0]??"";
 for(const [k,v] of Object.entries({ready:"true",delta:s.expectedDelta??s.d,date:s.date,width:s.w,
   signed:s.signed,status:s.status,order:"true",fanCount:3,
   heroAboveFirstViewport:"true",sourceWheel:"true",singleDelta:"true",fourPillars:"true",
   pageOverflow:"false",autoPlayCaptured:"true",playbackPaused:"true"})){
  assert(p.includes('data-'+k.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())+'="'+v+'"'),
   label+" "+k+" expected "+v+"; probe="+p.slice(0,1400));
 }
 const img=path.join(out,label+".png");
 run([win,...modeFlags,"--screenshot="+img,url.href],label+" screenshot");
 const size=(await stat(img)).size;assert(size>30000,label+" blank image "+size);
 records.push({...s,bytes:size,filename:label+".png",heroTop:Number(p.match(/data-hero-top="(-?\d+)"/)?.[1])});
}
await writeFile(path.join(out,"r22-p2-evidence.json"),JSON.stringify({source:"actual recurrence.html original R16 SVG plus opt-in R22 narration",records},null,2)+"\n");
console.log("[r22-p2] PASS "+JSON.stringify(records));