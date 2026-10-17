import { fourPillarDeterminacy } from "./recurrence/four-pillar-determinacy.js";
import {
  RESEARCH_TIME_SELECTION_EVENT,
  researchSeasonalTimeState
} from "./research/research-time-state.js";
import "./day-hour-proof-chain-view.js";
import "./research-evidence-drilldown-view.js";
import "./research-astronomy-drilldown-view.js";
import "./research-discrete-density-view.js";
import "./eot-observed-clearance-diagnostic-view.js";

const instrument = document.querySelector("#recurrence-instrument");
const panel = document.querySelector("#four-pillar-determinacy");
const seasonalRoot = document.querySelector("#seasonal-drift-evidence");

const LABELS = Object.freeze({
  year:{ zh:"年柱", en:"Year" },
  month:{ zh:"月柱", en:"Month" },
  day:{ zh:"日柱", en:"Day" },
  hour:{ zh:"時柱", en:"Hour" }
});

const STATUS_LABELS = Object.freeze({
  "research-resolved":"可回到同柱",
  "resolved":"已解析",
  "unresolved":"未定",
  "identical-by-definition":"同一狀態",
  "boundary-resolved":"交界可判定",
  "mixed-with-year-sequence":"混入年序偏移",
  "branch-resolved-stem-mixed":"月支可判 · 月干混合",
  "astronomy-unavailable":"天文模型外",
  "not-resolved-by-shape-model":"未能判定"
});

let currentSeasonalState=null;

