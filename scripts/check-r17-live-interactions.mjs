import {spawnSync} from "node:child_process";
const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const bin=process.env.CHROMIUM_BIN??"chromium";
const setups=[
 {name:"R17 desktop",mode:"r17",width:1440,height:1000},
 {name:"R17 mobile",mode:"r17",width:390,height:844},
 {name:"R16 rollback",mode:"r16",width:1440,height:1000}
];
function check(ok,message){if(!ok)throw new Error(message)}
for(const setup of setups){
 const url=new URL("scripts/fixtures/research-r17-live-interactions.html?mode="+setup.mode,baseURL).href;
 let text="",error="";
 for(let i=0;i<2;i++){
  const args=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
   "--hide-scrollbars","--force-device-scale-factor=1",
   "--run-all-compositor-stages-before-draw","--virtual-time-budget=18000",
   "--window-size="+setup.width+","+setup.height,"--dump-dom",url];
  const result=spawnSync(bin,args,{encoding:"utf8",timeout:i===0?55000:70000,
   maxBuffer:16*1024*1024});
  if(result.status===0){text=result.stdout;break}
  error=result.stderr?.slice(-1000)??"";
 }
 check(text,setup.name+" Chromium failed: "+error);
 const open=text.match(/<output[^>]*id="probe"[^>]*>/)?.[0]??"";
 check(open.includes('data-ready="true"'),setup.name+" not ready: "+open+
  " "+(text.match(/data-error="([^"]+)"/)?.[1]??"")+ " "+text.slice(-900));
 check(open.includes('data-mode="'+setup.mode+'"'),setup.name+" wrong mode");
 check(open.includes('data-playback-advanced="true"'),setup.name+" playback not proven");
 check(open.includes('data-navigation-restored="true"'),setup.name+" return not proven");
 const count=Number(open.match(/data-events="([0-9]+)"/)?.[1]);
 check(count>=10,setup.name+" too few transitions: "+count);
 console.log("[r17-interactions] PASS "+setup.name+" ("+count+" steps)");
}
