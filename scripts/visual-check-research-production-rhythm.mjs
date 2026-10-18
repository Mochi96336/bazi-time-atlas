import { mkdir,stat,writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const viewports=[{key:"1440x9000",width:1440,height:9000},{key:"390x11500",width:390,height:11500}];
function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw new Error("No Chromium/Chrome executable found");
}
function args(){return["--headless=new","--no-sandbox","--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1","--run-all-compositor-stages-before-draw","--virtual-time-budget=5500"]}
function run(browser,argv,label){
  let last;
  for(let attempt=1;attempt<=2;attempt+=1){
    const result=spawnSync(browser,argv,{encoding:"utf8",timeout:attempt===1?50000:70000,killSignal:"SIGKILL"});
    if(result.status===0)return result;
    last=result;
  }
  process.stderr.write(last?.stderr??"");
  throw new Error("Chromium failed for "+label);
}
await mkdir(outputDir,{recursive:true});
const browser=findBrowser(),captures=[];
for(const viewport of viewports){
  const url=new URL("recurrence.html?delta=24000",baseURL).href;
  const dom=run(browser,[...args(),"--window-size="+viewport.width+","+viewport.height,"--dump-dom",url],"Research production rhythm DOM").stdout;
  for(const required of ['data-research-mainline="phase-fan"','id="seasonal-drift-residual-strip-svg"','data-ready="true"','class="astronomy-to-evidence"','data-diagram-grammar="pillar-verdict"','data-diagram-grammar="alignment-fork"'])
    if(!dom.includes(required))throw new Error("Research production rhythm missing "+required);
  if(dom.includes('id="discrete-phase-fan-details"'))throw new Error("phase fan disclosure returned");
  const order=[
    dom.indexOf('id="four-pillar-determinacy"'),
    dom.indexOf('id="absolute-boundary-consequence"'),
    dom.indexOf('id="proof-chain-support-details"'),
    dom.indexOf('id="epoch-audit-support-details"')
  ];
  if(order.some(index=>index<0)||!order.every((value,index)=>index===0||order[index-1]<value))
    throw new Error("Research 03 core/support order regressed: "+order.join(" → "));
  if(!dom.includes("0 = 全年平均"))throw new Error("residual baseline lost its relative-zero label");
  const fileName="research-production-rhythm-"+viewport.key+".png";
  const filePath=path.join(outputDir,fileName);
  run(browser,[...args(),"--window-size="+viewport.width+","+viewport.height,"--screenshot="+filePath,url],fileName);
  const info=await stat(filePath);
  if(info.size<(viewport.width>1000?100000:60000))throw new Error(fileName+" unexpectedly small");
  captures.push({viewport:viewport.key,file:fileName,bytes:info.size,url});
}
await writeFile(path.join(outputDir,"research-production-rhythm-evidence.json"),JSON.stringify({browser,baseURL,captures},null,2)+"\n","utf8");
