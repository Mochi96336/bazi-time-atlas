import { compareResearchDates } from "./recurrence/research-date-pair.js";
import { shiftGregorianDate } from "./recurrence/gregorian-date-navigation.js";
import { dayWheelDateDestinations } from "./recurrence/day-wheel-date-destinations.js";
import { researchOneYearStory } from "./recurrence/research-one-year-story.js";
import { researchCivilYearJourney } from "./recurrence/research-civil-year-journey.js";
import { activeYearIdentityForDate } from "./recurrence/research-date-pair.js";
import { gregorianOrdinal, validateGregorianDate } from "./recurrence/gregorian-cycle.js";
import { researchYearStripState } from "./research-year-strip-view.js";
import {
  RESEARCH_SEASONAL_EVIDENCE_READY_EVENT,
  RESEARCH_SEASONAL_EVIDENCE_ERROR_EVENT
} from "./recurrence/research-seasonal-chunk-prefetch.js";

const root = document.querySelector("#research-free-explorer");
const form = document.querySelector("#research-date-explorer-form");
const annualButton = document.querySelector("#research-mode-annual");
const datesButton = document.querySelector("#research-mode-dates");
const annualSections = [
  document.querySelector(".research-outline"),
  document.querySelector("#research-discrete"),
  document.querySelector("#research-astronomy"),
  document.querySelector("#research-evidence")
];
const annualInstrument = document.querySelector("#recurrence-instrument");
const lede = document.querySelector(".recurrence-intro .lede");
const annualLede = lede?.textContent ?? "";
const heading = document.querySelector(".recurrence-intro h1");
const annualHeading = heading?.textContent ?? "回歸研究";
const searchOnEntry = new URL(location.href).searchParams;
// A bare Research visit should teach the relationship first. Every existing
// recurrence deep link (?delta, ?date, clock conventions, or research anchors)
// remains annual-only. Explicit mode takes precedence over implicit entry.
const explicitMode = searchOnEntry.get("mode");
const plainLearningEntry = searchOnEntry.size === 0 &&
  (!location.hash || location.hash === "#research-free-explorer");
const freeFromLink = explicitMode === "dates" ||
  (explicitMode !== "annual" && plainLearningEntry);
const fields = {
  base:["year","month","day"].map(name => document.querySelector("#research-explorer-base-" + name)),
  target:["year","month","day"].map(name => document.querySelector("#research-explorer-target-" + name))
};
const evidenceCache = new Map();
const datePattern = /^([0-9]{1,8})-([0-9]{2})-([0-9]{2})$/;
const defaultBase = {year:2024,month:2,day:1};
const defaultTarget = {year:2024,month:2,day:10};
let base = defaultBase;
let target = defaultTarget;
let mode = "annual";
let annualQuery = freeFromLink ? "" : location.search;
let annualHash = freeFromLink ? "" : location.hash;
let hasExplorerSelection = freeFromLink;
// Guided steps ONLY commit the same canonical target date as the existing form.
// An explicit return restores the original date and URL; no second selection.
let yearJourney=null;

