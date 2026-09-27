import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { H25_INSTANTS, h25ExpectedColors } from "./home-h25-color-contract.js";
import { decodePngRgb, materialMasks, compareMaterialPng, readScreenshotCtm } from "./material-png-metrics.mjs";

// This run compares identical CSS and exact instant/geometry while switching
// ONLY the opt-in Zodiac reflection *tints*. SVG and fallback are controls.
// A green result is data collection, not proof of visible material parity.
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:4173/";
const out = path.resolve("tmp/visual-check/home-h25-zodiac");
const sizes = Object.freeze({
  320:[320,844], 390:[390,844], 1440:[1440,900], 2047:[2047,1038]
});
function chromium() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const bin of ["chromium","chromium-browser","google-chrome","google-chrome-stable"]) {
    const r=spawnSync("sh",["-lc","command -v "+bin],{encoding:"utf8"});
    if (r.status===0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error("H2.5 Zodiac shader study requires Chromium");
}
const browser = chromium();
const args=["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--hide-scrollbars","--force-device-scale-factor=1",
  "--enable-unsafe-swiftshader","--use-angle=swiftshader-webgl",
  "--run-all-compositor-stages-before-draw","--virtual-time-budget=7400"];
function url(spec) {
  const [width,height]=sizes[spec.width];
  const p=new URLSearchParams({
    variant:spec.variant,shader:spec.shader,material:spec.mode,
    width:String(width),height:String(height),
    instant:spec.instant,classification:spec.classification?"1":"0"
  });
  return new URL("scripts/fixtures/home-h25-zodiac-shader-frame.html?"+p,baseURL).href;
}
function run(spec,flag) {
  const [width,height]=sizes[spec.width];
  const r=spawnSync(browser,[...args,"--window-size="+Math.max(600,width)+","+height,flag,url(spec)],{
    encoding:flag==="--dump-dom"?"utf8":undefined,
    timeout:55000,killSignal:"SIGKILL",maxBuffer:16*1024*1024
  });
  if(r.status!==0) {
    process.stderr.write(r.stderr?.toString()??"");
    throw new Error("H2.5 shader browser failed: "+JSON.stringify(spec));
  }
  return r;
}
const attr=(s,k)=>s.match(new RegExp("data-"+k+'="([^"]*)"'))?.[1]??"";
function proof(spec) {
  const match=run(spec,"--dump-dom").stdout.match(/<output id="proof"[^>]*>/);
  if(!match)throw new Error("Missing H2.5 shader fixture proof");
  const tag=match[0], expectedColors=h25ExpectedColors(spec.variant);
  const expected=[expectedColors.field,expectedColors.raised,expectedColors.zodiac].join(",");
  const expectedOptin=String(spec.shader==="indigo" && spec.mode==="roughness");
  for(const [key,value] of Object.entries({
    ready:"true",variant:spec.variant,mode:spec.mode,shader:spec.shader,
    "shader-active":expectedOptin,
    "inner-width":String(spec.width),
    "instant-ms":String(Date.parse(spec.instant)),
    palette:expected,untouched:"true",classification:String(!!spec.classification)
  }))if(attr(tag,key)!==value) {
    throw new Error("H2.5 shader proof mismatch "+key+" expected "+value+
      " observed "+attr(tag,key)+" / "+attr(tag,"error"));
  }
  if(spec.mode==="roughness"&&attr(tag,"material-active")!=="roughness") {
    throw new Error("WebGL shader did not activate");
  }
  if(spec.mode==="fallback"&&attr(tag,"material-fallback")!=="forced") {
    throw new Error("forced fallback failed");
  }
  return { selectedZodiac:attr(tag,"selected-zodiac"),
    classificationFill:attr(tag,"classification-fill") };
}
async function capture(spec, suffix="") {
  const mode=spec.mode, tag=spec.instant===H25_INSTANTS[0]?"ref":"later";
  const name=["zodiac",spec.variant,mode,spec.shader,spec.width,tag].join("-")+suffix+".png";
  const file=path.join(out,name);
  run(spec,"--screenshot="+file);
  const buf=await readFile(file), info=await stat(file);
  const png=decodePngRgb(buf),[width,height]=sizes[spec.width];
  if(info.size<10000||png.width!==Math.max(600,width)||png.height!==height) {
    throw new Error("H2.5 Zodiac screenshot invalid: "+name);
  }
  // The screenshot itself must have passed readiness, not just --dump-dom.
  const idx=(8*png.width+(png.width-12))*3;
  if(png.rgb[idx]>110&&png.rgb[idx]>1.5*png.rgb[idx+1]&&
    png.rgb[idx]>1.5*png.rgb[idx+2]) throw new Error("Screenshot NOT READY: "+name);
  console.log("[h25-zodiac] "+name+" "+buf.length+" bytes");
  return { ...spec,name,bytes:buf.length,
    nativeCropWidth:width,width:png.width,height:png.height,
    sha256:createHash("sha256").update(buf).digest("hex") };
}
await mkdir(out,{recursive:true});
const matrix=[];
for(const variant of ["A2","B3"]) {
  for(const width of [390,1440]) {
    for(const shader of ["legacy","indigo"]) matrix.push({
      variant,mode:"roughness",shader,width,instant:H25_INSTANTS[0]
    });
    for(const mode of ["svg","fallback"]) matrix.push({
      variant,mode,shader:"legacy",width,instant:H25_INSTANTS[0]
    });
  }
}
for(const width of [320,2047])for(const shader of ["legacy","indigo"]) {
  matrix.push({variant:"A2",mode:"roughness",shader,width,instant:H25_INSTANTS[0]});
}
for(const shader of ["legacy","indigo"])matrix.push({
  variant:"A2",mode:"roughness",shader,width:390,instant:H25_INSTANTS[1]
});
const captures=[];
for(const spec of matrix) {
  const p=proof(spec),shot=await capture(spec);
  captures.push({...shot,...p});
}
const classifications=[];
for(const variant of ["A2","B3"]) {
  const result=[];
  for(const shader of ["legacy","indigo"]) {
    const spec={variant,mode:"roughness",shader,width:390,instant:H25_INSTANTS[0],classification:true};
    result.push({shader,...proof(spec)});
  }
  if(!result[0].classificationFill || result[0].classificationFill==="not-applicable" ||
    result[0].classificationFill!==result[1].classificationFill) {
    throw new Error("Opt-in Zodiac shader changed categorical Classification fill");
  }
  classifications.push({variant,results:result});
}
// Canonical material ROI: only the screenshot-process CTM, never a separate
// DOM probe. Compare one repeated legacy to measure browser baseline noise.
const metrics=[];
for(const variant of ["A2","B3"]) {
  const base={variant,mode:"roughness",shader:"legacy",width:1440,instant:H25_INSTANTS[0]};
  const legacy=captures.find(x=>x.variant===variant&&x.mode==="roughness"&&
    x.shader==="legacy"&&x.width===1440);
  const indigo=captures.find(x=>x.variant===variant&&x.mode==="roughness"&&
    x.shader==="indigo"&&x.width===1440);
  const replay=await capture(base,"-replay");
  const local=async shot=>decodePngRgb(await readFile(path.join(out,shot.name)));
  const oldPng=await local(legacy),newPng=await local(indigo),replayPng=await local(replay);
  const ctm=readScreenshotCtm(oldPng);
  for(const sample of [newPng,replayPng]) {
    const other=readScreenshotCtm(sample);
    if(other.some((v,i)=>Math.abs(v-ctm[i])>.001)) {
      throw new Error("Screenshot-process CTM mismatch: "+variant);
    }
  }
  const {masks,counts}=materialMasks(oldPng.width,oldPng.height,ctm);
  const outside=new Uint8Array(masks.all.length);
  for(let i=0;i<outside.length;i++) {
    outside[i]=masks.all[i]&&!masks.zodiac[i]?1:0;
  }
  const inside=compareMaterialPng(oldPng,newPng,masks.zodiac);
  const other=compareMaterialPng(oldPng,newPng,outside);
  const noiseInside=compareMaterialPng(oldPng,replayPng,masks.zodiac);
  const noiseOutside=compareMaterialPng(oldPng,replayPng,outside);
  if(other.meanAbsoluteRgb8>noiseOutside.meanAbsoluteRgb8+.05) {
    throw new Error("H2.5 shader tint leaked into non-Zodiac material at "+variant);
  }
  metrics.push({variant,ctm,regionPixels:counts,
    baselineReplaySame:legacy.sha256===replay.sha256,
    zodiacChange:inside,nonZodiacChange:other,
    replayNoiseZodiac:noiseInside,replayNoiseNonZodiac:noiseOutside});
}
const report={kind:"h25-opt-in-zodiac-shader-tint-diagnostic",
  base:"H2.5 evidence branch; never production default",
  sourceA2:"#47556c",changes:"three Zodiac GLSL RGB tints only; unchanged blend strengths/normal/light/noise",
  captures, classifications,metrics,
  constraints:[
    "Compare same CSS A2/B3 for legacy and explicit opt-in GLSL; do not attribute differences to an environment change.",
    "Non-Zodiac material mask must remain unchanged within baseline-replay noise.",
    "Svg/fallback remain independent controls, not pixel-identical targets.",
    "Color and material legibility must be visually judged in unscaled full PNG, not by mean color delta."
  ]};
await writeFile(path.join(out,"h25-zodiac-shader-evidence.json"),
  JSON.stringify(report,null,2)+"\n","utf8");
console.log("[h25-zodiac] completed "+captures.length+" screenshots and screenshot-CTM masked proofs");
