import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  H26_REFERENCE_SHA,H26_INSTANTS,H26_VARIANTS,H26_EXPECTED_TOKENS,H26_ZODIAC_STOP_OPACITY
} from "./home-h26-zodiac-contract.js";
import {
  decodePngRgb,readScreenshotCtm,materialMasks,compareMaterialPng
} from "./material-png-metrics.mjs";

// Two real Zodiac substrate appearances, same exact B2 field and unchanged
// underlying engine; only the existing SVG substrate stop opacities differ.
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const out=path.resolve("tmp/visual-check/home-h26-zodiac");
const sizes={320:[320,844],390:[390,844],1440:[1440,900],2047:[2047,1038]};
const lookup=process.env.CHROMIUM_BIN?process.env.CHROMIUM_BIN:
  ["chromium","chromium-browser","google-chrome","google-chrome-stable"]
    .map(name=>spawnSync("sh",["-lc","command -v "+name],{encoding:"utf8"}))
    .find(r=>r.status===0&&r.stdout.trim())?.stdout.trim();
if(!lookup)throw Error("H2.6 requires actual Chromium");
const args=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--hide-scrollbars","--force-device-scale-factor=1",
  "--enable-unsafe-swiftshader","--use-angle=swiftshader-webgl",
  "--run-all-compositor-stages-before-draw","--virtual-time-budget=7400"];
function url(spec){
  const [width,height]=sizes[spec.width],p=new URLSearchParams({
    variant:spec.variant,material:spec.mode,width:String(width),height:String(height),
    instant:spec.instant,classification:spec.classification?"1":"0"
  });
  return new URL("scripts/fixtures/home-h26-zodiac-frame.html?"+p,base).href;
}
function browser(spec,flag){
  const [width,height]=sizes[spec.width];
  const r=spawnSync(lookup,[...args,"--window-size="+Math.max(width,600)+","+height,flag,url(spec)],{
    encoding:flag==="--dump-dom"?"utf8":undefined,
    timeout:55000,killSignal:"SIGKILL",maxBuffer:16*1024*1024
  });
  if(r.status!==0){
    process.stderr.write(r.stderr?.toString()??"");
    throw Error("H2.6 browser failed "+JSON.stringify(spec)+" "+flag);
  }
  return r;
}
const attribute=(tag,k)=>tag.match(new RegExp("data-"+k+'="([^"]*)"'))?.[1]??"";
function probe(spec){
  const tag=browser(spec,"--dump-dom").stdout.match(/<output id="proof"[^>]*>/)?.[0];
  if(!tag)throw Error("H2.6 missing semantic proof");
  const wantPalette=Object.values(H26_EXPECTED_TOKENS).join(",");
  const alpha=Object.values(H26_ZODIAC_STOP_OPACITY[spec.variant]).map(Number);
  const actual=attribute(tag,"stop-alpha").split(",").map(Number);
  const conditions={
    ready:"true",variant:spec.variant,mode:spec.mode,
    "inner-width":String(spec.width),"instant-ms":String(Date.parse(spec.instant)),
    palette:wantPalette,classification:String(!!spec.classification)
  };
  for(const [key,expected] of Object.entries(conditions))if(attribute(tag,key)!==expected)
    throw Error("H2.6 invalid probe "+key+" got "+attribute(tag,key)+
      ", want "+expected+"; "+attribute(tag,"error"));
  if(actual.length!==alpha.length||actual.some((v,i)=>Math.abs(v-alpha[i])>.001))
    throw Error("H2.6 stop alpha mismatch");
  if(spec.mode==="roughness"&&attribute(tag,"material")!=="roughness")
    throw Error("H2.6 WebGL not active");
  if(spec.mode==="fallback"&&attribute(tag,"fallback")!=="forced")
    throw Error("H2.6 fallback not forced");
  if(spec.mode==="svg"&&attribute(tag,"material")==="roughness")
    throw Error("H2.6 SVG unexpectedly WebGL");
  return {selectedZodiac:attribute(tag,"selected-zodiac"),
    categoryFill:attribute(tag,"classification-fill")};
}
async function screenshot(spec,extra=""){
  const [width,height]=sizes[spec.width],stamp=spec.instant===H26_INSTANTS[0]?"ref":"later";
  const name=["h26",spec.variant,spec.mode,spec.width,stamp].join("-")+extra+".png";
  const file=path.join(out,name);
  browser(spec,"--screenshot="+file);
  const bytes=await readFile(file),info=await stat(file),png=decodePngRgb(bytes);
  if(info.size<10000||png.width!==Math.max(600,width)||png.height!==height)
    throw Error("H2.6 screenshot geometry/size error "+name);
  const index=(8*png.width+png.width-12)*3;
  if(png.rgb[index]>110&&png.rgb[index]>png.rgb[index+1]*1.5&&
    png.rgb[index]>png.rgb[index+2]*1.5)
    throw Error("H2.6 screenshot captured while NOT READY "+name);
  console.log("[h26] "+name+" "+bytes.length+" bytes");
  return {...spec,name,nativeCropWidth:width,imageWidth:png.width,imageHeight:png.height,
    sha256:createHash("sha256").update(bytes).digest("hex")};
}
await mkdir(out,{recursive:true});
const specs=[];
for(const variant of Object.keys(H26_VARIANTS))for(const mode of ["svg","roughness","fallback"])
  for(const width of [390,1440])
    specs.push({variant,mode,width,instant:H26_INSTANTS[0]});
