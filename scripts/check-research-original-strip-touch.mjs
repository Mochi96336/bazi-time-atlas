// Real Chromium touch and keyboard interactions on the ORIGINAL Research
// Year strip. Unlike synthetic 'input' tests, this sends native CDP events.
import assert from "node:assert/strict";
import { spawn,spawnSync } from "node:child_process";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const findBrowser=()=>{
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const candidate of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const probe=spawnSync("sh",["-lc","command -v "+candidate],{encoding:"utf8"});
    if(probe.status===0&&probe.stdout.trim())return probe.stdout.trim();
  }
  throw Error("Chromium unavailable");
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=9242;
const root=new URL("scripts/fixtures/mobile-390.html",base);
root.searchParams.set("target","../../recurrence.html?date=2024-02-10&delta=0");
root.searchParams.set("height","2100");
const dir=await mkdtemp(path.join(tmpdir(),"original-year-touch-"));
const browser=spawn(findBrowser(),[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--hide-scrollbars","--no-first-run","--no-default-browser-check",
  "--remote-allow-origins=*","--remote-debugging-port="+port,
  "--user-data-dir="+dir,"--window-size=500,2300",root.href
],{stdio:["ignore","ignore","pipe"]});
let stderr="";
browser.stderr.on("data",data=>{
  stderr+=String(data);
  if(stderr.length>6000)stderr=stderr.slice(-6000);
});
let ws;
try{
  let tab;
  for(let n=0;n<100;n++){
    if(browser.exitCode!==null)throw Error("browser exited before CDP: "+stderr);
    try{
      const response=await fetch("http://127.0.0.1:"+port+"/json/list",{signal:AbortSignal.timeout(400)});
      if(response.ok){
        const tabs=await response.json();
        tab=tabs.find(t=>t.type==="page"&&t.url.includes("mobile-390.html"));
        if(tab?.webSocketDebuggerUrl)break;
      }
    }catch{}
    await sleep(140);
  }
  if(!tab?.webSocketDebuggerUrl)throw Error("CDP never became ready: "+stderr);
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("CDP socket timeout")),8000);
    ws.addEventListener("open",()=>{clearTimeout(timer);resolve()},{once:true});
    ws.addEventListener("error",()=>{clearTimeout(timer);reject(Error("CDP socket error"))},{once:true});
  });
  let id=0;
  const pending=new Map();
  ws.addEventListener("message",e=>{
    const message=JSON.parse(e.data);
    if(!pending.has(message.id))return;
    const p=pending.get(message.id);pending.delete(message.id);
    if(message.error)p.reject(Error("CDP: "+message.error.message));
    else p.resolve(message.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id;
    const timer=setTimeout(()=>{
      pending.delete(key);reject(Error("CDP timed out: "+method));
    },10000);
    pending.set(key,{resolve:r=>{clearTimeout(timer);resolve(r)},
      reject:e=>{clearTimeout(timer);reject(e)}});
    ws.send(JSON.stringify({id:key,method,params}));
  });
  await send("Runtime.enable");
  await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  const inspect=async()=>{
    const expression=`(()=>{
      const f=document.getElementById("stage"),d=f?.contentDocument;
      const instrument=d?.getElementById("recurrence-instrument");
      const strip=d?.getElementById("research-year-strip");
      const slider=d?.getElementById("research-year-scrub");
      if(!slider||strip?.dataset.ready!=="true")return {ready:false};
      const fr=f.getBoundingClientRect(),sr=slider.getBoundingClientRect();
      return {ready:true,viewport:d.documentElement.clientWidth,
        base:instrument.dataset.baseDate,target:instrument.dataset.targetDate,
        delta:instrument.dataset.deltaYears,day:strip.dataset.selectedDayPillar,
        year:strip.dataset.selectedYearPillar,
        status:instrument.dataset.stripSelectionOutcome??"",
        slider:Number(slider.value),min:Number(slider.min),max:Number(slider.max),
        role:slider.getAttribute("aria-valuetext"),
        url:f.contentWindow.location.search,
        rect:{x:fr.left+sr.left,y:fr.top+sr.top,w:sr.width,h:sr.height}
      };
    })()`;
    const result=await send("Runtime.evaluate",{expression,returnByValue:true});
    if(result.exceptionDetails)throw Error("CDP evaluate: "+result.exceptionDetails.text);
    return result.result.value;
  };
  let original;
  for(let n=0;n<180;n++){
    const p=await inspect();
    if(p.ready&&p.target==="2024-02-10"&&p.day&&p.slider===40){
      original=p;break;
    }
    await sleep(60);
  }
  assert.ok(original,"original Year strip did not initialize");
  assert.equal(original.viewport,390,"must target a real 390px iframe");
  assert.ok(original.rect.h>=40 && original.rect.w>260,
    "original bar has no reliable native touch hit area: "+JSON.stringify(original));
  const pos=n=>({
    x:Math.round(original.rect.x+10+(original.rect.w-20)*(n-original.min)/(original.max-original.min)),
    y:Math.round(original.rect.y+original.rect.h/2),id:1
  });
  const touch=(type,points)=>send("Input.dispatchTouchEvent",{type,touchPoints:points});
  const start=pos(original.slider),end=pos(original.slider+75);
  await touch("touchStart",[start]);
  for(let n=1;n<=7;n++){
    await touch("touchMove",[{
      x:start.x+(end.x-start.x)*n/7,y:start.y,id:1
    }]);
    await sleep(22);
  }
  await touch("touchEnd",[]);
  let moved,last;
  for(let n=0;n<35;n++){
    const v=await inspect();
    last=v;
    if(v.target!=="2024-02-10"&&v.status==="applied"){moved=v;break;}
    await sleep(70);
  }
  assert.ok(moved,"real touch did not commit the original date owner: "+
    JSON.stringify({original,last,start,end}));
  assert.equal(moved.delta,"0","native gesture reset the original delta");
  assert.equal(moved.base,moved.target,
    "native gesture created a second independent target owner");
  assert.ok(moved.url.includes("date="+moved.target)&&moved.url.includes("delta=0"),
    "native gesture did not synchronize original permalink");
  assert.notEqual(moved.day,original.day,
    "canonical Day pillar did not follow the original year strip");
  await send("Runtime.evaluate",{expression:
    'document.getElementById("stage").contentDocument.getElementById("research-year-scrub").focus()'});
  await send("Input.dispatchKeyEvent",{
    type:"keyDown",key:"ArrowRight",code:"ArrowRight",
    windowsVirtualKeyCode:39,nativeVirtualKeyCode:39
  });
  await send("Input.dispatchKeyEvent",{
    type:"keyUp",key:"ArrowRight",code:"ArrowRight",
    windowsVirtualKeyCode:39,nativeVirtualKeyCode:39
  });
  let keyed;
  for(let n=0;n<30;n++){
    const v=await inspect();
    if(v.slider===moved.slider+1&&v.status==="applied"&&v.target!==moved.target){
      keyed=v;break;
    }
    await sleep(65);
  }
  assert.ok(keyed,"real keyboard ArrowRight did not commit one original Date/Day step");
  assert.equal(keyed.base,keyed.target,"keyboard broke original ownership");
  assert.equal(keyed.delta,"0","keyboard altered the recurrence displacement");
  assert.ok(keyed.url.includes("date="+keyed.target),"keyboard did not update original URL");
  console.log("[original-strip-touch] PASS true 390px touch and ArrowRight: "+
    original.target+" → "+moved.target+" → "+keyed.target+
    "; original base/Δ, canonical Day, visible marker and URL synchronized");
}finally{
  if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
  browser.kill("SIGTERM");
  await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:150});
}
