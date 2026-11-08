import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const browser=process.env.CHROMIUM_BIN??["chromium","chromium-browser","google-chrome"].map(name=>{
  const res=spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
  return res.status===0?res.stdout.trim():null;
}).find(Boolean);
if(!browser)throw Error("Chromium is required for native R16 seam proof");
function args(width,height=1200){
  return ["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
    "--hide-scrollbars","--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw","--virtual-time-budget=20000",
    "--window-size="+Math.max(width,500)+","+height];
}
function chromium(params,label){
  let r;
  for(let attempt=0;attempt<2;attempt++){
    r=spawnSync(browser,params,{encoding:"utf8",timeout:50000,maxBuffer:12*1024*1024});
    if(r.status===0)return r.stdout;
  }
  throw Error("Chromium failed for "+label+": "+(r?.stderr??"").slice(-1600));
}
await mkdir(outputDir,{recursive:true});
for(const [delta,width,height] of [
  [399,1440,1050],[400,1440,1050],
  [1200,1440,1050],[8000,1440,1050],[24000,1440,1050],
  [399,390,1450],[8000,390,1450],[24000,390,1450]
]){
  const url=new URL("scripts/fixtures/r16-native-seam-proof.html?delta="+delta,baseURL).href;
  const html=chromium([...args(width,height),"--dump-dom",url],"Δ"+delta+" viewport "+width);
  for(const evidence of [
    'data-ready="true"','data-original-baseline="true"',
    'data-only-native-seam="true"','data-all-cases="true"',
    'data-delta="'+delta+'"'
  ]){
    if(!html.includes(evidence)){
      throw Error("R16 native seam proof failed Δ"+delta+" "+width+"px: "+evidence+
        " "+(html.match(/<output id="probe"[^>]*>/)?.[0]??"probe missing"));
    }
  }
  const name="r16-native-seam-"+delta+"-"+width+"px.png";
  const file=path.join(outputDir,name);
  chromium([...args(width,height),"--screenshot="+file,url],"screenshot "+name);
  if((await stat(file)).size<18000)throw Error("empty native R16 screenshot "+name);
  console.log("[native-seam] PASS Δ"+delta+" "+width+"px => "+name);
}
