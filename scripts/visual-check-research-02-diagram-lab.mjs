import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const directions=["zero","ring","decompose"];
const viewports=[{key:"1440x900",width:1440,height:900},{key:"390x844",width:390,height:844}];

function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw new Error("No system Chromium/Chrome executable found");
}
function args(){return["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1","--run-all-compositor-stages-before-draw","--virtual-time-budget=1800"]}
function run(browser,argv,label){
  let last;
  for(let attempt=1;attempt<=2;attempt+=1){
    const result=spawnSync(browser,argv,{encoding:"utf8",timeout:attempt===1?20000:45000,killSignal:"SIGKILL"});
    if(result.status===0)return result;
    last=result;
  }
  process.stderr.write(last?.stderr??"");
  throw new Error("Chromium failed for "+label);
}
await mkdir(outputDir,{recursive:true});
const browser=findBrowser(),captures=[];
for(const direction of directions){
  const anchor={zero:"zero-title",ring:"ring-title",decompose:"decompose-title"}[direction];
  const url=new URL("prototypes/research-02-diagram-lab.html?direction="+direction+"#"+anchor,baseURL).href;
  const dom=run(browser,[...args(),"--window-size=1440,900","--dump-dom",url],"Research 02 DOM "+direction).stdout;
  if(!dom.includes('data-diagram-lab-ready="true"')||!dom.includes('data-diagram-direction="'+direction+'"'))throw new Error("wrong Research 02 direction "+direction);
  for(const required of ["24,000","12 / 12","2026","26026"])if(!dom.includes(required))throw new Error("Research 02 lab missing "+required);
  for(const viewport of viewports){
    const name="research-02-diagram-"+direction+"-"+viewport.key+".png";
    const file=path.join(outputDir,name);
    run(browser,[...args(),"--window-size="+viewport.width+","+viewport.height,"--screenshot="+file,url],name);
    const info=await stat(file);
    if(info.size<10000)throw new Error(name+" unexpectedly small");
    captures.push({direction,viewport:viewport.key,file:name,bytes:info.size,url});
  }
}
await writeFile(path.join(outputDir,"research-02-diagram-lab-evidence.json"),JSON.stringify({browser,baseURL,captures},null,2)+"\n","utf8");