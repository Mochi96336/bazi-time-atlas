import {mkdir,stat} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import path from "node:path";
const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
function findBrowser(){
 if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
 for(const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
  const r=spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
  if(r.status===0&&r.stdout.trim())return r.stdout.trim();
 }
 throw Error("Chromium required for original R16 reading experiment");
}
const executable=findBrowser();
function run(args,label){
 let last;
 for(let attempt=0;attempt<2;attempt++){
  last=spawnSync(executable,args,{encoding:"utf8",timeout:attempt?60_000:40_000,maxBuffer:12*1024*1024});
  if(last.status===0)return last.stdout;
 }
 throw Error("Chromium "+label+" failed: "+(last?.stderr||"").slice(-1900));
}
function browserArgs(width){
 return [
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
  "--hide-scrollbars","--force-device-scale-factor=1",
  "--run-all-compositor-stages-before-draw","--virtual-time-budget=12000",
  "--window-size="+Math.max(500,width)+",1450"
 ];
}
const root="scripts/fixtures/r16-alignment-reading-proof.html";
await mkdir(outputDir,{recursive:true});
for(const width of [320,390,900]){
 for(const finish of [false,true]){
  const url=new URL(root+"?width="+width+(finish?"&finish=1":""),baseURL).href;
  const html=run([...browserArgs(width),"--dump-dom",url],width+"px "+(finish?"finished":"initial"));
  if(!html.includes('data-ready="true"')){
   throw Error("reading study not ready at "+width+"px, finish="+finish+
    " probe="+html.match(/<output id="probe"[^>]*>/)?.[0]);
  }
  if(!html.includes('data-source-r16="true"')||!html.includes('data-original-cells="160"')||
     !html.includes('data-answered-before-reveal="true"')){
   throw Error("not the original hidden-answer R16 fan at "+width+"px");
  }
  if(finish&&!html.includes('data-four-case-scoring="true"')){
   throw Error("model-scored four-question study did not finish at "+width+"px");
  }
  if(!finish){
   const out=path.join(outputDir,"r16-reading-study-"+width+"px.png");
   run([...browserArgs(width),"--screenshot="+out,url],width+"px screenshot");
   const bytes=(await stat(out)).size;
   if(bytes<20000)throw Error("empty reading-study screenshot "+width+"px: "+bytes);
   console.log("[alignment-reading] saved "+out+" ("+bytes+" bytes)");
  }
 }
 console.log("[alignment-reading] PASS original fan shown, answers hidden, all four cases scored at "+width+"px");
}
