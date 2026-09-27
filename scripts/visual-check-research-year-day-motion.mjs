import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const out=path.resolve("tmp/visual-check");
const find=()=>{
 if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
 for(const bin of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
  const probe=spawnSync("sh",["-lc","command -v "+bin],{encoding:"utf8"});
  if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
 }
 throw Error("Chromium unavailable for motion prototype proof");
};
const specs=[
 {year:2024,action:"before",name:"motion-2024-before-390.png"},
 {year:2024,action:"boundary",name:"motion-2024-boundary-390.png"},
 {year:2024,action:"after",name:"motion-2024-after-390.png"},
 {year:2024,action:"far",name:"motion-2024-far-390.png"},
 {year:2023,action:"step",name:"motion-2023-to-2024-390.png"},
 {year:2024,action:"step",name:"motion-2024-to-2025-390.png"},
 {year:2024,action:"interaction",name:"motion-2024-interaction-390.png"},
 {desktop:true,name:"motion-2024-default-1440.png"}
];
const browser=find();
await mkdir(out,{recursive:true});
for(const spec of specs){
 const url=new URL(spec.desktop?"docs/prototypes/research01-coupled-year-day-motion.html":"scripts/fixtures/research-year-day-motion-390.html",base);
 if(!spec.desktop){url.searchParams.set("year",String(spec.year));url.searchParams.set("action",spec.action);}
 const destination=path.join(out,spec.name);
 const result=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",
 "--run-all-compositor-stages-before-draw","--force-device-scale-factor=1","--virtual-time-budget=6500",
 "--window-size="+(spec.desktop?"1440,1000":"500,1650"),"--screenshot="+destination,url.href],{encoding:"utf8",timeout:35000});
 if(result.status!==0)throw Error(spec.name+" Chromium failed: "+result.stderr?.slice(-1200));
 const data=await stat(destination);
 if(data.size<10000)throw Error("Suspiciously small screenshot: "+spec.name);
 if(spec.desktop){console.log("[motion-png] "+spec.name+" "+data.size+" bytes; desktop screenshot");continue;}
 const dom=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu",
 "--virtual-time-budget=6500","--window-size=500,1650","--dump-dom",url.href],{encoding:"utf8",timeout:35000,maxBuffer:10_000_000});
 const m=dom.stdout.match(/<output[^>]*id="probe"[^>]*>/);
 if(dom.status!==0||!m||!m[0].includes('data-ready="true"'))throw Error("Motion prototype fixture failed "+spec.name+" "+(m?.[0]??dom.stderr?.slice(-300)));
 if(spec.action==="interaction"&&!m[0].includes('data-interaction="true"'))throw Error("Motion interaction checks missing");
 console.log("[motion-png] "+spec.name+" "+data.size+" bytes; "+m[0].slice(0,350));
}
