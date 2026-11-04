import {
  READING_STUDY_BASE,READING_STUDY_DELTAS,READING_STUDY_OPTIONS,
  alignmentReadingState,evaluateAlignmentReading,shuffledStudyDeltas
} from "./recurrence/phase-alignment-study.js";

const $=id=>document.getElementById(id);
const intro=$("study-intro"),trial=$("study-trial"),diagnostic=$("study-diagnostic"),result=$("study-result");
const frame=$("study-source-frame");
const answerForm=$("study-answer"),choices=$("study-choices");
const status=$("study-status");
const optionNames=new Map(READING_STUDY_OPTIONS.map(x=>[x.id,x.label]));

let order=[],responses=[],index=0,startedAt=0,sessionStarted=null,diagnosticResponse=null;
let sourceReady=null,frameReady=false;
const setStatus=message=>{status.textContent=message;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

function makeSourceURL(){
  const url=new URL("./recurrence.html",location.href);
  url.searchParams.set("date","2026-09-13");
  url.searchParams.set("delta",String(READING_STUDY_DELTAS[0]));
  url.hash="recurrence-instrument";
  return url.href;
}

// No surrogate SVG: the actual R16 fan stays in the original recurrence
// document, using its original sector construction, paint and phase math.
// We only hide unrelated explanatory text in this *study's iframe*.
function maskSurroundingExplanation(doc){
  if(doc.getElementById("alignment-reading-frame-style"))return;
  const instrument=doc.getElementById("recurrence-instrument");
  // Fixed positioning alone did not isolate the fan: the original Research
  // intro remained in front of the diagram in actual 390/900px screenshots.
  // Move the EXISTING instrument (never clone or redraw it) to the top-level
  // body stacking context. Keep other research modules mounted for their
  // own source updates, but make them completely invisible in this iframe.
  doc.body.classList.add("research-task-primary");
  doc.body.append(instrument);
  const style=doc.createElement("style");
  style.id="alignment-reading-frame-style";
  style.textContent=[
    "html,body{margin:0!important;overflow:hidden!important;background:#0d1110!important}",
    "body>:not(#recurrence-instrument){visibility:hidden!important;opacity:0!important;pointer-events:none!important}",
    "body>#recurrence-instrument{visibility:visible!important;opacity:1!important}",
    "#recurrence-instrument{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;z-index:999999!important}",
    "#recurrence-instrument>.research-fan-graphic{height:100vh!important;max-height:none!important;margin:0!important;padding:0!important}",
    "#recurrence-instrument>.recurrence-readout{display:none!important}",
    "#recurrence-instrument .phase-gauge-caption,#recurrence-instrument .recurrence-legend,#recurrence-instrument #deep-time-badge{display:none!important}",
    "#recurrence-instrument #astronomy-residual-ring{display:none!important}"
  ].join("\n");
  doc.head.append(style);
}

async function prepareFrame(){
  if(frameReady)return;
  if(sourceReady)return sourceReady;
  sourceReady=(async()=>{
    if(!frame.getAttribute("src"))frame.src=makeSourceURL();
    for(let n=0;n<200;n++){
      const doc=frame.contentDocument;
      const instrument=doc?.getElementById("recurrence-instrument");
      const details=doc?.getElementById("discrete-phase-fan-details");
      if(details&&!details.open)details.open=true;
      if(instrument?.dataset.phaseGeometry==="signed-shortest-fan"&&
        doc.querySelectorAll("[data-phase-cell]").length===160&&details?.open){
        maskSurroundingExplanation(doc);
        frameReady=true;
        setStatus("使用現有 R16 半圓；已隱藏旁邊的推導文字。");
        return;
      }
      await sleep(90);
    }
    throw new Error("原始研究頁尚未完成相位扇初始化");
  })().catch(error=>{sourceReady=null;throw error;});
  return sourceReady;
}

function renderChoices(){
  choices.replaceChildren();
  for(const option of READING_STUDY_OPTIONS){
    const label=document.createElement("label");
    const input=document.createElement("input");
    input.type="radio";
    input.name="alignment";
    input.value=option.id;
    input.required=true;
    label.append(input,document.createTextNode(option.label));
    choices.append(label);
  }
}

function checkOriginalSource(deltaYears){
  const doc=frame.contentDocument;
  const original=doc.getElementById("recurrence-instrument");
  const expected=alignmentReadingState(deltaYears);
  if(original.dataset.deltaYears!==String(deltaYears)){
    throw new Error("來源半圓的 Δ 尚未更新");
  }
  if(doc.querySelectorAll("[data-phase-cell]").length!==160){
    throw new Error("原版 40／60／60 分格已不完整");
  }
  for(const key of ["gregorian","year","day"]){
    const marker=doc.querySelector('.return-marker[data-return-marker="'+key+'"]');
    if(!marker||Number(marker.dataset.phaseSigned)!==expected.signed[key]){
      throw new Error("原版相位資料與研究題不一致："+key);
    }
  }
}

async function showTrial(){
  const selected=order[index];
  $("trial-count").textContent="第 "+(index+1)+"／"+order.length+" 題";
  answerForm.reset();
  renderChoices();
  await prepareFrame();
  const win=frame.contentWindow;
  win.dispatchEvent(new win.CustomEvent("recurrence:select-delta",{
    detail:{deltaYears:selected,source:"reading-only-study"}
  }));
  checkOriginalSource(selected);
  // The next frame allows the screenshot user sees to be painted before
  // response time starts; resource loading is not part of the measurement.
  await nextFrame();
  startedAt=performance.now();
  setStatus("請只依半圓上原有的刻度、基準線與相位位置回答。");
}

async function startStudy(){
  $("study-start").disabled=true;
  setStatus("載入現有研究頁的原始半圓⋯");
  try{
    await prepareFrame();
    order=new URLSearchParams(location.search).get("order")==="fixed"
      ?[...READING_STUDY_DELTAS]:shuffledStudyDeltas();
    responses=[];
    index=0;
    diagnosticResponse=null;
    $("study-reflection").reset();
    sessionStarted=new Date().toISOString();
    intro.hidden=true;result.hidden=true;diagnostic.hidden=true;trial.hidden=false;
    await showTrial();
  }catch(error){
    trial.hidden=true;intro.hidden=false;
    setStatus("無法啟動研究："+String(error.message||error)+"。請用同站 HTTPS 或本機 HTTP 伺服器開啟。");
  }finally{
    $("study-start").disabled=false;
  }
}

function explanation(item){
  const closed=["gregorian","year","day"].filter(key=>item.closed[key]);
  const labels={gregorian:"公曆結構",year:"年序",day:"日序"};
  const phases=["gregorian","year","day"].map(key=>
    labels[key]+" "+(item.signed[key]>0?"+":"")+item.signed[key]
  ).join("／");
  return "回到 0 的是 "+closed.map(key=>labels[key]).join("、")+"。"+phases+"。";
}

function showDiagnostic(){
  trial.hidden=true;
  diagnostic.hidden=false;
  setStatus("四題已作答。請先記錄判讀方式，正解仍未公開。");
}

function showResults(){
  const assessed=evaluateAlignmentReading(responses);
  const correct=assessed.filter(x=>x.correct).length;
  const meanSeconds=assessed.reduce((n,x)=>n+x.elapsedMs,0)/assessed.length/1000;
  $("study-summary").textContent="判讀正確 "+correct+"／"+assessed.length+
    " 題；平均作答 "+meanSeconds.toFixed(1)+" 秒。這不是普遍讀者的統計結果。";
  const reviews=$("study-review");
  reviews.replaceChildren();
  for(let j=0;j<assessed.length;j++){
    const item=assessed[j];
    const article=document.createElement("article");
    const title=document.createElement("h3");
    title.textContent="第 "+(j+1)+" 題 · Δ +"+item.deltaYears.toLocaleString("zh-TW")+
      " 年 · "+(item.correct?"判讀正確":"尚未辨認");
    const choice=document.createElement("p");
    choice.textContent="你的回答："+optionNames.get(item.choice)+
      "；正解："+optionNames.get(item.answer)+
      "；信心："+({high:"確定",medium:"大致確定",low:"猜測"}[item.confidence])+
      "；反應 "+(item.elapsedMs/1000).toFixed(1)+" 秒";
    const why=document.createElement("p");
    why.textContent=explanation(item);
    article.append(title,choice,why);
    reviews.append(article);
  }
  trial.hidden=true;
  diagnostic.hidden=true;
  result.hidden=false;
  setStatus("四題與判讀方式紀錄已完成。答案現在才公布，結果只存在本頁記憶體中。");
}

function exportResult(){
  if(responses.length!==READING_STUDY_DELTAS.length)return;
  const payload={
    study:"R16 discrete-phase fan alignment-reading pilot",
    version:1,source:"original recurrence.html; no art redesign",
    baseDate:READING_STUDY_BASE,
    startedUtc:sessionStarted,completedUtc:new Date().toISOString(),
    order:[...order],results:evaluateAlignmentReading(responses),
    diagnostic:diagnosticResponse,
    note:"四題的局部零點辨識，不推論完整八字週期；未測得實機播放 FPS"
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="r16-alignment-reading-"+Date.now()+".json";
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$("study-start").addEventListener("click",startStudy);
$("study-restart").addEventListener("click",startStudy);
$("study-export").addEventListener("click",exportResult);
$("study-reflection").addEventListener("submit",event=>{
  event.preventDefault();
  if(responses.length!==READING_STUDY_DELTAS.length)return;
  const data=new FormData(event.currentTarget);
  const cue=data.get("cue"),difficulty=data.get("difficulty");
  if(!["geometry","numbers","both","guess"].includes(cue)||
     !["ring-identity","zero-alignment","unit-comparison","future-recurrence","none"].includes(difficulty))return;
  diagnosticResponse={cue:String(cue),difficulty:String(difficulty)};
  showResults();
});
answerForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const data=new FormData(answerForm);
  const choice=data.get("alignment");
  const confidence=data.get("confidence");
  if(!choice||!confidence)return;
  const elapsedMs=Math.max(0,performance.now()-startedAt);
  responses.push({deltaYears:order[index],choice:String(choice),
    confidence:String(confidence),elapsedMs});
  index++;
  if(index===order.length){showDiagnostic();return;}
  $("study-submit").disabled=true;
  try{await showTrial();}
  catch(error){setStatus("下一張圖載入失敗："+String(error.message||error));}
  finally{$("study-submit").disabled=false;}
});