for(const variant of Object.keys(H26_VARIANTS))for(const width of [320,2047])
  specs.push({variant,mode:"roughness",width,instant:H26_INSTANTS[0]});
for(const variant of Object.keys(H26_VARIANTS))
  specs.push({variant,mode:"roughness",width:390,instant:H26_INSTANTS[1]});
const captures=[];
for(const spec of specs)captures.push({...await screenshot(spec),...probe(spec)});
const c0=probe({variant:"V0",mode:"svg",width:390,instant:H26_INSTANTS[0],classification:true});
const c1=probe({variant:"V1",mode:"svg",width:390,instant:H26_INSTANTS[0],classification:true});
if(!c0.categoryFill||c0.categoryFill==="not-applicable"||c0.categoryFill!==c1.categoryFill)
  throw Error("H2.6 substrate override altered Classification categorical fill");
const root={mode:"roughness",width:1440,instant:H26_INSTANTS[0]};
const v0=captures.find(x=>x.variant==="V0"&&x.mode===root.mode&&x.width===root.width&&x.instant===root.instant);
const v1=captures.find(x=>x.variant==="V1"&&x.mode===root.mode&&x.width===root.width&&x.instant===root.instant);
const replay=await screenshot({...root,variant:"V0"},"-replay");
const load=async s=>decodePngRgb(await readFile(path.join(out,s.name)));
const p0=await load(v0),p1=await load(v1),rp=await load(replay);
const ctm=readScreenshotCtm(p0);
for(const sample of [p1,rp]){
  const m=readScreenshotCtm(sample);
  if(m.some((v,i)=>Math.abs(v-ctm[i])>.001))
    throw Error("H2.6 screenshot-process CTM changed across conditions");
}
const {masks,counts}=materialMasks(p0.width,p0.height,ctm);
const nonZodiac=new Uint8Array(masks.all.length);
for(let i=0;i<nonZodiac.length;i++)nonZodiac[i]=masks.all[i]&&!masks.zodiac[i]?1:0;
const zodiac=compareMaterialPng(p0,p1,masks.zodiac);
const other=compareMaterialPng(p0,p1,nonZodiac);
const noiseZodiac=compareMaterialPng(p0,rp,masks.zodiac);
const noiseOther=compareMaterialPng(p0,rp,nonZodiac);
if(other.meanAbsoluteRgb8>noiseOther.meanAbsoluteRgb8+.1)
  throw Error("H2.6 Zodiac isolated CSS leaked into other ring material masks");
const result={
  kind:"H2.6 native Zodiac substrate evidence, no production edits",
  reference:H26_REFERENCE_SHA,variants:H26_VARIANTS,
  originalTokens:H26_EXPECTED_TOKENS,
  captures,classificationControl:{baseline:c0.categoryFill,variant:c1.categoryFill},
  metrics:{ctm,counts,baselineReplayIdentical:v0.sha256===replay.sha256,
    zodiac,nonZodiac:other,noiseZodiac,noiseNonZodiac:noiseOther},
  constraints:[
    "Only three existing Zodiac substrate SVG stop-alpha values changed; no hue, texture, lighting, shader or semantic changes.",
    "The independent screenshot-process CTM, not a separate DOM probe, defines material ring masks.",
    "Whole-frame pixel magnitude and native material ROI magnitude are NOT perceptual or aesthetic approval.",
    "Reject changes that cannot be seen at 100% native 390px, or that flatten Solar/Zodiac material hierarchy.",
    "Browser pass does not authorize merging this evidence harness or a production color edit."
  ]
};
await writeFile(path.join(out,"h26-substrate-evidence.json"),
  JSON.stringify(result,null,2)+"\n","utf8");
console.log("[h26] "+captures.length+" conditions complete; Zodiac mean RGB8 delta="+zodiac.meanAbsoluteRgb8+
  " non-Zodiac="+other.meanAbsoluteRgb8);
