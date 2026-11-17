// The camera proof uses real resize/rAF events inside a nested 390px iframe.
// --dump-dom + virtual-time can snapshot data-ready=false before those events.
// Capture each state from a live Chromium/CDP session instead.
import {mkdir,writeFile,stat} from "node:fs/promises";
import path from "node:path";
import {captureReadyProof} from "./chromium-ready-proof.mjs";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const url=new URL("scripts/fixtures/mobile-camera-lifecycle.html",baseURL);
const config={
  width:600,height:900,deviceScaleFactor:3,timeoutMs:55000,
  selector:"#proof",html:false,
  additionalArgs:["--enable-unsafe-swiftshader","--use-angle=swiftshader-webgl"]
};
const proof=await captureReadyProof({...config,url:url.href});
const match=proof.proof.match(/<pre id="proof"[^>]*>([\s\S]*?)<\/pre>/);
if(!match)throw Error("Mobile camera proof JSON missing after ready: "+proof.proof);
const evidence=JSON.parse(match[1].replaceAll("&quot;",'"').replaceAll("&amp;","&"));
for(const name of ["zeroSizeDeferred","delayedStartup","elementOnlyResize",
  "viewportHeightResize","pageRestore","noRedundantWrites",
  "cameraAndBackgroundAligned","timeAndPosePreserved"]){
  if(evidence[name]!==true)throw Error("Mobile camera contract failed "+name+
    ": "+JSON.stringify(evidence));
}
const out=path.resolve("tmp/visual-check");
await mkdir(out,{recursive:true});
await writeFile(path.join(out,"mobile-camera-lifecycle.json"),JSON.stringify(evidence,null,2));
url.searchParams.set("capture","1");
const png=path.join(out,"mobile-camera-recovered-390x844.png");
await captureReadyProof({...config,url:url.href,screenshotPath:png});
const info=await stat(png);
if(info.size<15000)throw Error("Mobile camera proof screenshot unexpectedly small: "+info.size);
console.log("Mobile camera lifecycle contract:",JSON.stringify(evidence));
