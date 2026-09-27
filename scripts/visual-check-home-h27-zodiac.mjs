import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  H27_REFERENCE_SHA,H27_INSTANTS,H27_VARIANTS,H27_TOKENS
} from "./home-h27-zodiac-prototype.js";
import {
  decodePngRgb,readScreenshotCtm,materialMasks,compareMaterialPng
} from "./material-png-metrics.mjs";

// Two real Zodiac substrate appearances, same exact B2 field and unchanged
// underlying engine; only the existing SVG substrate stop opacities differ.
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const out=path.resolve("tmp/visual-check/home-h27-zodiac");
const sizes={320:[320,844],390:[390,844],1440:[1440,900],2047:[2047,1038]};
const lookup=process.env.CHROMIUM_BIN?process.env.CHROMIUM_BIN:
  ["chromium","chromium-browser","google-chrome","google-chrome-stable"]
    .map(name=>spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"}))
    .find(r=>r.status===0&&r.stdout.trim())?.stdout.trim();
if(!lookup)throw Error("H2.7 requires actual Chromium");
const args=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--hide-scrollbars","--force-device-scale-factor=1",
  "--enable-unsafe-swiftshader","--use-angle=swiftshader-webgl",
  "--run-all-compositor-stages-before-draw","--virtual-time-budget=7400"];
function url(spec){
  const [width,height]=sizes[spec.width],p=new URLSearchParams({
    variant:spec.variant,material:spec.mode,width:String(width),height:String(height),
    instant:spec.instant,classification:spec.classification?"1":"0"
  });
  return new URL("scripts/fixtures/home-h27-zodiac-frame.html?"+p,base).href;
}
function browser(spec,flag){
  const [width,height]=sizes[spec.width];
  const r=spawnSync(lookup,[...args,"--window-size="+Math.max(width,600)+","+height,flag,url(spec)],{
    encoding:flag==="--dump-dom"?"utf8":undefined,
    timeout:55000,killSignal:"SIGKILL",maxBuffer:16*1024*1024
  });
  if(r.status!==0){
    process.stderr.write(r.stderr?.toString()??"");
    throw Error("H2.7 browser failed "+JSON.stringify(spec)+" "+flag);
  }
  return r;
}
const attribute=(tag,k)=>tag.match(new RegExp("data-"+k+'="([^"]*)"'))?.[1]??"";
function probe(spec){
  const tag=browser(spec,"--dump-dom").stdout.match(/<output id="proof"[^>]*>/)?.[0];
  if(!tag)throw Error("H2.7 missing semantic proof");
  const wantPalette=Object.values(H27_TOKENS).join(",");
  const injected=spec.variant==="C0"?0:spec.variant==="C2"?2:1;
  const conditions={
    ready:"true",variant:spec.variant,mode:spec.mode,
    "inner-width":String(spec.width),"instant-ms":String(Date.parse(spec.instant)),
    palette:wantPalette,classification:String(!!spec.classification),
    "ctm-source":"post-layout-screenshot-process"
  };
  for(const [key,expected] of Object.entries(conditions))if(attribute(tag,key)!==expected)
    throw Error("H2.7 invalid probe "+key+" got "+attribute(tag,key)+
      ", want "+expected+"; "+attribute(tag,"error"));
  if(Number(attribute(tag,"injected"))!==injected)
    throw Error("H2.7 structural presentation path count mismatch");
  if(spec.mode==="roughness"&&attribute(tag,"gpu-projection-aligned")!=="true")
    throw Error("H2.7 screenshot GPU projection was not aligned to final layout");
  if(spec.mode==="roughness"&&attribute(tag,"material")!=="roughness")
    throw Error("H2.7 WebGL not active");
  if(spec.mode==="fallback"&&attribute(tag,"fallback")!=="forced")
    throw Error("H2.7 fallback not forced");
  if(spec.mode==="svg"&&attribute(tag,"material")==="roughness")
    throw Error("H2.7 SVG unexpectedly WebGL");
  return {selectedZodiac:attribute(tag,"selected-zodiac"),
    categoryFill:attribute(tag,"classification-fill")};
}
async function screenshot(spec,extra=""){
  const [width,height]=sizes[spec.width],stamp=spec.instant===H27_INSTANTS[0]?"ref":"later";
  const name=["h27",spec.variant,spec.mode,spec.width,stamp].join("-")+extra+".png";
  const file=path.join(out,name);
  browser(spec,"--screenshot="+file);
  const bytes=await readFile(file),info=await stat(file),png=decodePngRgb(bytes);
  if(info.size<10000||png.width!==Math.max(600,width)||png.height!==height)
    throw Error("H2.7 screenshot geometry/size error "+name);
  const index=(8*png.width+png.width-12)*3;
  if(png.rgb[index]>110&&png.rgb[index]>png.rgb[index+1]*1.5&&
    png.rgb[index]>png.rgb[index+2]*1.5)
    throw Error("H2.7 screenshot captured while NOT READY "+name);
  console.log("[h27] "+name+" "+bytes.length+" bytes");
  return {...spec,name,nativeCropWidth:width,imageWidth:png.width,imageHeight:png.height,
    sha256:createHash("sha256").update(bytes).digest("hex")};
}
await mkdir(out,{recursive:true});
const specs=[];
for(const variant of Object.keys(H27_VARIANTS))for(const mode of ["svg","roughness","fallback"])
  for(const width of [390,1440])
    specs.push({variant,mode,width,instant:H27_INSTANTS[0]});
for(const variant of Object.keys(H27_VARIANTS))for(const width of [320,2047])
  specs.push({variant,mode:"roughness",width,instant:H27_INSTANTS[0]});
for(const variant of Object.keys(H27_VARIANTS))
  specs.push({variant,mode:"roughness",width:390,instant:H27_INSTANTS[1]});