function boolDataset(name) {
  const value = instrument?.dataset?.[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function absoluteReferencePrimary() {
  return instrument?.dataset.absoluteBoundaryConsequence === "year-26026-research" &&
    instrument?.dataset.absoluteBoundaryReferenceJie === "displaced";
}

function renderPending() {
  if (!panel) return;
  panel.dataset.ready = "false";
  setText("determinacy-scope-value", "等待研究時間狀態");
  setText("determinacy-footnote", "—");
}

function renderCard(name,{ pillarName=null, status, reason, resolved=false }) {
  const card = panel?.querySelector(`[data-determinacy-pillar="${name}"]`);
  if (!card) return;

  card.dataset.status = status;
  card.dataset.resolved = String(resolved);
  card.dataset.determinacyPureBoundaryAttribution = String(resolved && (name === "year" || name === "month"));

  const statusNode=card.querySelector(".determinacy-status");
  const summary=card.querySelector("p");
  const label=STATUS_LABELS[status] ?? status;
  if(statusNode) statusNode.textContent=pillarName ? `${pillarName} · ${label}` : label;
  if(summary) summary.textContent=reason;
}

function writeInstrumentStatus(states,resolvedCount){
  instrument.dataset.fourPillarYearStatus=states.year.status;
  instrument.dataset.fourPillarMonthStatus=states.month.status;
  instrument.dataset.fourPillarDayStatus=states.day.status;
  instrument.dataset.fourPillarHourStatus=states.hour.status;
  instrument.dataset.fourPillarResolvedCount=String(resolvedCount);
}

function renderSharedSeasonal(state){
  if(!panel||!instrument||!state?.target)return false;

  const target=state.target.pillars;
  const selected=state.selection;
  const states={};

  for(const name of Object.keys(LABELS)){
    const pillar=target[name];
    const resolved=pillar.status==="research-resolved"||pillar.status==="resolved";
    states[name]={ status:pillar.status, resolved };
    renderCard(name,{
      pillarName:pillar.name,
      status:pillar.status,
      reason:pillar.reason,
      resolved
    });
  }

  const resolvedCount=Object.values(states).filter(item=>item.resolved).length;
  const label=panel.querySelector(".determinacy-label");
  const scopeLabel=panel.querySelector(".determinacy-scope span");
  if(label)label.textContent="四柱可判範圍";
  if(scopeLabel)scopeLabel.textContent="固定 +24,000 · 同一太陽黃經";

  const selectionLabel=selected.termName
    ? `${selected.termName} · ${selected.longitudeDegrees}°`
    : `${selected.longitudeDegrees}° · ${selected.baziMonthBranch}月`;

  setText("determinacy-scope-value","年／月可回同柱 · 日／時未能判定");
  setText(
    "determinacy-footnote",
    `${selectionLabel}：這裡比較的是同一太陽黃經位置，所以年／月可由 60 年序與節界規則推出；但 02 已證明這個太陽位置的到達時刻，相對固定推進 24,000 個公曆年提前 ${Math.abs(state.comparison.driftDays).toFixed(3)} 天。日／時仍不能由帶不確定性的深時間 UT1／地方鐘面唯一決定。`
  );

  panel.dataset.ready="true";
  panel.dataset.mode="shared-seasonal";
  panel.dataset.argumentDeltaYears="24000";
  panel.dataset.explorerDeltaYears=instrument.dataset.deltaYears ?? "";
  panel.dataset.selectedLongitude=String(selected.longitudeDegrees);
  panel.dataset.resolvedPillarCount=String(resolvedCount);
  panel.dataset.yearStatus=states.year.status;
  panel.dataset.monthStatus=states.month.status;
  panel.dataset.dayStatus=states.day.status;
  panel.dataset.hourStatus=states.hour.status;

  writeInstrumentStatus(states,resolvedCount);
  instrument.dataset.fourPillarAbsoluteCivilPhasePreserved="false";
  instrument.dataset.fourPillarLocalClockModeled="false";
  return true;
}

function renderLegacy(){
  if (!instrument || !panel) return false;
  const deltaYears = Number(instrument.dataset.deltaYears);
  const yearSequenceClosed = boolDataset("yearSequenceClosed");
  const dayClosed = boolDataset("dayClosed");
  const astronomyValidity = instrument.dataset.astronomyValidity;

  if (!Number.isInteger(deltaYears) || yearSequenceClosed === null || dayClosed === null || !astronomyValidity) {
    renderPending();
    return false;
  }

  const result = fourPillarDeterminacy({
    deltaYears,
    yearSequenceAligned:deltaYears % 60 === 0,
    discreteYearSequenceClosed:yearSequenceClosed,
    discreteDayClosed:dayClosed,
    astronomyWithinRange:astronomyValidity === "within-range"
  });

  const states={};
  for(const name of Object.keys(LABELS)){
    const pillar=result.pillars[name];
    states[name]={status:pillar.status,resolved:pillar.resolved};
    renderCard(name,{
      status:pillar.status,
      reason:pillar.summary,
      resolved:pillar.resolved
    });
  }
  const resolvedCount=Object.values(states).filter(item=>item.resolved).length;
  writeInstrumentStatus(states,resolvedCount);

  panel.dataset.ready="true";
  panel.dataset.mode="legacy-explorer";
  panel.dataset.argumentDeltaYears=String(deltaYears);
  panel.dataset.resolvedPillarCount=String(resolvedCount);
  setText(
    "determinacy-scope-value",
    result.identity
      ? "同一比較狀態 · 4 / 4 相同"
      : resolvedCount === 2
        ? "年柱＋月柱可隔離 · 日柱＋時柱未解"
        : `${resolvedCount} / 4 柱可由此層解析`
  );
  setText(
    "determinacy-footnote",
    result.identity
      ? "Δ=0 是同一狀態，因此四柱相同是定義上的 identity。"
      : "一般 Δ 探索仍使用春分共同歸零後的季節形狀比較；完整固定 +24,000 結論請以上方主線為準。"
  );
  return true;
}

function stateFromSeasonalDom(){
  const longitude=Number(seasonalRoot?.dataset.selectedLongitude);
  if(!Number.isFinite(longitude))return null;
  try{
    return researchSeasonalTimeState(longitude);
  }catch{
    return null;
  }
}

function refresh(){
  if(!instrument||!panel)return;
  if(absoluteReferencePrimary()){
    currentSeasonalState=currentSeasonalState??stateFromSeasonalDom();
    if(currentSeasonalState&&renderSharedSeasonal(currentSeasonalState))return;
  }
  renderLegacy();
}

let queued=false;
function scheduleRefresh(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    refresh();
  });
}

if(instrument&&panel){
  document.addEventListener(RESEARCH_TIME_SELECTION_EVENT,event=>{
    if(event.detail?.owner!=="seasonal")return;
    try{
      currentSeasonalState=researchSeasonalTimeState(event.detail.longitudeDegrees);
    }catch{
      currentSeasonalState=null;
    }
    scheduleRefresh();
  });

  new MutationObserver(scheduleRefresh).observe(instrument,{
    attributes:true,
    attributeFilter:[
      "data-delta-years",
      "data-year-sequence-closed",
      "data-day-closed",
      "data-astronomy-validity",
      "data-absolute-boundary-consequence",
      "data-absolute-boundary-reference-jie"
    ]
  });

  if(seasonalRoot){
    new MutationObserver(()=>{
      currentSeasonalState=stateFromSeasonalDom();
      scheduleRefresh();
    }).observe(seasonalRoot,{
      attributes:true,
      attributeFilter:["data-selected-longitude"]
    });
  }

  currentSeasonalState=stateFromSeasonalDom();
  scheduleRefresh();
}