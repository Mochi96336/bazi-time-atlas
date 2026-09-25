import { compareResearchDates } from "./recurrence/research-date-pair.js";
import { shiftGregorianDate } from "./recurrence/gregorian-date-navigation.js";
import { validateGregorianDate } from "./recurrence/gregorian-cycle.js";
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
const searchOnEntry = new URL(location.href).searchParams;
const freeFromLink = searchOnEntry.get("mode") === "dates";
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

function render() {
  let comparison;
  try {
    comparison = compareResearchDates(base,target,{
      baseYearEvidence:seasonalEvidence(base),
      targetYearEvidence:seasonalEvidence(target)
    });
  } catch (error) {
    root.dataset.ready = "false";
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

function setMode(next,{updateUrl=true}={}) {
  mode = next;
  const dates = next === "dates";
  document.body.dataset.researchMode = next;
  root.hidden = !dates;
  annualSections.forEach(node => { if (node) node.hidden = dates; });
  annualButton.setAttribute("aria-pressed",String(!dates));
  datesButton.setAttribute("aria-pressed",String(dates));
  if (lede) lede.textContent = dates
    ? "自由選擇兩個日期，直接觀察干支年與干支日如何各自前進。"
    : annualLede;
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