function readDateString(value) {
  const match = datePattern.exec(value ?? "");
  if (!match) return null;
  const date = {year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
  return validateGregorianDate(date) ? date : null;
}

function dateKey(date) {
  const two = value => String(value).padStart(2,"0");
  return date.year + "-" + two(date.month) + "-" + two(date.day);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setError(text) {
  const node = document.querySelector("#research-explorer-error");
  node.textContent = text ?? "";
  node.hidden = !text;
  root.dataset.inputValid = String(!text);
}

function syncInputs() {
  for (const name of ["base","target"]) {
    const date = name === "base" ? base : target;
    fields[name].forEach((input,index) => { input.value = String(date[["year","month","day"][index]]); });
  }
}

function readFields(name) {
  const parts = fields[name].map(input => input.value.trim());
  if (!parts.every(part => /^[0-9]{1,8}$/.test(part))) return null;
  const date = {year:Number(parts[0]),month:Number(parts[1]),day:Number(parts[2])};
  return validateGregorianDate(date) ? date : null;
}

function seasonalEvidence(date) {
  const key = dateKey(date);
  if (evidenceCache.has(key)) return evidenceCache.get(key);
  let result = null;
  try { result = researchYearStripState(date); } catch { result = null; }
  if (evidenceCache.size >= 20) evidenceCache.delete(evidenceCache.keys().next().value);
  evidenceCache.set(key,result);
  return result;
}

function paintTape(id, first, second, label) {
  const tape = document.getElementById(id);
  if (tape.childElementCount !== 60) {
    const fragment = document.createDocumentFragment();
    for (let index=0; index<60; index++) {
      const tick = document.createElement("span");
      tick.setAttribute("aria-hidden","true");
      fragment.append(tick);
    }
    tape.replaceChildren(fragment);
  }
  tape.dataset.positions = "60";
  tape.dataset.baseIndex = String(first);
  tape.dataset.targetIndex = String(second);
  tape.setAttribute("aria-label",label + "，基準位置 " + (first+1) + "，比較位置 " + (second+1));
  [...tape.children].forEach((tick,index) => {
    tick.dataset.base = String(index===first);
    tick.dataset.target = String(index===second);
    tick.dataset.both = String(index===first && index===second);
  });
}

function activeYearText(year) {
  if (year.status === "not-evaluated") return "年柱未評估";
  if (year.status === "unresolved") {
    const candidates = year.possiblePillars?.map(item => item.name).join("／") ?? "";
    return candidates ? "待判（" + candidates + "）" : "年界待判";
  }
  return year.pillar.name + (year.status === "model-estimated" ? " · 模型估計" : " · 已判定");
}

function activeStatus(comparison) {
  const state = comparison.activeYearComparison;
  if (state.phase === null) return "實際年柱無法得出兩日期的已判相位；名義年序仍可獨立計算。";
  const certainty = state.status === "exact" ? "已判定" : "模型估計";
  const difference = state.samePhaseAsNominal ? "" : "；與名義年序位移不同";
  return "實際年柱相位 " + state.phase + " / 60（" + certainty + "）" + difference;
}

function hideYearStory() {
  const story=document.getElementById("research-one-year-story");
  if(story){
    story.hidden=true;
    story.dataset.ready="false";
  }
}

const JOURNEY_STAGE_LABELS=Object.freeze({
  start:"1/1 · 公曆年開始",
  "li-chun-date":"立春當天 · 日期尚不足以判斷前後",
  "after-li-chun":"立春翌日 · 查看年柱切換",
  "next-jan-1":"明年 1/1 · 完成一整年"
});

function journeyStageLabel(id) {
  if(id.startsWith("turn-"))return "第 "+Number(id.slice(5))+" 圈完成";
  return JOURNEY_STAGE_LABELS[id]??id;
}


function journeyFormIsClean() {
  const typedBase=readFields("base"),typedTarget=readFields("target");
  return Boolean(typedBase && typedTarget &&
    dateKey(typedBase)===dateKey(base) && dateKey(typedTarget)===dateKey(target));
}

function journeyYearText(stage) {
  // Re-read the existing date-scoped source when seasonal chunks have arrived.
  // A milestone Year is never copied from the nominal year label.
  const active=activeYearIdentityForDate(stage.date,seasonalEvidence(stage.date));
  if (active.status==="unresolved") {
    const candidates=active.possiblePillars?.map(x=>x.name).join("／");
    return "實際年柱："+(candidates?candidates+"（年界待判）":"來源不足，年柱待判");
  }
  if (!active.pillar) return "實際年柱尚無年界證據，不能判定";
  return "實際年柱："+active.pillar.name+
    (active.status==="model-estimated"?"（模型估計）":"（已有判定依據）");
}

function journeyStepMeaning(model, stage) {
  // Status labels already name the currently sourced Year and canonical Day.
  // Explain only what CHANGED at this stop rather than repeating their names.
  if(stage.id==="start") return model.boundary
    ? "公曆換年不是立春；沿著同一條時間軸觀察年柱和日柱。"
    : "本年無可用立春位置，省略年界站點；干支日仍連續前進。";
  if(stage.id==="li-chun-date")return "立春所在日期：未指定時刻，年柱可能有兩種結果。";
  if(stage.id==="after-li-chun")return "已過本年的立春；日柱不因年界而歸零。";
  if(stage.id.startsWith("turn-"))return "走滿 "+Number(stage.id.slice(5))*60+
    " 天，干支日回到起點同一位；日期繼續往前。";
  return "抵達明年 1/1，並不代表又跨過下一次立春。";
}

function renderYearJourney() {
  const panel=document.getElementById("research-one-year-story");
  const guide=document.getElementById("research-year-journey");
  const start=document.getElementById("research-year-journey-start");
  if(!panel || !guide || !start)return;
  if(yearJourney && (
    dateKey(base)!==dateKey(yearJourney.originalBase) ||
    dateKey(target)!==dateKey(yearJourney.model.milestones[yearJourney.index].date)
  )){
    // A manual form/slider/wheel/date-step commit takes ownership immediately.
    // Never keep a stale guided selection next to the newly chosen date.
    yearJourney=null;
    root.dataset.yearJourneyOutcome="interrupted-by-manual-date";
  }
  const active=Boolean(yearJourney);
  panel.dataset.journeyActive=String(active);
  guide.hidden=!active;
  start.hidden=active;
  start.disabled=target.year>=10_000_000;
  if(!active){
    if(start.disabled)start.title="此年份已達支援上限，沒有下一年的 1/1";
    else start.removeAttribute("title");
    root.dataset.yearJourneyActive="false";
    return;
  }
  const {model,index}=yearJourney;
  const milestone=model.milestones[index];
  root.dataset.yearJourneyActive="true";
  root.dataset.yearJourneyOriginYear=String(model.year);
  root.dataset.yearJourneyStep=milestone.id;
  root.dataset.yearJourneyElapsed=String(milestone.elapsedDays);
  root.dataset.yearJourneyRemainder=String(model.remainder);
  setText("research-year-journey-heading",model.year+" 年");
  setText("research-year-journey-step",journeyStageLabel(milestone.id));
  setText("research-year-journey-meaning",journeyStepMeaning(model,milestone));
  // The ONE formula/progress line lives immediately below the ONE year strip.
  // Do not construct a second Day dial or any per-turn progress circles.
  const elapsed=milestone.elapsedDays;
  const completed=milestone.completedTurns;
  const rest=milestone.partialDays;
  setText("research-one-year-day-motion",
    milestone.id==="next-jan-1"
      ? model.year+" 年共 "+model.yearLength+" 天：干支日走滿 6 圈，再走 "+model.remainder+" 天。"
      : "自 "+model.year+"/1/1 已走 "+elapsed+" / "+model.yearLength+
        " 天 · "+completed+" 圈，再走 "+rest+" 天");
  const prev=document.getElementById("research-year-journey-previous");
  const next=document.getElementById("research-year-journey-next");
  const finish=document.getElementById("research-year-journey-finish");
  const restore=document.getElementById("research-year-journey-restore");
  const finished=index===model.milestones.length-1;
  prev.disabled=index===0;
  next.disabled=finished;
  next.textContent=finished?"已走完一年":"下一步："+journeyStageLabel(model.milestones[index+1].id).split(" · ")[0];
  finish.hidden=finished;
  restore.textContent="回 "+yearJourney.originalTarget.month+"/"+yearJourney.originalTarget.day;
  restore.setAttribute("aria-label","返回原選定日期 "+dateKey(yearJourney.originalTarget));
}

function commitJourneyStage(index) {
  if(!yearJourney || mode!=="dates" || root.dataset.ready!=="true")return;
  if(!journeyFormIsClean()){
    root.dataset.yearJourneyOutcome="stale-input";
    setError("日期尚未確認，請先套用或復原輸入；導覽不會覆蓋未儲存的日期。");
    return;
  }
  const stage=yearJourney.model.milestones[index];
  if(!stage)return;
  yearJourney.index=index;
  target={...stage.date};
  hasExplorerSelection=true;
  root.dataset.yearJourneyOutcome="applied";
  syncInputs();setError(null);render();syncFreeQuery();
}

function restoreYearJourney({restoreUrl=true}={}) {
  if(!yearJourney)return;
  const {originalTarget,originalBase,originalPath}=yearJourney;
  yearJourney=null;
  target={...originalTarget};base={...originalBase};
  root.dataset.yearJourneyOutcome="restored";
  syncInputs();setError(null);render();
  if(restoreUrl){
    history.replaceState(null,"",originalPath);
    root.dataset.urlValid="true";
  }
}

function startYearJourney() {
  if(mode!=="dates" || root.dataset.ready!=="true")return;
  if(!journeyFormIsClean()){
    root.dataset.yearJourneyOutcome="stale-input";
    setError("請先確認日期，才能開始一年導覽；未儲存的輸入仍保留。");
    return;
  }
  const cap=researchCivilYearJourney(target);
  if(!cap.available){
    root.dataset.yearJourneyOutcome=cap.reason;
    setError("目前日期已到達支援年份上限，無法前進至下一年 1/1。");
    return;
  }
  const model=researchCivilYearJourney(target,{
    boundaryEvidence:seasonalEvidence(target),
    yearEvidenceForDate:seasonalEvidence
  });
  yearJourney={
    model,index:0,
    originalBase:{...base},originalTarget:{...target},
    originalPath:location.pathname+location.search+location.hash
  };
  root.dataset.yearJourneyOutcome="started";
  target={...model.milestones[0].date};
  syncInputs();setError(null);render();syncFreeQuery();
}

function renderYearStory(comparison, seasonal) {
  // Year authority comes from researchYearStripState for the SELECTED year,
  // not from the nominal post-Li-Chun label used by 60-year recurrence.
  const story=researchOneYearStory(target,seasonal);
  const panel=document.getElementById("research-one-year-story");
  panel.hidden=false;
  const active=comparison.target.activeYear;
  const name=active.pillar?.name ?? (active.possiblePillars?.map(p=>p.name).join("／") ?? "年柱待判");
  const yearCertainty=active.status==="exact"?"已有年界依據":
    active.status==="model-estimated"?"年界模型估計（非精確時刻）":
    active.status==="unresolved"?"立春邊界附近：未指定時間，兩種年柱皆可能":"尚無可用年界證據";
  const day=comparison.target.day;
  const year=target.year;
  panel.dataset.ready="true";
  panel.dataset.year=String(year);
  panel.dataset.activeYearStatus=active.status;
  panel.dataset.activeYearName=active.pillar?.name ?? "unresolved";
  panel.dataset.dayName=day.name;
  panel.dataset.selectedPosition=story.selectedPosition.toFixed(4);
  panel.dataset.liChunPosition=story.liChun?story.liChun.position.toFixed(4):"unavailable";
  panel.dataset.liChunStatus=story.liChun?.status ?? "unavailable";
  panel.dataset.civilYearDays=String(story.yearLength);
  panel.dataset.dayCycleYearAdvance=String(story.dayPhaseAcrossCivilYear);

  const exampleNote=document.getElementById("research-one-year-example-note");
  if(exampleNote) exampleNote.hidden=!(
    plainLearningEntry &&
    target.year===defaultTarget.year && target.month===defaultTarget.month &&
    target.day===defaultTarget.day && base.year===defaultBase.year &&
    base.month===defaultBase.month && base.day===defaultBase.day
  );
  setText("research-one-year-selected-date",dateKey(target).replaceAll("-","/"));
  setText("research-one-year-selected-label","選定日 "+target.month+"/"+target.day);
  setText("research-one-year-calendar-year",year.toLocaleString("en-US")+" 年");
  setText("research-one-year-active-pillar",name);
  setText("research-one-year-active-evidence",yearCertainty);
  setText("research-one-year-day-pillar",day.name);
  // This one fixed annual sentence explains the full 365/366-day displacement.
  // The guide reuses THIS line for its progress instead of opening another graph.
  setText("research-one-year-day-motion",
    year+" 年共 "+story.yearLength+" 天：干支日走滿 6 圈，再走 "+
    story.dayPhaseAcrossCivilYear+" 天。");

  // Keep the only date playhead and the Day cycle tied to the same committed
  // selected civil date. No second Year or Day computation authority is used.
  const scrub=document.getElementById("research-one-year-scrub");
  scrub.max=String(story.yearLength-1);
  scrub.value=String(story.selectedDayOrdinal-1);
  scrub.setAttribute("aria-valuetext",dateKey(target)+"，年柱 "+name+"，干支日 "+day.name);
  panel.dataset.dayIndex=String(day.index);
  panel.dataset.dayPosition=String(day.index+1);

  const marker=document.getElementById("research-one-year-selected-marker");
  marker.style.left=story.selectedPosition.toFixed(4)+"%";
  const liChun=document.getElementById("research-one-year-lichun-marker");
  const dateText=story.liChun?story.liChun.date.month+"/"+story.liChun.date.day:null;
  const beforeSegment=document.getElementById("research-one-year-before-segment");
  const afterSegment=document.getElementById("research-one-year-after-segment");
  const eraLegend=document.getElementById("research-one-year-era-legend");
  if(story.liChun){
    beforeSegment.hidden=false;
    afterSegment.hidden=false;
    eraLegend.hidden=false;
    beforeSegment.style.width=story.liChun.position.toFixed(4)+"%";
    afterSegment.style.left=story.liChun.position.toFixed(4)+"%";
    afterSegment.style.width=(100-story.liChun.position).toFixed(4)+"%";
    const estimate=story.liChun.status==="estimated"?"約 ":"";
    setText("research-one-year-before-label","立春前 · "+(story.liChun.before??"未判"));
    setText("research-one-year-after-label",estimate+"立春後 · "+(story.liChun.after??"未判"));
    liChun.hidden=false;
    liChun.style.left=story.liChun.position.toFixed(4)+"%";
    liChun.dataset.status=story.liChun.status;
    setText("research-one-year-lichun-label",
      (story.liChun.status==="estimated"?"約 ":"")+"立春 "+dateText+
      " · "+(story.liChun.before??"？")+" → "+(story.liChun.after??"？"));
  } else {
    liChun.hidden=true;
    beforeSegment.hidden=true;
    afterSegment.hidden=true;
    eraLegend.hidden=true;
    setText("research-one-year-lichun-label","立春位置待查 · 未繪製推測刻度");
  }

  const zoom=document.getElementById("research-one-year-boundary-zoom");
  const near=story.boundaryZoom;
  zoom.hidden=!near;
  panel.dataset.boundaryZoomVisible=String(Boolean(near));
  if(near){
    const daySpan=document.getElementById("research-one-year-zoom-selected-day");
    const eventTick=document.getElementById("research-one-year-zoom-event");
    daySpan.style.left=near.selectedDayStartPercent.toFixed(4)+"%";
    daySpan.style.width=near.selectedDayWidthPercent.toFixed(4)+"%";
    daySpan.dataset.includesEvent=String(near.selectedDayContainsEvent);
    eventTick.dataset.status=story.liChun.status;
    setText("research-one-year-zoom-center",
      (story.liChun.status==="estimated"?"約 ":"")+"立春 "+
      story.liChun.date.month+"/"+story.liChun.date.day);
    zoom.querySelector(".research-one-year-zoom-track").setAttribute(
      "aria-label","立春附近前後各14天的局部放大，立春刻度在中央；"+
      "選定民用日期 "+target.month+"/"+target.day+
      " 標示完整24小時，"+
      (near.selectedDayContainsEvent?"包含立春事件，須另有時刻才能判定年柱":
       near.selectedDayStartPercent<50?"位於立春前":"位於立春後")+
      "；這段放大圖與上方全年時間線的尺度不同"
    );
  }
  const boundaryMeaning=active.status==="unresolved"
    ? "選定日位於立春判定邊界；沒有可用時刻時，不指定其中一個干支年。"
    : !story.liChun
      ? "立春天文位置無法確認：只呈現公曆日期與連續干支日，不推測年界刻度。"
      : "公曆 1/1 並不是干支年界。"+
        (active.side==="before"?"這一天仍在立春之前。":
         active.side==="after"?"這一天已經跨過立春。":"這一天的立春前後關係仍待確認。");
  setText("research-one-year-boundary-meaning",boundaryMeaning);
  setText("research-one-year-source",
    story.liChun
      ? "立春位置："+(story.liChun.status==="estimated"?"模型估計":"來源解析")+
        (story.liChun.label?" · "+story.liChun.label:"")+" · 研究顯示基準 UT1+"+
        (seasonal?.displayOffset?.hours??8)+"（非民用時區預報）"
      : story.liChunUnavailable);

  const track=document.getElementById("research-one-year-track");
  track.setAttribute("aria-label",year+" 年公曆時間線，1/1 起點，12/31 終點，"+
    dateKey(target)+" 選定日位於 "+story.selectedPosition.toFixed(1)+"%；"+
    (story.liChun?(story.liChun.status==="estimated"?"模型估計 ":"")+"立春 "+
      dateText+" 位於 "+story.liChun.position.toFixed(1)+"%":"立春實際位置尚未取得")+"；"+
    "目前年柱 "+name+"，"+yearCertainty);
  renderYearJourney();
}

function render() {
  let comparison;
  let targetSeasonal;
  try {
    targetSeasonal=seasonalEvidence(target);
    comparison = compareResearchDates(base,target,{
      baseYearEvidence:seasonalEvidence(base),
      targetYearEvidence:targetSeasonal
    });
  } catch (error) {
    root.dataset.ready = "false";
    hideYearStory();
    document.querySelector("#research-explorer-results").hidden = true;
    setError("無法比較這兩個日期：" + error.message);
    return;
  }
  root.dataset.ready = "true";
  root.dataset.comparisonKind = comparison.comparisonKind;
  root.dataset.baseDate = dateKey(base);
  root.dataset.targetDate = dateKey(target);
  root.dataset.signedElapsedDays = String(comparison.daySequence.elapsedDays);
  root.dataset.yearPhase = String(comparison.yearSequence.phase);
  root.dataset.dayPhase = String(comparison.daySequence.phase);
  root.dataset.baseDayPillar = comparison.base.day.name;
  root.dataset.targetDayPillar = comparison.target.day.name;
  root.dataset.baseActiveYearStatus = comparison.base.activeYear.status;
  root.dataset.targetActiveYearStatus = comparison.target.activeYear.status;
  root.dataset.activeYearPhase = comparison.activeYearComparison.phase===null
    ? "unavailable" : String(comparison.activeYearComparison.phase);
  root.dataset.annualRecurrenceEligible = String(comparison.applicability.annualRecurrenceEligible);
  root.dataset.astronomyApplicability = comparison.applicability.astronomy;
  root.dataset.fourPillarsApplicability = comparison.applicability.fourPillars;
  renderYearStory(comparison,targetSeasonal);
  document.querySelector("#research-explorer-results").hidden = false;

  const elapsed = comparison.daySequence.elapsedDays;
  setText("research-explorer-date-range",dateKey(base).replaceAll("-","/") + " → " + dateKey(target).replaceAll("-","/"));
  setText("research-explorer-elapsed-days",elapsed===0 ? "相同日期 · 經過 0 日"
    : (elapsed>0 ? "向後 " : "向前 ") + Math.abs(elapsed).toLocaleString("en-US") + " 日");
  setText("research-explorer-year-base",comparison.base.nominalYear.name);
  setText("research-explorer-year-target",comparison.target.nominalYear.name);
  setText("research-explorer-day-base",comparison.base.day.name);
  setText("research-explorer-day-target",comparison.target.day.name);
  setText("research-explorer-glance-year-base",comparison.base.nominalYear.name);
  setText("research-explorer-glance-year-target",comparison.target.nominalYear.name);
  setText("research-explorer-glance-day-base",comparison.base.day.name);
  setText("research-explorer-glance-day-target",comparison.target.day.name);
  setText("research-explorer-year-phase",comparison.yearSequence.phase + " / 60");
  setText("research-explorer-day-phase",comparison.daySequence.phase + " / 60");
  setText("research-explorer-year-active-base",activeYearText(comparison.base.activeYear));
  setText("research-explorer-year-active-target",activeYearText(comparison.target.activeYear));
  setText("research-explorer-year-active-status",activeStatus(comparison));
  paintTape("research-explorer-year-tape",comparison.base.nominalYear.cycleIndex,
    comparison.target.nominalYear.cycleIndex,"名義 60 年序");
  paintTape("research-explorer-day-tape",comparison.base.day.index,
    comparison.target.day.index,"連續 60 日序");
  setText("research-explorer-closure",
    comparison.closure.nominalYearAndDay
      ? "名義年序與日序回到基準位置；這不是公曆、天文或四柱的回歸證明。"
      : comparison.yearSequence.closed
        ? "名義年序重合；日序仍相差 " + comparison.daySequence.phase + " 位。"
        : comparison.daySequence.closed
          ? "日序重合；名義年序仍相差 " + comparison.yearSequence.phase + " 位。"
          : "名義年序與日序尚未同時重合。");
}

function syncFreeQuery() {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("mode","dates");
  url.searchParams.set("base",dateKey(base));
  url.searchParams.set("compare",dateKey(target));
  // An annual-only anchor must never survive into a mode that hides its target.
  url.hash = "";
  history.replaceState(null,"",url.pathname + url.search);
  root.dataset.urlValid = "true";
}

function applyDates(writeUrl=true) {
  const nextBase = readFields("base");
  const nextTarget = readFields("target");
  if (!nextBase || !nextTarget) {
    root.dataset.ready = "false";
    hideYearStory();
    document.querySelector("#research-explorer-results").hidden = true;
    setError("請輸入兩個真實存在的公曆日期（西元 1–10,000,000 年）。");
    return false;
  }
  base = nextBase;
  target = nextTarget;
  hasExplorerSelection = true;
  setError(null);
  render();
  if (writeUrl && mode==="dates") syncFreeQuery();
  return true;
}

/**
 * Step the COMMITTED comparison date from the two visible date inputs.
 * Never synthesize an astronomical or four-pillar result from this operation.
 * Invalid in-progress edits and finite calendar bounds must fail without
 * changing either committed date or the shareable URL.
 */
function stepComparisonDate(days) {
  if (mode !== "dates") return;
  const candidateBase = readFields("base");
  const candidateTarget = readFields("target");
  if (!candidateBase || !candidateTarget) {
    applyDates(false);
    root.dataset.stepOutcome = "invalid-input";
    return;
  }
  let shifted;
  try {
    shifted = shiftGregorianDate(candidateTarget,days);
  } catch {
    root.dataset.stepOutcome = "out-of-range";
    // The visible fields may contain an unsaved, otherwise valid date that
    // differs from the last committed result. Never show stale comparison
    // values beside that failed edit; keep the fields so a reverse step can
    // recover without retyping.
    root.dataset.ready = "false";
    hideYearStory();
    document.querySelector("#research-explorer-results").hidden = true;
    setError("比較日期位移超出可用公曆範圍，未更新已選日期。請修改日期或改用反方向位移。");
    return;
  }
  base = candidateBase;
  target = shifted;
  hasExplorerSelection = true;
  root.dataset.stepOutcome = "applied";
  root.dataset.lastStepDays = String(days);
  syncInputs();
  setError(null);
  render();
  syncFreeQuery();
}

/**
 * The free Day wheel is an exploration-only presenter. Only this owner can
 * commit a resulting date; always re-evaluate the selected index and requested
 * direction from the CURRENT date. Stale previews, uncommitted form edits and
 * calendar bounds fail closed and never rewrite the annual instrument.
 */
function jumpToSelectedDay(event) {
  if (mode!=="dates" || root.dataset.ready!=="true")return;
  const {direction,selectedIndex,fromDate} = event.detail ?? {};
  if (!["previous","next"].includes(direction))return;
  if (!Number.isInteger(selectedIndex) || selectedIndex<0 || selectedIndex>=60)return;
  const inputBase=readFields("base");
  const inputTarget=readFields("target");
  if(!inputBase || !inputTarget ||
    dateKey(inputBase)!==dateKey(base) || dateKey(inputTarget)!==dateKey(target) ||
    fromDate!==dateKey(target)) {
    root.dataset.ready="false";
    hideYearStory();
    document.querySelector("#research-explorer-results").hidden=true;
    setError("日期輸入尚未確認，請先按「比較日期」，再用轉盤跳轉。");
    root.dataset.wheelJumpOutcome="stale-input";
    return;
  }
  const choices=dayWheelDateDestinations(target,selectedIndex);
  const selected=choices[direction];
  if(!selected.date) {
    root.dataset.wheelJumpOutcome="out-of-range";
    setError("這個方向沒有可用的公曆日期，原比較日期未改動。");
    return;
  }
  target=selected.date;
  root.dataset.wheelJumpOutcome="applied";
  root.dataset.wheelJumpDirection=direction;
  root.dataset.wheelJumpOffset=String(selected.offsetDays);
  root.dataset.wheelSelectedIndex=String(selectedIndex);
  syncInputs();
  setError(null);
  render();
  syncFreeQuery();
}

function setMode(next,{updateUrl=true}={}) {
  if(next==="annual" && yearJourney) restoreYearJourney({restoreUrl:false});
  mode = next;
  const dates = next === "dates";
  document.body.dataset.researchMode = next;
  root.hidden = !dates;
  annualSections.forEach(node => { if (node) node.hidden = dates; });
  annualButton.setAttribute("aria-pressed",String(!dates));
  datesButton.setAttribute("aria-pressed",String(dates));
  if (lede) lede.textContent = dates
    ? "先看選定日落在立春哪一側，再探索年序與日序不同的前進速度。"
    : annualLede;
  if (heading) heading.textContent = dates ? "時間循環" : annualHeading;
  if (dates) {
    if (!hasExplorerSelection) {
      const annualBase = readDateString(annualInstrument?.dataset.baseDate);
      const annualTarget = readDateString(annualInstrument?.dataset.targetDate);
      if (annualBase && annualTarget) {
        base = annualBase;
        target = annualTarget;
      }
      hasExplorerSelection = true;
    }
    syncInputs();
    setError(null);
    render();
    if (updateUrl) syncFreeQuery();
  } else if (updateUrl) {
    const url = new URL(location.href);
    if (annualQuery) {
      url.search = annualQuery;
    } else {
      url.search = "";
      url.searchParams.set("date",annualInstrument?.dataset.baseDate ?? "2026-09-13");
      url.searchParams.set("delta",annualInstrument?.dataset.deltaYears ?? "0");
    }
    url.hash = annualHash;
    history.replaceState(null,"",url.pathname + url.search + url.hash);
    if (annualHash) window.dispatchEvent(new Event("hashchange"));
  }
}

if (root && form && annualButton && datesButton) {
  const linkedBase = readDateString(searchOnEntry.get("base"));
  const linkedTarget = readDateString(searchOnEntry.get("compare"));
  const linkError = freeFromLink && (searchOnEntry.has("base") || searchOnEntry.has("compare"))
    && !(linkedBase && linkedTarget);
  if (linkedBase && linkedTarget) { base = linkedBase; target = linkedTarget; }
  syncInputs();
  form.addEventListener("submit",event => { event.preventDefault(); applyDates(); });
  fields.base.concat(fields.target).forEach(input => input.addEventListener("change",() => applyDates()));
  document.querySelector("#research-explorer-swap")?.addEventListener("click",() => {
    [base,target] = [target,base];
    syncInputs();
    setError(null);
    render();
    if (mode==="dates") syncFreeQuery();
  });
  root.querySelectorAll("[data-explorer-step-days]").forEach(button => {
    const displacement = Number(button.dataset.explorerStepDays);
    if (![-60,-1,1,60].includes(displacement)) throw new Error("unsupported date-explorer step");
    button.addEventListener("click",() => stepComparisonDate(displacement));
  });
  document.getElementById("research-one-year-scrub")?.addEventListener("input",event => {
    if (mode!=="dates" || root.dataset.ready!=="true") return;
    // A dirty or invalid form must never be replaced by a speculative drag.
    // This matches the existing free-wheel stale-input protection.
    const typedBase=readFields("base"),typedTarget=readFields("target");
    if(!typedBase || !typedTarget ||
      dateKey(typedBase)!==dateKey(base) || dateKey(typedTarget)!==dateKey(target)){
      root.dataset.scrubOutcome="stale-input";
      setError("日期尚未確認，請先套用日期，再拖動年度時間線。");
      event.currentTarget.value=String(gregorianOrdinal(target)-
        gregorianOrdinal({year:target.year,month:1,day:1}));
      return;
    }
    const offset=Number(event.currentTarget.value);
    if(!Number.isInteger(offset)||offset<0||offset>=
      (researchOneYearStory(target).yearLength)){
      root.dataset.scrubOutcome="invalid-step";
      return;
    }
    try{
      const chosen=shiftGregorianDate({year:target.year,month:1,day:1},offset);
      if(chosen.year!==target.year) throw new RangeError("outside selected civil year");
      target=chosen;
      hasExplorerSelection=true;
      root.dataset.scrubOutcome="applied";
      root.dataset.lastScrubDate=dateKey(target);
      syncInputs();setError(null);render();syncFreeQuery();
    }catch{
      root.dataset.scrubOutcome="out-of-range";
      setError("年度時間線無法移到這個日期，原選定日期已保留。");
    }
  });
  document.getElementById("research-year-journey-start")?.addEventListener("click",startYearJourney);
  document.getElementById("research-year-journey-previous")?.addEventListener("click",()=>{
    if(yearJourney)commitJourneyStage(yearJourney.index-1);
  });
  document.getElementById("research-year-journey-next")?.addEventListener("click",()=>{
    if(yearJourney)commitJourneyStage(yearJourney.index+1);
  });
  document.getElementById("research-year-journey-finish")?.addEventListener("click",()=>{
    if(yearJourney)commitJourneyStage(yearJourney.model.milestones.length-1);
  });
  document.getElementById("research-year-journey-restore")?.addEventListener("click",()=>restoreYearJourney());
  root.addEventListener("research-free-wheel:jump",jumpToSelectedDay);
  // Existing Research-only source loads asynchronously. A new verified chunk
  // may refine Year identities but must never change the discrete date phases.
  const refreshYearEvidence = event => {
    if (![base.year,target.year].includes(event.detail?.year)) return;
    evidenceCache.delete(dateKey(base));
    evidenceCache.delete(dateKey(target));
    if (mode==="dates" && root.dataset.ready==="true") render();
  };
  document.addEventListener(RESEARCH_SEASONAL_EVIDENCE_READY_EVENT,refreshYearEvidence);
  document.addEventListener(RESEARCH_SEASONAL_EVIDENCE_ERROR_EVENT,refreshYearEvidence);
  annualButton.addEventListener("click",() => setMode("annual"));
  datesButton.addEventListener("click",() => {
    if (mode==="annual") {
      annualQuery = location.search;
      annualHash = location.hash;
    }
    setMode("dates");
  });
  setMode(freeFromLink ? "dates" : "annual",{updateUrl:false});
  if (linkError) {
    root.dataset.urlValid = "false";
    setError("分享網址日期不合法，已改用預設示範日期。");
  } else {
    root.dataset.urlValid = "true";
  }
}
