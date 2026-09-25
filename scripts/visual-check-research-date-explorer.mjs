import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve("tmp/visual-check");
const captures = [
  { name:"research-date-explorer-1440x1250.png",width:1440,height:1250 },
  { name:"research-date-explorer-390x1900.png",width:390,height:1900 }
];
function findBrowser() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const p=spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
    if(p.status===0 && p.stdout.trim()) return p.stdout.trim();
  }
  throw new Error("No Chromium/Chrome executable available for explorer PNG proof");
}
await mkdir(outputDir,{recursive:true});
const binary=findBrowser();
for (const item of captures) {
  const destination=path.join(outputDir,item.name);
  const url=new URL("recurrence.html?mode=dates&base=2024-02-01&compare=2024-02-10",baseURL).href;
  const result=spawnSync(binary,[
    "--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",
    "--run-all-compositor-stages-before-draw","--force-device-scale-factor=1",
    "--virtual-time-budget=3800",
    "--window-size="+item.width+","+item.height,
    "--screenshot="+destination,url
  ],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  if(result.status!==0){
    process.stderr.write(result.stdout??"");
    process.stderr.write(result.stderr??"");
    throw new Error("Independent-date screenshot failed: "+item.name);
  }
  const stats=await stat(destination);
  if(stats.size<10000)throw new Error(item.name+" is unexpectedly empty: "+stats.size+" bytes");
  console.log("[explorer-png] "+item.name+": "+stats.size+" bytes");
}
