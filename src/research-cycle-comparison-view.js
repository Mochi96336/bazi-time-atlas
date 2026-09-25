import { researchGanzhiCycleComparison } from "./recurrence/ganzhi-cycle-comparison.js";
import { researchYearStripState } from "./research-year-strip-view.js";
import { validateGregorianDate } from "./recurrence/gregorian-cycle.js";
import { RESEARCH_SEASONAL_EVIDENCE_READY_EVENT } from "./recurrence/research-seasonal-chunk-prefetch.js";

const panel = typeof document === "undefined" ? null : document.querySelector("#research-cycle-comparison");
const instrument = typeof document === "undefined" ? null : document.querySelector("#recurrence-instrument");

function parseDate(value) {
  const match = /^([0-9]{1,8})-([0-9]{2})-([0-9]{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = {year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
  return validateGregorianDate(date) ? date : null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function displayDate(date) {
  return date
    ? `${date.year}/${String(date.month).padStart(2,"0")}/${String(date.day).padStart(2,"0")}`
    : "目標日期不存在";
}

function renderTape(id, baseIndex, targetIndex, label) {
  const tape = document.getElementById(id);
  if (!tape) return;
  if (tape.childElementCount !== 60) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 60; i++) {
      const tick = document.createElement("span");
      tick.setAttribute("aria-hidden","true");
      fragment.appendChild(tick);
    }
    tape.replaceChildren(fragment);
  }
  tape.dataset.positions = "60";
  tape.dataset.baseIndex = baseIndex === null ? "unavailable" : String(baseIndex);
  tape.dataset.targetIndex = targetIndex === null ? "unavailable" : String(targetIndex);
  tape.setAttribute(
    "aria-label",
    `${label}：基準${baseIndex === null ? "待判" : `第 ${baseIndex + 1} 位`}；比較${targetIndex === null ? "待判或日期無效" : `第 ${targetIndex + 1} 位`}${baseIndex !== null && targetIndex === baseIndex ? "，兩者重合" : ""}`
  );
  [...tape.children].forEach((tick,index) => {
    const base = baseIndex !== null && index === baseIndex;
    const target = targetIndex !== null && index === targetIndex;
    tick.dataset.base = String(base);
    tick.dataset.target = String(target);
    tick.dataset.both = String(base && target);
  });
}

function visibleYear(date, nominal) {
  let state;
  try { state = researchYearStripState(date); } catch {
    return { name:nominal.name,cycleIndex:nominal.cycleIndex,positionBasis:"nominal",
      note:"僅名義立春後年標 · 年界資料不可用" };
  }
  const before = state.liChunTransition.before.name;
  const after = state.liChunTransition.after.name;
  if (state.selectedYearPillar) {
    const status = state.selectedYearMembership.status;
    return {
      name:state.selectedYearPillar.name,
      cycleIndex:state.selectedYearPillar.cycleIndex,
      positionBasis:"active",
      note:status === "exact" ? "已判定年柱"
        : status === "model-estimated" ? "年界模型估計" : "年界待驗"
    };
  }
  if (["boundary-day","boundary-uncertain"].includes(state.selectedCivilLiChunRelation)) {
    return {name:`${before}／${after}`,cycleIndex:null,positionBasis:"unresolved",note:"立春界日／區間待判"};
  }
  return {name:nominal.name,cycleIndex:nominal.cycleIndex,positionBasis:"nominal",
    note:"僅名義立春後年標 · 當日待判"};
}

function render() {
  if (!panel || !instrument) return;
  const baseDate = parseDate(instrument.dataset.baseDate);
  const deltaYears = Number(instrument.dataset.deltaYears);
  if (!baseDate || !Number.isSafeInteger(deltaYears) || deltaYears < 0) {
    panel.dataset.ready = "false";
    return;
  }

  let model;
  try {
    model = researchGanzhiCycleComparison(baseDate,deltaYears);
  } catch {
    panel.dataset.ready = "false";
    return;
  }

  panel.dataset.ready = "true";
  panel.dataset.baseDate = instrument.dataset.baseDate;
  panel.dataset.targetDate = instrument.dataset.targetDate;
  panel.dataset.yearPhase = String(model.yearPhase);
  panel.dataset.dayPhase = model.dayPhase === null ? "invalid" : String(model.dayPhase);
  panel.dataset.baseYearNominal = model.base.year.name;
  panel.dataset.targetYearNominal = model.target?.year.name ?? "invalid";
  panel.dataset.baseDayPillar = model.base.day.name;
  panel.dataset.targetDayPillar = model.target?.day.name ?? "invalid";
  panel.dataset.dayAnchorConvention = model.dayConvention;

  const baseYear = visibleYear(model.base.date,model.base.year);
  const targetYear = model.target ? visibleYear(model.target.date,model.target.year) : null;
  renderTape("research-cycles-year-tape",baseYear.cycleIndex,targetYear?.cycleIndex ?? null,"干支年位置");
  renderTape("research-cycles-day-tape",model.base.day.index,model.target?.day.index ?? null,"60 日序");
  panel.dataset.baseYearDisplayed = baseYear.name;
  panel.dataset.targetYearDisplayed = targetYear?.name ?? "unavailable";
  panel.dataset.yearTapeBasis = baseYear.positionBasis === "active" && targetYear?.positionBasis === "active"
    ? "active-year-pillars" : "nominal-or-unresolved";
  const activeYearPhase = baseYear.positionBasis === "active" && targetYear?.positionBasis === "active"
    ? ((targetYear.cycleIndex - baseYear.cycleIndex) % 60 + 60) % 60 : null;
  setText("research-cycles-year-tape-basis",
    activeYearPhase !== null && activeYearPhase !== model.yearPhase
      ? "刻度＝實際年柱位置；與下方名義年序相位不同"
      : panel.dataset.yearTapeBasis === "active-year-pillars"
        ? "刻度＝實際年柱位置" : "刻度＝可判年柱，資料不足處僅顯示名義年標");
  setText("research-cycles-base-date",displayDate(model.base.date));
  setText("research-cycles-target-date",displayDate(model.target?.date));
  setText("research-cycles-year-base",baseYear.name);
  setText("research-cycles-year-target",targetYear?.name ?? "—");
  setText("research-cycles-year-base-note",baseYear.note);
  setText("research-cycles-year-target-note",targetYear?.note ?? "公曆日期不存在");
  setText("research-cycles-day-base",model.base.day.name);
  setText("research-cycles-day-target",model.target?.day.name ?? "—");
  setText("research-cycles-day-base-ordinal",`${model.base.day.ordinal} / 60`);
  setText("research-cycles-day-target-ordinal",model.target ? `${model.target.day.ordinal} / 60` : "—");
  setText("research-cycles-year-phase",`${model.yearPhase} / 60`);
  setText("research-cycles-day-phase",model.dayPhase === null ? "—" : `${model.dayPhase} / 60`);
  setText(
    "research-cycles-day-elapsed",
    model.actualDaysElapsed === null ? "此目標日期不存在"
      : `實際經過 ${model.actualDaysElapsed.toLocaleString("en-US")} 日`
  );
  setText(
    "research-cycles-closure",
    !model.target ? "目標日期不存在，不能比較干支日"
      : model.yearPhaseClosed && model.dayPhaseClosed
        ? "60 年序與 60 日序同時回到基準位置（離散閉合）"
        : model.yearPhaseClosed ? "60 年序歸零，60 日序尚未歸零"
          : model.dayPhaseClosed ? "60 日序歸零，60 年序尚未歸零"
            : "兩組週期仍處於不同相位"
  );
}

if (panel && instrument) {
  const observer = new MutationObserver(records => {
    if (records.some(record => ["data-base-date","data-target-date","data-delta-years"].includes(record.attributeName))) render();
  });
  observer.observe(instrument,{
    attributes:true,
    attributeFilter:["data-base-date","data-target-date","data-delta-years"]
  });
  // New research-only binary evidence can refine active Year identity without
  // modifying the nominal 60-year sequence or 60-day arithmetic.
  document.addEventListener(RESEARCH_SEASONAL_EVIDENCE_READY_EVENT,render);
  render();
}
