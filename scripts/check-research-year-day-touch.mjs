// Headless Chromium DevTools proof: dispatch actual browser touch and native
// keyboard input, rather than only synthesizing DOM 'input' events.
import assert from "node:assert/strict";
import { spawn,spawnSync } from "node:child_process";
import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const findBrowser=()=>{
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const c of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const p=spawnSync("sh",["-lc","command -v "+c],{encoding:"utf8"});
    if(p.status===0&&p.stdout.trim())return p.stdout.trim();
  }
  throw Error("Chromium unavailable for native touch proof");
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=9236;
const root=new URL("scripts/fixtures/mobile-390.html",base);
root.searchParams.set("target","../../recurrence.html?mode=dates&base=2024-02-01&compare=2024-02-10");
root.searchParams.set("height","1050");
const dir=await mkdtemp(path.join(tmpdir(),"research-touch-"));
const browser=spawn(findBrowser(),[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--hide-scrollbars",
  "--no-first-run","--no-default-browser-check","--remote-allow-origins=*",
  "--remote-debugging-port="+port,"--user-data-dir="+dir,"--window-size=500,1050",root.href
],{stdio:["ignore","ignore","pipe"]});
let errors="";
browser.stderr.on("data",x=>{errors+=String(x).slice(-1000);if(errors.length>6000)errors=errors.slice(-6000)});
let ws=null;
try{
  let target;
  for(let attempt=0;attempt<90;attempt++){
    if(browser.exitCode!==null)throw Error("Chromium exited before CDP ready: "+errors);
    try {
      const response=await fetch("http://127.0.0.1:"+port+"/json/list",{signal:AbortSignal.timeout(400)});
      if(response.ok){
        const tabs=await response.json();
        target=tabs.find(t=>t.type==="page"&&t.url.includes("mobile-390.html"));
        if(target?.webSocketDebuggerUrl)break;
      }
    }catch{}
    await sleep(150);
  }
  if(!target?.webSocketDebuggerUrl)throw Error("CDP target unavailable: "+errors);
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error("CDP websocket timed out")),6000);
    ws.addEventListener("open",()=>{clearTimeout(timer);resolve()},{once:true});
    ws.addEventListener("error",()=>{clearTimeout(timer);reject(Error("CDP websocket error"))},{once:true});
  });
  let id=0;
  const pending=new Map();
  ws.addEventListener("message",event=>{
    const m=JSON.parse(event.data);
    if(!pending.has(m.id))return;
    const p=pending.get(m.id);pending.delete(m.id);
    if(m.error)p.reject(Error("CDP "+m.error.message));
    else p.resolve(m.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id;
    const timer=setTimeout(()=>{pending.delete(key);reject(Error("CDP timed out: "+method))},8000);
    pending.set(key,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:err=>{clearTimeout(timer);reject(err)}});
    ws.send(JSON.stringify({id:key,method,params}));
  });
  const inspect=async()=> {
    const expression=`(()=>{
      const f=document.getElementById("stage"),d=f?.contentDocument;
      if(!d)return {ready:false};
      const root=d.getElementById("research-free-explorer"),slider=d.getElementById("research-one-year-scrub");
      if(!root||root.dataset.ready!=="true"||!slider)return {ready:false};
      const fr=f.getBoundingClientRect(),sr=slider.getBoundingClientRect();
      return {ready:true, viewport:d.documentElement.clientWidth, target:root.dataset.targetDate,
        phase:Number(d.getElementById("research-one-year-story").dataset.dayIndex),
        year:root.dataset.targetActiveYearStatus, name:root.dataset.targetDayPillar,
        aria:d.getElementById("research-one-year-day-pillar").textContent,
        outcome:root.dataset.scrubOutcome||"", url:f.contentWindow.location.search,
        rect:{x:fr.left+sr.left,y:fr.top+sr.top,w:sr.width,h:sr.height},
        min:Number(slider.min),max:Number(slider.max),index:Number(slider.value)};
    })()`;
    const r=await send("Runtime.evaluate",{expression,returnByValue:true});
    if(r.exceptionDetails)throw Error("CDP evaluate failed: "+r.exceptionDetails.text);
    return r.result.value;
  };
  await send("Runtime.enable");
  await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
  let original;
  for(let attempt=0;attempt<150;attempt++){
    const p=await inspect();
    if(p.ready&&p.target==="2024-02-10"&&p.name&&p.name!=="—"){original=p;break}
    await sleep(90);
  }
  assert.ok(original,"research page never initialized");
  assert.equal(original.viewport,390,"must exercise an actual 390 CSS-px iframe");
  assert.ok(original.rect.h>=36,"the Year-band input does not have a reliable touch target");
  const {rect,min,max,index}=original;
  const point=ordinal=>({
    x:Math.round(rect.x+10+(rect.w-20)*(ordinal-min)/(max-min)),
    y:Math.round(rect.y+rect.h/2),id:1
  });
  const touch=async(type,points)=>send("Input.dispatchTouchEvent",{type,touchPoints:points});
  const start=point(index),finish=point(Math.min(index+85,max));
  await touch("touchStart",[start]);
  for(let n=1;n<=6;n++){
    const p={x:start.x+(finish.x-start.x)*n/6,y:start.y,id:1};
    await touch("touchMove",[p]);
    await sleep(24);
  }
  await touch("touchEnd",[]);
  await sleep(140);
  const moved=await inspect();
  assert.notEqual(moved.target,original.target,"native browser touch did not move Year playhead");
  assert.equal(moved.outcome,"applied","touch did not commit through the canonical Research owner");
  assert.ok(moved.url.includes("compare="+moved.target),
    "native touch did not synchronize the selected URL");
  assert.ok(moved.aria.includes(moved.name),"compact Day label did not follow native touch");
  assert.equal(moved.year,"model-estimated","supported post-Li Chun touch changed true Year authority");

  // Native keyboard event is delivered to the actual focused input. Unlike
  // element.stepUp(), this proves browser-level focus and ArrowRight behavior.
  const focus=await send("Runtime.evaluate",{expression:
    'document.getElementById("stage").contentDocument.getElementById("research-one-year-scrub").focus()'});
  if(focus.exceptionDetails)throw Error("Could not focus year input");
  await send("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
  await send("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowRight",code:"ArrowRight",windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
  await sleep(60);
  const keyed=await inspect();
  assert.equal((keyed.phase-moved.phase+60)%60,1,
    "native ArrowRight must move the real 60-Day phase exactly one position");
  assert.ok(keyed.url.includes("compare="+keyed.target),
    "keyboard change did not update shareable URL");
  console.log("[research-touch] PASS 390px Chromium emulated touch + native keyboard, "+
    original.target+" → "+moved.target+" → "+keyed.target+"; Year/Day/URL synchronized");
}finally{
  if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
  browser.kill("SIGTERM");
  await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:150});
}
