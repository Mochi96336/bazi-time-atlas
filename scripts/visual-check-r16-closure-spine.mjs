import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
function findBrowser(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const candidate=spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
    if(candidate.status===0 && candidate.stdout.trim())return candidate.stdout.trim();
  }
  throw Error("Chromium required for R16 closure spine visual check");
}
const browser=findBrowser();
function run(args,label){
  let result;
  for(let attempt=0;attempt<2;attempt++){
    result=spawnSync(browser,args,{encoding:"utf8",timeout:attempt?60000:40000,maxBuffer:12*1024*1024});
    if(result.status===0)return result.stdout;
  }
  throw Error("Chromium "+label+" failed: "+(result?.stderr??"").slice(-1600));
}
function browserArgs(width){
  return [
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
    "--hide-scrollbars","--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw","--virtual-time-budget=13000",
    "--window-size="+Math.max(width,500)+",1400"
  ];
}
await mkdir(outputDir,{recursive:true});
for(const width of [320,390,900]){
  const url=new URL("scripts/fixtures/r16-closure-spine-proof.html?width="+width,baseURL).href;
  const html=run([...browserArgs(width),"--dump-dom",url],width+"px DOM");
  for(const evidence of [
    'data-ready="true"','data-original-geometry="true"','data-cells="160"',
    'data-broken8000="true"','data-complete24000="true"'
  ]) {
    if(!html.includes(evidence)){
      throw Error("R16 closure browser failure at "+width+": "+evidence+
        " probe="+(html.match(/<output id="probe"[^>]*>/)?.[0]??"missing"));
    }
  }
  const target=path.join(outputDir,"r16-closure-spine-8000-"+width+"px.png");
  run([...browserArgs(width),"--screenshot="+target,url],width+"px screenshot");
  const size=(await stat(target)).size;
  if(size<18000)throw Error("empty R16 closure screenshot at "+width+": "+size);
  console.log("[closure-spine] PASS "+width+"px, saved "+target+" ("+size+" bytes)");
}

for(const step of [1,3,60]){
  // 8,000/step 20 was captured above. Three more states provide a
  // four-panel *real-browser* comparison with identical 390px framing.
  const url=new URL("scripts/fixtures/r16-closure-spine-proof.html?width=390&targetStep="+step,baseURL).href;
  const html=run([...browserArgs(390),"--dump-dom",url],"390px step="+step+" DOM");
  if(!html.includes('data-ready="true"')||!html.includes('data-final-step="'+step+'"')){
    throw Error("R16 canonical state not ready: step="+step+" "+
      (html.match(/<output id="probe"[^>]*>/)?.[0]??"missing"));
  }
  const years=step*400;
  const out=path.join(outputDir,"r16-closure-spine-"+years+"-390px.png");
  run([...browserArgs(390),"--screenshot="+out,url],"390px step="+step+" screenshot");
  if((await stat(out)).size<18000)throw Error("empty canonical screenshot "+years);
  console.log("[closure-spine] PASS extra canonical state Δ+"+years);
}

{
  // The original R16 and the new geometry are compared from their actual
  // same-origin SVG DOMs; no hand-redrawn stand-in is accepted.
  const url=new URL("prototypes/research-r16-closure-side-by-side.html?step=20",baseURL).href;
  const args=browserArgs(1440).map(arg=>arg.startsWith("--virtual-time-budget=")?"--virtual-time-budget=25000":arg);
  const html=run([...args,"--dump-dom",url],"R16 original-vs-closure comparison");
  if(!html.includes('data-ready="true"')||!html.includes('data-comparison-step="20"')){
    throw Error("original-vs-closure comparison failed to synchronize both real SVGs: "+
      (html.match(/<body[^>]*>/)?.[0]??"body absent")+
      " status="+html.slice(html.indexOf('id="comparison-status"'),html.indexOf('id="comparison-status"')+180));
  }
  const screenshot=path.join(outputDir,"r16-original-vs-closure-8000-1440px.png");
  run([...args,"--screenshot="+screenshot,url],"R16 original-vs-closure screenshot");
  if((await stat(screenshot)).size<25000)throw Error("empty R16 comparison screenshot");
  console.log("[closure-spine] PASS original R16 vs closure geometry at Δ+8,000");
}
// Compare partial year closure and total closure on the exact same two SVGs.
// This makes the source-vs-experiment claim falsifiable on real screenshots.
for (const step of [3,60]) {
  const url=new URL("prototypes/research-r16-closure-side-by-side.html?step="+step,baseURL).href;
  const args=browserArgs(1440).map(arg=>arg.startsWith("--virtual-time-budget=")?"--virtual-time-budget=25000":arg);
  const html=run([...args,"--dump-dom",url],"R16 side-by-side step "+step);
  if(!html.includes('data-ready="true"')||!html.includes('data-comparison-step="'+step+'"')){
    throw Error("R16 original comparison failed at step="+step+" "+
      (html.match(/<body[^>]*>/)?.[0]??"body missing"));
  }
  const years=step*400;
  const image=path.join(outputDir,"r16-original-vs-closure-"+years+"-1440px.png");
  run([...args,"--screenshot="+image,url],"R16 comparison screenshot step "+step);
  if((await stat(image)).size<25000)throw Error("empty comparison screenshot "+years);
  console.log("[closure-spine] PASS original R16 vs closure geometry at Δ+"+years);
}

{
  // The product question is temporal, not merely whether four static frames
  // match. Playback starts at k=0 and drives both actual SVGs through 60
  // *model-timed* exact states, without browser-side phase interpolation.
  const url=new URL("prototypes/research-r16-closure-side-by-side.html?step=20&autoplay=1",baseURL).href;
  const args=browserArgs(1440).map(arg=>
    arg.startsWith("--virtual-time-budget=")?"--virtual-time-budget=38000":arg
  );
  const html=run([...args,"--dump-dom",url],"R16 full 60-step comparison");
  for(const expected of [
    'data-ready="true"',
    'data-comparison-sync="true"',
    'data-comparison-step="60"',
    'data-playback-state="complete"',
    'data-playback-frames="60"'
  ]){
    if(!html.includes(expected)){
      throw Error("R16 60-step synchronized playback failed "+expected+
        " body="+(html.match(/<body[^>]*>/)?.[0]??"missing")+
        " status="+html.slice(html.indexOf('id="comparison-status"'),html.indexOf('id="comparison-status"')+220));
    }
  }
  console.log("[closure-spine] PASS synchronized original / experiment playback k=0..60");
}
