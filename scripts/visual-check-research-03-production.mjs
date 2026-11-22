// Capture the real loaded Research 03 iframe after its production proof reports
// readiness. CDP keeps the DOM assertion and PNG in the SAME renderer session.
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
import {captureReadyProof} from "./chromium-ready-proof.mjs";

const baseURL=process.env.BASE_URL??"http://127.0.0.1:4173/";
const outputDir=path.resolve("tmp/visual-check");
const viewports=[
  {key:"320x700",width:320,height:700},
  {key:"390x844",width:390,height:844},
  {key:"480x850",width:480,height:850},
  {key:"481x850",width:481,height:850},
  {key:"660x850",width:660,height:850},
  {key:"1440x900",width:1440,height:900}
];
const required=["data-ready=\"true\"","data-time-context=\"evidence\"","data-time-kicker=\"03 · 四柱判定／同一太陽黃經\"","data-conclusion-grammar=\"alignment-fork\"","data-pillar-grammar=\"pillar-verdict\""];
await mkdir(outputDir,{recursive:true});
const captures=[];
for(const viewport of viewports){
  const harness="scripts/fixtures/research-03-production-visual.html?width="+viewport.width+"&height="+viewport.height;
  const url=new URL(harness,baseURL).href;
  const fileName="research-03-production-"+viewport.key+".png";
  const filePath=path.join(outputDir,fileName);
  const {proof,html,diagnostics}=await captureReadyProof({
    url,selector:"#probe",width:Math.max(viewport.width,500),
    height:viewport.height,timeoutMs:55000,screenshotPath:filePath
  });
  for(const expected of required){
    if(!proof.includes(expected))
      throw Error("Research 03 live proof missing "+expected+": "+proof);
  }
  for (const label of ["readingVerdictPx","readingCardPx","readingFootPx"]) {
    if (!new RegExp(`data-${label.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}="[0-9.]+?".*?`).test(proof))
      throw Error("Research 03 real computed reading size missing: "+label+": "+proof);
  }
  // The probe belongs to the actual browser DOM, not a static fixture
  // string or a test-only invented ready token.
  if(!html.includes('id="probe"')||diagnostics.status!=="true")
    throw Error("Research 03 no real post-ready DOM evidence");
  const info=await stat(filePath);
  if(info.size<25000)throw Error(fileName+" unexpectedly small: "+info.size);
  captures.push({viewport:viewport.key,file:fileName,bytes:info.size,url});
}
await writeFile(path.join(outputDir,"research-03-production-evidence.json"),
  JSON.stringify({baseURL,captures,readiness:"CDP live DOM and same-session screenshot"},null,2)+"\n","utf8");