const captures=[];
for(const spec of specs){
  const proofState=probe(spec);
  captures.push({...await screenshot(spec),...proofState});
}
const classControls=Object.keys(H27_VARIANTS).map(variant=>({variant,
  ...probe({variant,mode:"svg",width:390,instant:H27_INSTANTS[0],classification:true})}));
if(!classControls[0].categoryFill||classControls[0].categoryFill==="not-applicable"||
  classControls.some(row=>row.categoryFill!==classControls[0].categoryFill))
  throw Error("H2.7 material prototype altered categorical Classification fill");
const root={mode:"roughness",width:1440,instant:H27_INSTANTS[0]};
const get=variant=>captures.find(x=>x.variant===variant&&x.mode===root.mode&&
  x.width===root.width&&x.instant===root.instant);
const v0=get("C0"),replay=await screenshot({...root,variant:"C0"},"-replay");
const load=async shot=>decodePngRgb(await readFile(path.join(out,shot.name)));
const p0=await load(v0),rp=await load(replay),ctm=readScreenshotCtm(p0);
const replayCtm=readScreenshotCtm(rp);
if(replayCtm.some((v,i)=>Math.abs(v-ctm[i])>.001))
  throw Error("H2.7 repeated baseline CTM drift");
const {masks,counts}=materialMasks(p0.width,p0.height,ctm);
// A post-layout SVG CTM marker alone is insufficient: the WebGL shader may
// have initialized while the iframe was still at its 300px default viewport,
// leaving Solar shader pixels projected in the *wrong ring*. This caught a
// serious false-positive in our prior same-fixture V0/V1 optical comparisons.
// Compare solar warmth in C0 true WebGL against the SAME-CSS C0 SVG control.
const controlSvg=captures.find(x=>x.variant==="C0"&&x.mode==="svg"&&
  x.width===1440&&x.instant===H27_INSTANTS[0]);
if(!controlSvg)throw Error("H2.7 SVG Solar reference missing");
const ps=await load(controlSvg);
const svgCtm=readScreenshotCtm(ps);
if(svgCtm.some((v,i)=>Math.abs(v-ctm[i])>.001))
  throw Error("WebGL and SVG final geometry disagree before material comparison");
function solarWarmth(png){
  let red=0,blue=0,n=0;
  for(let i=0;i<masks.solar.length;i++)if(masks.solar[i]){
    red+=png.rgb[i*3];blue+=png.rgb[i*3+2];n++;
  }
  return {count:n,redMean:red/n,blueMean:blue/n,redMinusBlue:(red-blue)/n};
}
const webglSolar=solarWarmth(p0),svgSolar=solarWarmth(ps);
if(webglSolar.redMinusBlue<Math.max(8,svgSolar.redMinusBlue*.5) ||
  webglSolar.redMean<svgSolar.redMean*.72)
  throw Error("WebGL Solar was captured with stale/pre-layout GPU material transform"+
    JSON.stringify({webglSolar,svgSolar}));
const nonZodiac=new Uint8Array(masks.all.length);
for(let i=0;i<nonZodiac.length;i++)nonZodiac[i]=masks.all[i]&&!masks.zodiac[i]?1:0;
const replayZ=compareMaterialPng(p0,rp,masks.zodiac);
const replayOther=compareMaterialPng(p0,rp,nonZodiac);
const variantMetrics={};
for(const variant of ["C1","C2","C3"]) {
  const p=await load(get(variant));
  const otherCtm=readScreenshotCtm(p);
  if(otherCtm.some((v,i)=>Math.abs(v-ctm[i])>.001))
    throw Error("H2.7 post-layout screenshot-process CTM drift in "+variant);
  const zodiac=compareMaterialPng(p0,p,masks.zodiac);
  const other=compareMaterialPng(p0,p,nonZodiac);
  if(other.meanAbsoluteRgb8>replayOther.meanAbsoluteRgb8+.1)
    throw Error("H2.7 "+variant+" changed non-Zodiac material rings: "+other.meanAbsoluteRgb8);
  variantMetrics[variant]={zodiac,nonZodiac:other};
}
const result={
  kind:"H2.7 isolated geometric Zodiac substrate concepts; no production edits",
  reference:H27_REFERENCE_SHA,variants:H27_VARIANTS,tokens:H27_TOKENS,
  captures,classificationControls:classControls,
  metrics:{ctm,counts,webglSolar,svgSolar,baselineReplayIdentical:v0.sha256===replay.sha256,
    replayNoiseZodiac:replayZ,replayNoiseNonZodiac:replayOther,
    alternatives:variantMetrics},
  interpretation:[
    "C0 is unmodified real production; C1 is a broad annular recess; C2 adds fixed-world satin to the same canonical material bed.",
    "Compare BOTH optical alternatives at true 390 pixels and separately in SVG/roughness/fallback.",
    "The final CTM is encoded in the screenshot process, after font loading and layout, never inferred from dump-DOM.",
    "Reject entirely if the surface is a bright stripe, faux double ring, unreadable, dominant over Solar or imperceptible at true phone size.",
    "Masked RGB differences prove isolation only; they cannot approve visual quality."
  ]
};
await writeFile(path.join(out,"h27-structural-artboard-evidence.json"),
  JSON.stringify(result,null,2)+"\n","utf8");
console.log("[h27] "+captures.length+" native conditions; C1="+variantMetrics.C1.zodiac.meanAbsoluteRgb8+
  " C2="+variantMetrics.C2.zodiac.meanAbsoluteRgb8+
  " C3="+variantMetrics.C3.zodiac.meanAbsoluteRgb8+"; nonZodiac="+
  ["C1","C2","C3"].map(v=>variantMetrics[v].nonZodiac.meanAbsoluteRgb8).join("/"));
