import {spawnSync} from "node:child_process";
import {mkdir,stat,writeFile} from "node:fs/promises";
import path from "node:path";
const base=process.env.BASE_URL??"http://127.0.0.1:4173/";
const browser=process.env.CHROMIUM_BIN??"chromium";
const out=path.resolve("tmp/visual-check");
await mkdir(out,{recursive:true});
function run(args,label){
 const p=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu",
  "--disable-dev-shm-usage","--hide-scrollbars","--force-device-scale-factor=1",
  "--virtual-time-budget=8500","--run-all-compositor-stages-before-draw",...args],
  {encoding:"utf8",timeout:75000,maxBuffer:20*1024*1024});
 if(p.status!==0)throw Error("[r22-p2] "+label+" Chrome exit "+p.status+" "+p.stderr?.slice(-600));
 return p.stdout;
}
function assert(check,label){if(!check)throw Error("[r22-p2] "+label);}
const scenes=[
 {w:320,h:1330,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:0,signed:"0,0,0",status:"identity"},
 {w:390,h:1350,date:"2026-09-13",d:0,autoPlay:true,expectedDelta:400,signed:"0,-20,-3",status:"one"},
 {w:390,h:1350,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one"},
 {w:390,h:1350,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:844,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",firstFold:true},
 {w:390,h:1350,date:"2026-09-13",d:1980,signed:"-20,0,0",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:8000,signed:"0,20,0",status:"two"},
 {w:390,h:1350,date:"2026-09-13",d:24000,signed:"0,0,0",status:"all"},
 {w:768,h:1220,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:1440,h:1100,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two"},
 {w:390,h:1350,date:"1900-03-01",d:6180,signed:"180,0,0",status:"two"},
 {w:390,h:1350,date:"2100-03-01",d:16080,signed:"80,0,0",status:"two"},
 // P8: judge two DIFFERENT information encodings against the exact P7 baseline
 // at matched dates/Δ/viewport sizes. No styling-only A/B.
 {w:320,h:1330,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"gap"},
 {w:320,h:1330,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"closure"},
 {w:390,h:1350,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one",study:"gap"},
 {w:390,h:1350,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one",study:"closure"},
 {w:390,h:1350,date:"2026-09-13",d:24000,signed:"0,0,0",status:"all",study:"gap"},
 {w:390,h:1350,date:"2026-09-13",d:24000,signed:"0,0,0",status:"all",study:"closure"},
 {w:390,h:1350,date:"2026-09-13",d:0,signed:"0,0,0",status:"identity",study:"closure"},
 {w:1440,h:1100,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"gap"},
 {w:1440,h:1100,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"closure"},
 // P9 independent experiment: NAME each actually missing phase on its own
 // moving marker; prove that both identity and magnitude survive at 320px.
 {w:320,h:1330,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"missing"},
 {w:320,h:1330,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:0,signed:"0,0,0",status:"identity",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:400,signed:"0,-20,-3",status:"one",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:1980,signed:"-20,0,0",status:"two",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:8000,signed:"0,20,0",status:"two",study:"missing"},
 {w:390,h:1350,date:"2026-09-13",d:24000,signed:"0,0,0",status:"all",study:"missing"},
 {w:1440,h:1100,date:"2026-09-13",d:1200,signed:"0,0,-9",status:"two",study:"missing"}
];
const records=[];
const usedNames=new Set();
for(const s of scenes){
 const url=new URL("scripts/fixtures/r22-live-optin.html",base);
 Object.entries({width:s.w,height:s.h,date:s.date,delta:s.d}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 if(s.autoPlay)url.searchParams.set("autoPlay","first");
 if(s.study)url.searchParams.set("study",s.study);
 const win="--window-size="+Math.max(500,s.w)+","+s.h;
 const label="r22-p2-original-"+s.w+"x"+s.h+"-"+s.date+"-"+s.d+(s.study?"-study-"+s.study:"")+(s.autoPlay?"-reduced-step":"");
 if(usedNames.has(label))throw Error("[r22-p2] duplicate screenshot label "+label);
 usedNames.add(label);
 const modeFlags=s.autoPlay?["--force-prefers-reduced-motion=reduce"]:[];
 const dom=run([win,...modeFlags,"--dump-dom",url.href],label+" DOM");
 const p=dom.match(/<output[^>]*id="probe"[^>]*>/)?.[0]??"";
 for(const [k,v] of Object.entries({ready:"true",delta:s.expectedDelta??s.d,date:s.date,width:s.w,
   signed:s.signed,status:s.status,order:"true",fanCount:3,
   heroAboveFirstViewport:"true",sourceWheel:"true",singleDelta:"true",fourPillars:"true",
   pageOverflow:"false",autoPlayCaptured:"true",playbackPaused:"true",
   outerWithinGraphic:"true",outerVisibleAboveFold:"true",
   sectorLabelHidden:"true",ringLabelHidden:"true",
   sectorRetained:"true",markerRetained:"true",
   fanDegreeSpan:"180",fanVerticalScale:"0.66",
   phaseShape:"signed-shortest-180-semiellipse",
   studyMode:s.study||"baseline",studyOverlay:s.study||"none",
   studyGapCount:String(s.study==="gap"?(s.d===1200?1:s.d===400?2:0):0),
   studySlotCount:String(s.study==="closure"?3:0),
   studyClosedSlots:String(s.study==="closure"?(s.d===1200?2:s.d===400?1:s.d===24000||s.d===0?3:0):0),
   studyScore:s.study==="closure"?(s.d===0?"基準":s.d===400?"1/3 閉合":s.d===1200?"2/3 閉合":"3/3 閉合"):"none",
   studyMissingCount:String(s.study==="missing"?(s.d===400?2:[1200,1980,8000].includes(s.d)?1:0):0),
   studyMissingKeys:s.study==="missing"?(s.d===400?"year,day":s.d===1200?"day":s.d===1980?"gregorian":s.d===8000?"year":"none"):"none",
   studyMissingText:s.study==="missing"?(s.d===400?"年序 −20年|日序 −3日":s.d===1200?"日序 −9日":s.d===1980?"公曆 −20年":s.d===8000?"年序 +20年":"none"):"none",
   studyMissingSigned:s.study==="missing"?(s.d===400?"-20,-3":s.d===1200?"-9":s.d===1980?"-20":s.d===8000?"20":"none"):"none",
   studyMissingLeaders:String(s.study==="missing"?(s.d===400?2:[1200,1980,8000].includes(s.d)?1:0):0),
   studyMissingInView:"true",
   ellipticalRail:"true",railNarrow:"true",railWidth:"26",
   materialGradients:"3",materialUnits:"true",zeroGuideCount:"3",
   zeroGuideAligned:"true",hasLongZeroNeedle:"false",closedLabelQuiet:"true",
   gregorianRingLabelExists:"true",
   fanViewBox:"0 404 1200 446"})){
  assert(p.includes('data-'+k.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())+'="'+v+'"'),
   label+" "+k+" expected "+v+"; probe="+p.slice(0,1400));
 }
 // P5: real Play button updates diagram-adjacent narrative in reduced-motion mode.
 if(s.autoPlay){
  assert(p.includes('data-sampling-mode="step"'),label+" sampling stage not reflected in real original fan");
  assert(p.includes("單步抵達 +400 年"),label+" top-of-diagram caption did not describe actual step");
 }
 // P4: the original 3 real velocities cannot be inferred from the folded
 // semicircle; verify exposed Gregorian ordinal counts and the reading sentence.
 if(s.d===400||s.autoPlay){
  assert(p.includes('data-day-completed-turns="2434"'),label+" actual 60-day rotations missing");
  assert(p.includes('data-year-completed-turns="6"'),label+" true nominal-year rotations missing");
  assert(p.includes('data-gregorian-completed-turns="1"'),label+" Gregorian rotations missing");
 }
 if(s.d===24000){
  assert(p.includes('data-day-completed-turns="146097"'),label+" true 24k day turn count missing");
  assert(p.includes('data-year-completed-turns="400"'),label+" true 24k year turn count missing");
  assert(p.includes('data-gregorian-completed-turns="60"'),label+" true 24k outer turn count missing");
 }
 if(s.firstFold){
  const arcTop=Number(p.match(/data-outer-arc-top="(-?\d+)"/)?.[1]);
  assert(Number.isFinite(arcTop)&&arcTop<844,label+" arc never enters initial 390×844 viewport: "+arcTop);
 }
 const img=path.join(out,label+".png");
 run([win,...modeFlags,"--screenshot="+img,url.href],label+" screenshot");
 const size=(await stat(img)).size;assert(size>30000,label+" blank image "+size);
 records.push({...s,bytes:size,filename:label+".png",heroTop:Number(p.match(/data-hero-top="(-?\d+)"/)?.[1])});
}
await writeFile(path.join(out,"r22-p2-evidence.json"),JSON.stringify({source:"actual recurrence.html original R16 SVG plus opt-in R22 narration",records},null,2)+"\n");
console.log("[r22-p2] PASS "+JSON.stringify(records));