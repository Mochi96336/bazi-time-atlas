import { mkdir,stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const output=path.resolve("tmp/research-journey");
const browser=process.env.CHROMIUM_BIN??(()=>{
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const p=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(p.status===0&&p.stdout.trim())return p.stdout.trim();
  }
  throw Error("No Chromium browser for native guided Year/Day proof");
})();
const cases=[
  {year:2024,state:"initial",name:"journey-unexpanded-2024-390.png"},
  {year:2024,state:"boundary",name:"journey-li-chun-2024-390.png"},
  {year:2024,state:"end",name:"journey-leap-2024-to-2025-390.png"},
  {year:2023,state:"end",name:"journey-normal-2023-to-2024-390.png"},
  {year:2024,state:"end",desktop:true,name:"journey-leap-2024-to-2025-1440.png"},
  {year:2024,state:"proof"},
  {year:2023,state:"proof"}
];
const flags=[
  "--headless=new","--no-sandbox","--disable-gpu","--hide-scrollbars",
  "--disable-dev-shm-usage","--run-all-compositor-stages-before-draw",
  "--force-device-scale-factor=1","--virtual-time-budget=11500"
];
await mkdir(output,{recursive:true});
for(const item of cases){
  const url=new URL("scripts/fixtures/research-civil-year-journey-390.html",base);
  url.searchParams.set("year",String(item.year));
  url.searchParams.set("state",item.state);
  if(item.desktop)url.searchParams.set("desktop","1");
  const size="--window-size="+(item.desktop?"1440,1350":"500,1650");
  const dump=spawnSync(browser,[...flags,size,"--dump-dom",url.href],
    {encoding:"utf8",timeout:45000,maxBuffer:15_000_000});
  const tag=dump.stdout?.match(/<output[^>]*id="probe"[^>]*>/)?.[0];
  if(dump.status!==0 || !tag?.includes('data-ready="true"')){
    throw Error("Guided Year/Day "+item.year+"/"+item.state+" failed: "+
      (tag??dump.stderr?.slice(-1300)));
  }
  if(item.state==="proof"){
    for(const key of ["first-screen","start","dirty-guard","end","restored","one-click-overview","manual-ownership"]){
      if(!tag.includes('data-'+key+'="true"'))throw Error("Missing guided proof "+key+": "+tag);
    }
    if(!tag.includes('data-turns="6"'))throw Error("Missing six actual turn checkpoints: "+tag);
    const remainder=item.year===2024?6:5;
    if(!tag.includes('data-remainder="'+remainder+'"'))throw Error("Wrong Day remainder: "+tag);
  }
  console.log("[year-journey] PASS "+item.year+" "+item.state+
    (item.desktop?" desktop":" 390px")+" "+(tag?.slice(0,250)??""));
  if(item.name){
    const dest=path.join(output,item.name);
    const shot=spawnSync(browser,[...flags,size,"--screenshot="+dest,url.href],
      {encoding:"utf8",timeout:45000});
    if(shot.status!==0)throw Error("Screenshot failed "+item.name+": "+shot.stderr?.slice(-1300));
    const st=await stat(dest);
    if(st.size<10000)throw Error(item.name+" screenshot unexpectedly small ("+st.size+" bytes)");
    console.log("[year-journey-png] "+item.name+" "+st.size+" bytes");
  }
}
