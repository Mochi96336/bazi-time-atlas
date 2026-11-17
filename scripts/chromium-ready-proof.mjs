// Real-clock Chromium readiness. --dump-dom/--virtual-time-budget can snapshot
// a nested iframe before its module scripts, timers and rAF have finished.
// This uses the same native CDP strategy as check-research-original-strip-touch:
// readiness is observed, not assumed, and a timeout FAILS with diagnostics.
import {spawn,spawnSync} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function chromiumBinary(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]){
    const result=spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
    if(result.status===0&&result.stdout.trim())return result.stdout.trim();
  }
  throw Error("No system Chromium/Chrome executable found");
}

/**
 * Observe the REAL top-document proof (normally #probe) in a live Chromium
 * page. Never substitute a fake ready result or ignore a failed assertion.
 * Returns the actual post-ready DOM and optionally a same-session PNG.
 */
export async function captureReadyProof({url,selector="#probe",width=500,height=900,
  timeoutMs=35000,screenshotPath=null,html=true,readyValue="true",additionalArgs=[]}){
  if(!/^https?:\/\//.test(url))throw Error("Ready proof requires an HTTP(S) URL");
  const dir=await mkdtemp(path.join(tmpdir(),"bazi-ready-proof-"));
  const browser=spawn(chromiumBinary(),[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--hide-scrollbars","--no-first-run","--no-default-browser-check",
    "--disable-background-timer-throttling","--disable-renderer-backgrounding",
    "--remote-allow-origins=*","--remote-debugging-port=0",
    "--user-data-dir="+dir,"--force-device-scale-factor=1",
    "--window-size="+width+","+height,...additionalArgs,url
  ],{stdio:["ignore","ignore","pipe"]});
  let stderr="",ws,seq=0;
  const pending=new Map();
  browser.stderr.on("data",data=>{stderr=(stderr+String(data)).slice(-7000);});
  try{
    const deadline=Date.now()+timeoutMs;
    let port;
    while(Date.now()<deadline){
      if(browser.exitCode!==null)throw Error("Chromium exited before CDP: "+stderr);
      try{
        const info=(await readFile(path.join(dir,"DevToolsActivePort"),"utf8")).split("\n");
        if(/^\d+$/.test(info[0])){port=Number(info[0]);break;}
      }catch{}
      await sleep(75);
    }
    if(!port)throw Error("Chromium DevToolsActivePort unavailable: "+stderr);
    let tab;
    while(Date.now()<deadline){
      const response=await fetch("http://127.0.0.1:"+port+"/json/list",{
        signal:AbortSignal.timeout(1200)
      }).catch(()=>null);
      if(response?.ok){
        const tabs=await response.json();
        tab=tabs.find(t=>t.type==="page"&&t.webSocketDebuggerUrl &&
          t.url.startsWith(new URL(url).origin));
        if(tab)break;
      }
      await sleep(75);
    }
    if(!tab)throw Error("No target Chromium page exposed by CDP: "+stderr);
    ws=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error("CDP socket did not open")),7000);
      ws.addEventListener("open",()=>{clearTimeout(timer);resolve();},{once:true});
      ws.addEventListener("error",()=>{clearTimeout(timer);reject(Error("CDP socket error"));},{once:true});
    });
    ws.addEventListener("message",e=>{
      const msg=JSON.parse(e.data);
      if(!pending.has(msg.id))return;
      const task=pending.get(msg.id);pending.delete(msg.id);
      if(msg.error)task.reject(Error("CDP "+msg.error.message));
      else task.resolve(msg.result);
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{
      const id=++seq;
      const timer=setTimeout(()=>{
        pending.delete(id);reject(Error("CDP "+method+" response timed out"));
      },15000);
      pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},
        reject:error=>{clearTimeout(timer);reject(error);}});
      ws.send(JSON.stringify({id,method,params}));
    });
    await send("Runtime.enable");
    await send("Page.enable");
    let last={status:"not present"};
    const expression=`(()=>{
      const node=document.querySelector(${JSON.stringify(selector)});
      return {status:node?.getAttribute("data-ready")??"not present",
        proof:node?.outerHTML??"",error:node?.getAttribute("data-error")??"",
        documentState:document.readyState,
        frames:[...document.querySelectorAll("iframe")].map(f=>({
          src:f.getAttribute("src"),ready:f.contentDocument?.readyState??null
        }))};
    })()`;
    while(Date.now()<deadline){
      const result=await send("Runtime.evaluate",{expression,returnByValue:true});
      if(result.exceptionDetails)throw Error("CDP inspect failed: "+result.exceptionDetails.text);
      const state=result.result?.value??{status:"evaluation unavailable"};
      last=state;
      if(state.status===readyValue){
        let dom=null;
        if(html){
          const full=await send("Runtime.evaluate",{
            expression:"document.documentElement.outerHTML",returnByValue:true
          });
          if(full.exceptionDetails)throw Error("CDP DOM failed: "+full.exceptionDetails.text);
          dom=full.result.value;
        }
        if(screenshotPath){
          const shot=await send("Page.captureScreenshot",{
            format:"png",captureBeyondViewport:false
          });
          await writeFile(screenshotPath,Buffer.from(shot.data,"base64"));
        }
        return {proof:state.proof,html:dom,diagnostics:state};
      }
      if(state.status==="error")throw Error("Browser proof error: "+JSON.stringify(state));
      await sleep(110);
    }
    throw Error("Browser proof never reached "+readyValue+" within "+timeoutMs+
      "ms: "+JSON.stringify(last)+"; Chrome: "+stderr.slice(-1200));
  }finally{
    for(const task of pending.values())task.reject(Error("CDP session closed"));
    if(ws?.readyState===WebSocket.OPEN)ws.close();
    browser.kill("SIGTERM");
    await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:150}).catch(()=>{});
  }
}
