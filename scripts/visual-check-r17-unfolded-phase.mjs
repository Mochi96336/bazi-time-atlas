import { mkdir, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const browser=process.env.CHROMIUM_BIN??"chromium";
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1","--virtual-time-budget=3500"];
function run(args,label){
  const output=spawnSync(browser,[...flags,...args],{encoding:"utf8",timeout:55000,maxBuffer:8*1024*1024});
  if(output.status!==0)throw new Error(label+": "+(output.stderr??output.stdout));
  return output.stdout;
}
function assert(condition,message){if(!condition)throw new Error(message)}
function figureTag(dom){return dom.match(/<svg\b[^>]*id="unfolded"[^>]*>/)?.[0]??""}
await mkdir(outputDir,{recursive:true});
const captures=[];
for(const scene of [
  {name:"desktop-local",width:1440,height:1250,delta:1980,wanted:["-20","0","0"],layout:"desktop-native"},
  {name:"mobile-local",width:390,height:1900,delta:1980,wanted:["-20","0","0"],layout:"mobile-native"},
  {name:"mobile-global",width:390,height:1900,delta:24000,wanted:["0","0","0"],layout:"mobile-native"}
]){
  const url=new URL("prototypes/research-r17-unfolded-phase.html?delta="+scene.delta,baseURL).href;
  const windowFlag="--window-size="+scene.width+","+scene.height;
  const dom=run([windowFlag,"--dump-dom",url],scene.name+" DOM");
  const figure=figureTag(dom);
  assert(figure.includes('data-phase-source="recurrenceState"'),scene.name+" lacks canonical projection");
  assert(figure.includes('data-layout="'+scene.layout+'"'),scene.name+" wrong native viewport");
  for(const [attr,value] of [["gregorian-signed",scene.wanted[0]],["year-signed",scene.wanted[1]],["day-signed",scene.wanted[2]]])
    assert(figure.includes('data-'+attr+'="'+value+'"'),scene.name+" wrong "+attr+": "+figure);
  assert(dom.includes("三個週期的共同 0"),scene.name+" drawing did not complete");
  assert(!dom.includes("Uncaught SyntaxError"),scene.name+" syntax error");
  const filename="research-r17-"+scene.name+".png";
  const file=path.join(outputDir,filename);
  run([windowFlag,"--screenshot="+file,url],scene.name+" screenshot");
  const size=(await stat(file)).size;
  assert(size>15000,scene.name+" unexpectedly empty capture ("+size+" bytes)");
  captures.push({name:scene.name,delta:scene.delta,width:scene.width,height:scene.height,filename,bytes:size});
}
await writeFile(path.join(outputDir,"research-r17-visual-evidence.json"),JSON.stringify({baseURL,captures},null,2)+"\n","utf8");
console.log("[research-r17] PASS "+JSON.stringify(captures));
