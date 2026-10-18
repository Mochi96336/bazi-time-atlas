import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const captures=[
  {mode:"editorial",key:"1440x5600",width:1440,height:5600},
  {mode:"gallery",key:"1440x6500",width:1440,height:6500},
  {mode:"editorial",key:"390x7600",width:390,height:7600},
  {mode:"gallery",key:"390x8600",width:390,height:8600},
  {mode:"balanced",key:"1440x8600",width:1440,height:8600},
  {mode:"balanced",key:"390x10000",width:390,height:10000}
];
function browser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw new Error("No Chromium/Chrome executable found");
}
function args(){return["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1","--run-all-compositor-stages-before-draw","--virtual-time-budget=2500"]}
function run(bin,argv,label){
  const result=spawnSync(bin,argv,{encoding:"utf8",timeout:50000,killSignal:"SIGKILL"});
  if(result.status!==0){process.stderr.write(result.stderr??"");throw new Error("Chromium failed for "+label)}
  return result;
}
await mkdir(outputDir,{recursive:true});
const bin=browser(),evidence=[];
for(const capture of captures){
  const url=new URL("prototypes/research-full-page-rhythm-lab.html?mode="+capture.mode,baseURL).href;
  const dom=run(bin,[...args(),"--window-size="+capture.width+","+capture.height,"--dump-dom",url],"rhythm lab DOM").stdout;
  if(!dom.includes('data-rhythm-lab-ready="true"'))throw new Error("rhythm lab did not initialize");
  if(!dom.includes('data-mode="'+capture.mode+'"'))throw new Error("rhythm lab mode mismatch");
  const coreCount=(dom.match(/data-core-figure=/g)??[]).length;
  if(coreCount!==9)throw new Error("expected 9 unfolded core figures, got "+coreCount);
  const name="research-full-page-rhythm-"+capture.mode+"-"+capture.key+".png";
  const file=path.join(outputDir,name);
  run(bin,[...args(),"--window-size="+capture.width+","+capture.height,"--screenshot="+file,url],name);
  const info=await stat(file);
  if(info.size<40000)throw new Error(name+" unexpectedly small");
  evidence.push({...capture,file:name,bytes:info.size,url});
}
await writeFile(path.join(outputDir,"research-full-page-rhythm-evidence.json"),JSON.stringify({browser:bin,evidence},null,2)+"\n","utf8");
