import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const viewports=[{key:"1440x900",width:1440,height:900},{key:"390x844",width:390,height:844}];

function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw new Error("No Chromium/Chrome executable found");
}
function browserArgs(){return[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars",
  "--force-device-scale-factor=1","--run-all-compositor-stages-before-draw","--virtual-time-budget=4500"
]}
function run(browser,argv,label){
  let last;
  for(let attempt=1;attempt<=2;attempt+=1){
    const result=spawnSync(browser,argv,{encoding:"utf8",timeout:attempt===1?30000:50000,killSignal:"SIGKILL"});
    if(result.status===0)return result;
    last=result;
  }
  process.stderr.write(last?.stderr??"");
  throw new Error("Chromium failed for "+label);
}

await mkdir(outputDir,{recursive:true});
const browser=findBrowser();
const captures=[];
for(const viewport of viewports){
  const harness="scripts/fixtures/research-02-production-visual.html?width="+viewport.width+"&height="+viewport.height;
  const url=new URL(harness,baseURL).href;
  const dom=run(browser,[...browserArgs(),"--window-size="+viewport.width+","+viewport.height,"--dump-dom",url],"Research 02 DOM").stdout;
  for(const required of [
    'data-ready="true"',
    'data-grammar="zero-line-proof"',
    'data-proof-ready="true"'
  ]) if(!dom.includes(required))throw new Error("Research 02 production harness missing "+required);

  const fileName="research-02-production-"+viewport.key+".png";
  const filePath=path.join(outputDir,fileName);
  run(browser,[...browserArgs(),"--window-size="+viewport.width+","+viewport.height,"--screenshot="+filePath,url],fileName);
  const info=await stat(filePath);
  if(info.size<25000)throw new Error(fileName+" unexpectedly small");
  captures.push({viewport:viewport.key,file:fileName,bytes:info.size,url});
}
await writeFile(path.join(outputDir,"research-02-production-evidence.json"),JSON.stringify({browser,baseURL,captures},null,2)+"\n","utf8");
