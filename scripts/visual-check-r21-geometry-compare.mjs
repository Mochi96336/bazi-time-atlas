import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const chromiumBin=process.env.CHROMIUM_BIN??"chromium";
const origin=process.env.BASE_URL??"http://127.0.0.1:4173/";
const dir=path.resolve("tmp/visual-check");
const flags=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--hide-scrollbars","--force-device-scale-factor=1",
 "--virtual-time-budget=8500","--run-all-compositor-stages-before-draw"];
await mkdir(dir,{recursive:true});
function run(args,name){
 const ret=spawnSync(chromiumBin,[...flags,...args],{encoding:"utf8",timeout:70000,maxBuffer:20*1024*1024});
 if(ret.status!==0)throw Error("[r21] "+name+" chromium failed "+ret.stderr?.slice(-950));
 return ret.stdout;
}
function check(cond,msg){if(!cond)throw Error("[r21] "+msg)}
const cases=[
 {name:"r21-compare-390-2026",width:390,height:2900,date:"2026-09-13",local:1980,delta:1980},
 {name:"r21-compare-320-2026",width:320,height:3300,date:"2026-09-13",local:1980,delta:400},
 {name:"r21-compare-768-2026",width:768,height:3200,date:"2026-09-13",local:1980,delta:1980},
 {name:"r21-compare-1440-2026",width:1440,height:3000,date:"2026-09-13",local:1980,delta:1980},
 {name:"r21-compare-390-1900",width:390,height:2900,date:"1900-03-01",local:6180,delta:6180},
 {name:"r21-compare-390-2100",width:390,height:2900,date:"2100-03-01",local:16080,delta:16080}
];
const verified=[];
for(const c of cases){
 const url=new URL("prototypes/research-r21-geometry-compare.html",origin);
 url.searchParams.set("date",c.date);url.searchParams.set("delta",String(c.delta));
 const size="--window-size="+c.width+","+c.height;
 const dom=run([size,"--dump-dom",url.href],c.name+" dom");
 check(dom.includes('data-r21-ready="true"'),c.name+" not initialized");
 check(dom.includes('data-r21-first-local="'+c.local+'"'),c.name+" invalid base-specific first");
 for(const [id,grammar] of [["plot-r19","event-lanes"],["plot-r20","return-arches"],["plot-r21","discrete-interval-field"]]){
  const open=dom.match(new RegExp('<svg[^>]*id="'+id+'"[^>]*>'))?.[0]??"";
  check(open.includes('data-grammar="'+grammar+'"'),c.name+" missing "+grammar);
  check(open.includes('data-axis-start="0"')&&open.includes('data-axis-end="24000"'),
   c.name+" changed true Δ axis in "+grammar);
  check(open.includes('data-base-date="'+c.date+'"')&&open.includes('data-delta="'+c.delta+'"'),
   c.name+" mismatched date / Δ across panels");
 }
 const cPanel=dom.match(/<svg[^>]*id="plot-r21"[\s\S]*?<\/svg>/)?.[0]??"";
 const bPanel=dom.match(/<svg[^>]*id="plot-r20"[\s\S]*?<\/svg>/)?.[0]??"";
 check((cPanel.match(/data-r21-interval-role="origin-to-first"/g)||[]).length===4,
  c.name+" first spans falsely treated as return events");
 check((bPanel.match(/data-span-role="origin-to-first"/g)||[]).length===4,
  c.name+" R20 no longer authentic");
 check(cPanel.includes('data-r21-shared-closure="24000"'),
  c.name+" shared 24k closing spine missing");
 check(cPanel.includes('data-r21-interval-to="'+c.local+'"'),
  c.name+" Year+Day local endpoint unavailable");
 const out=path.join(dir,c.name+".png");
 run([size,"--screenshot="+out,url.href],c.name+" png");
 const bytes=(await stat(out)).size;
 check(bytes>60000,c.name+" blank PNG");
 verified.push({...c,bytes});
}
await writeFile(path.join(dir,"r21-compare-scenes.json"),JSON.stringify(verified,null,2)+"\n");
console.log("[r21-compare] PASS "+JSON.stringify(verified));
