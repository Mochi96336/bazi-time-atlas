import { spawnSync } from "node:child_process";

const root = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const browser = (() => {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const name of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const found = spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No Chromium available for Now read-head layout probe");
})();
const frames = [
  {width:481,height:844},
  {width:820,height:900},
  {width:821,height:900},
  {width:1440,height:900},
  {width:2047,height:1038,tools:true},
  {width:1440,height:900,tools:true,editor:true}
];
const get = (markup,key) => markup.match(new RegExp('data-'+key+'="([^"]*)"'))?.[1] ?? null;
for (const frame of frames) {
  const args = new URLSearchParams(Object.fromEntries(
    Object.entries(frame).map(([k,v])=>[k,v === true ? "1" : String(v)])
  ));
  const url = new URL("scripts/fixtures/now-readhead-geometry.html?"+args,root).href;
  const process = spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--hide-scrollbars","--force-device-scale-factor=1",
    "--run-all-compositor-stages-before-draw","--virtual-time-budget=8500",
    "--window-size=2100,1100","--dump-dom",url
  ],{encoding:"utf8",timeout:60_000,maxBuffer:10*1024*1024});
  if (process.status !== 0) throw new Error("Chromium read-head probe failed: "+url+" "+process.stderr);
  const dom = process.stdout;
  if (get(dom,"ready") !== "true") throw new Error("read-head not ready ("+get(dom,"error")+"): "+url);
  const n = key => Number(get(dom,key));
  const delta = Math.abs(n("time-center")-n("axis-center"));
  const gap = n("now-gap");
  const offsetY = Math.abs(n("now-y"));
  if (get(dom,"width") !== String(frame.width) || delta > 1.25 ||
      gap < 4 || gap > 22 || offsetY > 3 ||
      n("now-width") < 50 || Math.abs(n("now-width")-n("balance-width")) > 1 ||
      get(dom,"now-position") !== "static" || get(dom,"line-layout") !== "grid" ||
      get(dom,"body-overflow") !== "false" ||
      n("readout-bottom") > n("instrument-bottom")+1 ||
      get(dom,"now-visibility") !== (frame.editor ? "hidden" : "visible") ||
      (frame.editor && get(dom,"editor-open") !== "true") ||
      (frame.tools && get(dom,"analysis-open") !== "true")) {
    throw new Error("read-head geometry regression "+JSON.stringify({
      frame,delta,gap,offsetY,nowWidth:n("now-width"),balanceWidth:n("balance-width"),
      position:get(dom,"now-position"),visibility:get(dom,"now-visibility"),
      layout:get(dom,"line-layout"),overflow:get(dom,"body-overflow"),
      readoutBottom:n("readout-bottom"),instrumentBottom:n("instrument-bottom"),
      editorOpen:get(dom,"editor-open"),analysisOpen:get(dom,"analysis-open")
    }));
  }
  console.log("[now-readhead] PASS "+frame.width+"px / tools="+Boolean(frame.tools)+
    " / editor="+Boolean(frame.editor)+" / axisError="+delta.toFixed(2)+"px / actionGap="+gap.toFixed(2)+"px");
}
