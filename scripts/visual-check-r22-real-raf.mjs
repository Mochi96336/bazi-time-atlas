// Real Chromium requestAnimationFrame check: no virtual time or nested iframe.
import {spawn} from "node:child_process";
import {readFile,mkdir,mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

const url=new URL("recurrence.html",process.env.BASE_URL??"http://127.0.0.1:4173/");
for(const [k,v] of Object.entries({r22:"1",date:"2026-09-13",delta:"0"}))url.searchParams.set(k,v);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(ok,msg)=>{if(!ok)throw Error("[r22-real-raf] "+msg);};
let chrome=null,ws=null,profile=null;
try{
 profile=await mkdtemp(path.join(tmpdir(),"r22-real-raf-"));
 chrome=spawn(process.env.CHROMIUM_BIN??"chromium",[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu",
  "--disable-background-timer-throttling","--disable-renderer-backgrounding",
  "--no-first-run","--no-proxy-server","--remote-allow-origins=*",
  "--remote-debugging-port=0","--window-size=440,1250",
  "--user-data-dir="+profile,"about:blank"
 ],{stdio:"ignore"});
 let port=0;
 for(let i=0;i<100;i++){
  try{port=Number((await readFile(path.join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0]);break;}
  catch{if(chrome.exitCode!==null)throw Error("Chromium quit");await sleep(100);}
 }
 check(Number.isInteger(port)&&port>0,"Chromium debugger never started");
 const targets=await(await fetch("http://127.0.0.1:"+port+"/json")).json();
 const page=targets.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);
 check(Boolean(page),"No Chrome page target");
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await Promise.race([
  new Promise((resolve,reject)=>{
   ws.addEventListener("open",resolve,{once:true});
   ws.addEventListener("error",reject,{once:true});
  }),
  sleep(6000).then(()=>{throw Error("WebSocket timeout");})
 ]);
 let id=0;
 const pending=new Map();
 ws.addEventListener("message",event=>{
  const p=JSON.parse(event.data),fn=pending.get(p.id);
  if(fn){pending.delete(p.id);fn(p);}
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++id;
  const timer=setTimeout(()=>{pending.delete(n);reject(Error("CDP "+method+" timeout"));},12000);
  pending.set(n,p=>{
   clearTimeout(timer);
   p.error?reject(Error(JSON.stringify(p.error))):resolve(p.result);
  });
  ws.send(JSON.stringify({id:n,method,params}));
 });
 const evaluate=async expression=>{
  const response=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)throw Error("Page JS exception: "+JSON.stringify(response.exceptionDetails).slice(0,500));
  return response.result?.value;
 };
 const until=async(name,fn,limitMs=12000)=>{
  const begin=Date.now();
  while(Date.now()-begin<limitMs){
   const value=await fn();
   if(value)return value;
   await sleep(70);
  }
  throw Error("Timeout waiting for "+name);
 };
 await send("Page.enable");
 await send("Runtime.enable");
 await send("Emulation.setDeviceMetricsOverride",{width:390,height:1200,deviceScaleFactor:1,mobile:false});
 const navigation=await send("Page.navigate",{url:url.href});
 check(!navigation.errorText,"Chrome navigation failed: "+navigation.errorText);
 await until("R22 real page",async()=>await evaluate(
  "document.documentElement?.dataset?.r22Ready==='true' && document.querySelector('#recurrence-instrument')?.dataset?.deltaYears==='0'"));
 const sample="(()=>{const el=document.querySelector('#recurrence-instrument');window.__r22FrameTrace=[];"+
  "const take=()=>{const item={stage:el.dataset.r22PlaybackStage||'initial',delta:Number(el.dataset.deltaYears),"+
  "signed:['gregorian','year','day'].map(k=>Number(document.querySelector('[data-return-marker=\"'+k+'\"]')?.dataset.phaseSigned))};"+
  "const last=window.__r22FrameTrace.at(-1);"+
  "if(!last||last.stage!==item.stage||last.delta!==item.delta)window.__r22FrameTrace.push(item);};"+
  "new MutationObserver(take).observe(el,{attributes:true,attributeFilter:['data-delta-years','data-r22-playback-stage']});take();return true;})()";
 await evaluate(sample);
 await evaluate("document.querySelector('#research-delta-play').click();true");
 const state="({stage:document.querySelector('#recurrence-instrument').dataset.r22PlaybackStage,"+
  "delta:Number(document.querySelector('#recurrence-instrument').dataset.deltaYears),"+
  "signed:['gregorian','year','day'].map(k=>Number(document.querySelector('[data-return-marker=\"'+k+'\"]')?.dataset.phaseSigned)),"+
  "caption:document.querySelector('.r22-reading-index')?.textContent||''})";
 const hold=await until("normal RAF exact +400 hold",async()=>{
  const s=await evaluate(state);
  return s.stage==="hold"&&s.delta===400?s:null;
 });
 check(hold.signed.join(",")==="0,-20,-3","Incorrect signed phases at +400");
 check(hold.caption.includes("停靠 +400 年"),"No near-fan exact-hold explanation");
 const trace=await evaluate("window.__r22FrameTrace");
 const stages=[...new Set(trace.map(x=>x.stage))];
 for(const stage of ["skip","approach","hold"])check(stages.includes(stage),"Missing RAF stage "+stage);
 check(trace.some(x=>x.stage==="skip"&&x.delta===380),"Incorrect explicit jump window");
 // Dropped frames may cross several integer years. The +400 target cannot be skipped.
 const output=path.resolve("tmp/visual-check");
 await mkdir(output,{recursive:true});
 const screenshot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
 await writeFile(path.join(output,"r22-p5-real-raf-hold-390.png"),Buffer.from(screenshot.data,"base64"));
 await evaluate("document.querySelector('#research-delta-play').click();true");
 await until("user pause",async()=>await evaluate(
  "document.querySelector('#recurrence-instrument').dataset.r22PlaybackStage==='paused'"));
 await sleep(1900);
 const last=await evaluate("({delta:Number(document.querySelector('#recurrence-instrument').dataset.deltaYears),"+
  "stage:document.querySelector('#recurrence-instrument').dataset.r22PlaybackStage,"+
  "playing:document.querySelector('#recurrence-instrument').dataset.deltaPlayback,"+
  "caption:document.querySelector('.r22-reading-index')?.textContent,"+
  "tracks:document.querySelectorAll('#recurrence-wheel .phase-gauge-track').length,"+
  "deltaSliders:document.querySelectorAll('#delta-slider').length})");
 check(last.delta===400&&last.stage==="paused"&&last.playing==="stopped",
  "Canceled hold callback restarted: "+JSON.stringify(last));
 check(last.caption?.includes("已暫停"),"No near-fan pause explanation");
 check(last.tracks===3&&last.deltaSliders===1,"Not the original three tracks or Δ control");
 await writeFile(path.join(output,"r22-p5-real-raf-evidence.json"),
  JSON.stringify({url:url.href,stages,trace,hold,afterPause:last},null,2)+"\n");
 console.log("[r22-real-raf] PASS "+JSON.stringify({stages,hold,afterPause:last}));
}finally{
 try{ws?.close();}catch{}
 if(chrome&&chrome.exitCode===null){
  chrome.kill("SIGTERM");
  await Promise.race([new Promise(resolve=>chrome.once("exit",resolve)),sleep(1200)]);
 }
 if(profile)try{await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200});}catch{}
}
