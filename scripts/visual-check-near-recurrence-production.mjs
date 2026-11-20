// Capture the actual long-horizon section, after JS, at exact iframe widths.
// Tests semantic axes, 41 plotted points, 44px ranking targets and no
// horizontal overflow in the SAME Chromium session as the PNG.
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
import {captureReadyProof} from "./chromium-ready-proof.mjs";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const viewports=[
  {width:320,height:760},
  {width:390,height:844},
  {width:1440,height:900}
];
await mkdir(outputDir,{recursive:true});
const captures=[];
for(const viewport of viewports){
  const label=`${viewport.width}x${viewport.height}`;
  const harness=`scripts/fixtures/near-recurrence-production-visual.html?width=${viewport.width}&height=${viewport.height}`;
  const url=new URL(harness,baseURL).href;
  const fileName=`near-recurrence-production-${label}.png`;
  const filePath=path.join(outputDir,fileName);
  const {proof}=await captureReadyProof({
    url,selector:"#probe",width:Math.max(viewport.width,500),
    height:viewport.height,timeoutMs:50000,screenshotPath:filePath,html:false
  });
  for(const required of [
    'data-ready="true"',
    'data-candidate-count="41"',
    'data-chart-is-visible="true"',
    `data-rendered-width="${viewport.width}"`
  ]){
    if(!proof.includes(required))
      throw Error(`Near-recurrence production proof missing ${required} at ${label}: ${proof}`);
  }
  const bytes=(await stat(filePath)).size;
  if(bytes<30000)throw Error(`Near-recurrence ${label} screenshot suspiciously small: ${bytes}`);
  captures.push({viewport:label,file:fileName,bytes,url,proof});
}
await writeFile(path.join(outputDir,"near-recurrence-production-evidence.json"),
  JSON.stringify({baseURL,captures,readiness:"live computed layout and same-session PNG"},null,2)+"\n","utf8");
