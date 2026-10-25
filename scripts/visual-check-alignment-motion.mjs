import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const chromium=process.env.CHROMIUM_BIN??"chromium";
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const dir=path.resolve("tmp/visual-check");
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--hide-scrollbars","--force-device-scale-factor=1",
 "--run-all-compositor-stages-before-draw","--virtual-time-budget=7000"];
function run(args,scene){
 const r=spawnSync(chromium,[...flags,...args],{encoding:"utf8",timeout:75000,maxBuffer:16*1024*1024});
 if(r.status!==0)throw Error("[alignment-motion] "+scene+" Chromium failed: "+r.stderr?.slice(-900));
 return r.stdout;
}
function check(v,msg){if(!v)throw Error("[alignment-motion] "+msg)}
await mkdir(dir,{recursive:true});
const cases=[
 {width:1440,height:1250,date:"2026-09-13",delta:1200,g:"0",y:"0",d:"-9"},
 {width:390,height:1800,date:"2026-09-13",delta:1200,g:"0",y:"0",d:"-9"},
 {width:390,height:1800,date:"2026-09-13",delta:1980,g:"-20",y:"0",d:"0"},
 {width:390,height:1800,date:"2026-09-13",delta:8000,g:"0",y:"20",d:"0"},
 {width:390,height:1800,date:"2026-09-13",delta:24000,g:"0",y:"0",d:"0"},
 {width:390,height:1800,date:"1900-03-01",delta:6180,g:"180",y:"0",d:"0"},
 {width:390,height:1800,date:"2100-03-01",delta:16080,g:"80",y:"0",d:"0"}
];
const output=[];
for(const s of cases){
 const url=new URL("prototypes/research-alignment-motion-proof.html",base);
 url.searchParams.set("date",s.date);url.searchParams.set("delta",String(s.delta));
 const name="alignment-motion-"+s.width+"-"+s.date+"-"+s.delta;
 const size="--window-size="+s.width+","+s.height;
 const dom=run([size,"--dump-dom",url.href],name);
 const html=dom.match(/<html[^>]*>/)?.[0]??"";
 check(html.includes('data-alignment-ready="true"'),name+" unavailable");
 check(html.includes('data-alignment-base="'+s.date+'"'),name+" wrong base");
 check(html.includes('data-alignment-delta="'+s.delta+'"'),name+" wrong delta");
 const gaps={gregorian:s.g,yearSequence:s.y,day:s.d};
 for(const [key,gap] of Object.entries(gaps)){
  const row=dom.match(new RegExp('<div class="phase-lane"[^>]*data-key="'+key+'"[^>]*>'))?.[0]??"";
  check(row.includes('data-signed-gap="'+gap+'"'),name+" "+key+" wrong signed gap");
  check(row.includes('data-closed="'+String(gap==="0")+'"'),name+" "+key+" wrong closed state");
 }
 check((dom.match(/id="delta-range"/g)||[]).length===1,name+" missing single time owner");
 check(dom.includes("LCM(400, 60) = 1,200"),name+" missing first multiple derivation");
 check(dom.includes("LCM(1,200, 8,000) = 24,000"),name+" missing final multiple derivation");
 const image=path.join(dir,name+".png");
 run([size,"--screenshot="+image,url.href],name+" PNG");
 const bytes=(await stat(image)).size;
 check(bytes>40000,name+" empty screenshot "+bytes);
 output.push({name,bytes});
}
await writeFile(path.join(dir,"alignment-motion-scenes.json"),JSON.stringify(output,null,2)+"\n");
console.log("[alignment-motion] PASS "+JSON.stringify(output));