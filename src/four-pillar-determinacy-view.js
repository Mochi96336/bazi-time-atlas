import { fourPillarDeterminacy } from "./recurrence/four-pillar-determinacy.js";
import "./day-hour-proof-chain-view.js";
import "./research-evidence-drilldown-view.js";
import "./research-astronomy-drilldown-view.js";
import "./research-discrete-density-view.js";
import "./eot-observed-clearance-diagnostic-view.js";

const instrument = document.querySelector("#recurrence-instrument");
const panel = document.querySelector("#four-pillar-determinacy");

const LABELS = Object.freeze({
  year:{ zh:"年柱", en:"Year" },
  month:{ zh:"月柱", en:"Month" },
  day:{ zh:"日柱", en:"Day" },
  hour:{ zh:"時柱", en:"Hour" }
});

const STATUS_LABELS = Object.freeze({
  "identical-by-definition":"同一狀態",
  "boundary-resolved":"交界可判定",
  "mixed-with-year-sequence":"混入年序偏移",
  "branch-resolved-stem-mixed":"月支可判 · 月干混合",
  "astronomy-unavailable":"天文模型外",
  "not-resolved-by-shape-model":"此模型不可判"
});

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

function ensureShapeOnlyDetails() {
  let details = panel?.querySelector(":scope > .shape-only-determinacy-details");
  if (details) return details;
  const grid = panel?.querySelector(":scope > .determinacy-grid");
  const foot = panel?.querySelector(":scope > .determinacy-foot");
  if (!panel || !grid || !foot) return null;

  details = document.createElement("details");
  details.className = "shape-only-determinacy-details";
  const summary = document.createElement("summary");
  summary.innerHTML = "<span>展開 shape-only 四柱卡片</span><strong>只看全年平均位移扣除後的年內 shape</strong>";
  grid.insertAdjacentElement("beforebegin", details);
  details.append(summary, grid, foot);
  return details;
}

function restoreShapeOnlyDetails() {
  const details = panel?.querySelector(":scope > .shape-only-determinacy-details");
  if (!details) return;
  const grid = details.querySelector(".determinacy-grid");
  const foot = details.querySelector(".determinacy-foot");
  if (grid) details.insertAdjacentElement("beforebegin", grid);
  if (foot) details.insertAdjacentElement("beforebegin", foot);
  details.remove();
}

function syncAbsolutePresentation() {
  if (!panel) return;
  const active = absoluteReferencePrimary();
  panel.classList.toggle("shape-only-secondary", active);
  panel.dataset.absolutePrimary = String(active);

  const label = panel.querySelector(".determinacy-label");
  const scopeLabel = panel.querySelector(".determinacy-scope span");
  if (label) label.textContent = active ? "shape-only 輔助判定" : "可判定範圍";
  if (scopeLabel) scopeLabel.textContent = active ? "春分歸零後的舊模型內結論" : "目前可支持的最強結論";

  let note = panel.querySelector(".determinacy-secondary-note");
  if (active) {
    if (!note) {
      note = document.createElement("div");
      note.className = "determinacy-secondary-note";
      panel.querySelector(".determinacy-head")?.insertAdjacentElement("afterend", note);
    }
    note.textContent = "這組卡片只保留「全年平均位移已扣除」後的 shape-only 歸因；+24,000 的 TT/Gregorian reference 節界結果以上方主結果為準。";
    ensureShapeOnlyDetails();
  } else {
    note?.remove();
    restoreShapeOnlyDetails();
  }
}

function renderPending() {
  if (!panel) return;
  panel.dataset.ready = "false";
  setText("determinacy-scope-value", "等待回歸／天文狀態");
  setText("determinacy-footnote", "—");
}

function renderPillar(name, pillar) {
  const card = panel?.querySelector(`[data-determinacy-pillar="${name}"]`);
  if (!card) return;
  card.dataset.status = pillar.status;
  card.dataset.resolved = String(pillar.resolved);
  card.dataset.determinacyPureBoundaryAttribution = String(pillar.pureBoundaryAttribution);
  if ("discretePhaseClosed" in pillar) {
    card.dataset.discretePhaseClosed = String(pillar.discretePhaseClosed);
  } else {
    delete card.dataset.discretePhaseClosed;
  }
  if ("discreteDayPhaseClosed" in pillar) {
    card.dataset.discreteDayPhaseClosed = String(pillar.discreteDayPhaseClosed);
  } else {
    delete card.dataset.discreteDayPhaseClosed;
  }
  card.querySelector(".determinacy-status").textContent = STATUS_LABELS[pillar.status] ?? pillar.status;
  card.querySelector("p").textContent = pillar.summary;
}

function refresh() {
  if (!instrument || !panel) return;
  const explorerDeltaYears = Number(instrument.dataset.deltaYears);
  const liveYearSequenceClosed = boolDataset("yearSequenceClosed");
  const liveDayClosed = boolDataset("dayClosed");
  const astronomyValidity = instrument.dataset.astronomyValidity;
  const absolutePrimary = absoluteReferencePrimary();

  if (!Number.isInteger(explorerDeltaYears) || liveYearSequenceClosed === null || liveDayClosed === null || !astronomyValidity) {
    renderPending();
    return;
  }

  // This panel belongs to the fixed +24,000-year argument whenever the
  // absolute Research evidence is published. The current Δ above is only an
  // explorer/sandbox and must not turn the main 03 conclusion back into Δ=0
  // identity.
  const deltaYears = absolutePrimary ? 24000 : explorerDeltaYears;
  const discreteYearSequenceClosed = absolutePrimary ? true : liveYearSequenceClosed;
  const discreteDayClosed = absolutePrimary ? true : liveDayClosed;
  const astronomyWithinRange = absolutePrimary ? true : astronomyValidity === "within-range";

  const result = fourPillarDeterminacy({
    deltaYears,
    yearSequenceAligned: deltaYears % 60 === 0,
    discreteYearSequenceClosed,
    discreteDayClosed,
    astronomyWithinRange
  });

  for (const name of Object.keys(LABELS)) renderPillar(name, result.pillars[name]);
  const resolvedCount = Object.values(result.pillars).filter(pillar => pillar.resolved).length;

  panel.dataset.ready = "true";
  panel.dataset.deltaYears = String(deltaYears);
  panel.dataset.identity = String(result.identity);
  panel.dataset.yearSequenceAligned = String(result.yearSequenceAligned);
  panel.dataset.comparisonFrame = result.comparisonFrame;
  panel.dataset.absoluteCivilPhasePreserved = String(result.absoluteCivilPhasePreserved);
  panel.dataset.localClockModeled = String(result.localClockModeled);
  panel.dataset.deltaTModeled = String(result.deltaTModeled);
  panel.dataset.resolvedPillarCount = String(resolvedCount);

  instrument.dataset.fourPillarYearStatus = result.pillars.year.status;
  instrument.dataset.fourPillarMonthStatus = result.pillars.month.status;
  instrument.dataset.fourPillarDayStatus = result.pillars.day.status;
  instrument.dataset.fourPillarHourStatus = result.pillars.hour.status;
  instrument.dataset.fourPillarResolvedCount = String(resolvedCount);
  instrument.dataset.fourPillarAbsoluteCivilPhasePreserved = String(result.absoluteCivilPhasePreserved);
  instrument.dataset.fourPillarLocalClockModeled = String(result.localClockModeled);

  panel.dataset.explorerDeltaYears = String(explorerDeltaYears);
  panel.dataset.argumentDeltaYears = String(deltaYears);
  setText(
    "determinacy-scope-value",
    result.identity
      ? "同一比較狀態 · 4 / 4 相同"
      : absolutePrimary
        ? "shape-only：年／月交界可隔離"
        : resolvedCount === 2
          ? "年柱＋月柱可隔離 · 日柱＋時柱未解"
          : resolvedCount === 0
            ? "沒有完整四柱可作純交界歸因"
            : `${resolvedCount} / 4 柱可由此層解析`
  );
  setText(
    "determinacy-footnote",
    result.identity
      ? "Δ=0 是同一狀態，因此四柱相同是定義上的 identity，不是深時間模型推導。"
      : `${absolutePrimary ? "此卡片已降為 shape-only 輔助證據；+24,000 的 TT/Gregorian reference 節界結果以上方主結果為準，不能直接升格成未來 civil-time 四柱。 " : ""}比較框架＝春分共同歸零的季節內形狀。絕對民用日相位：未保留；地方時：未建模；ΔT：未建模。${discreteDayClosed ? " 即使內圈日序顯示 0/60，也不能把它直接升格成此交節窗口內的日柱結論。" : ""}`
  );
  syncAbsolutePresentation();
}

let queued = false;
function scheduleRefresh() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    refresh();
  });
}

if (instrument && panel) {
  new MutationObserver(scheduleRefresh).observe(instrument, {
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
  scheduleRefresh();
}
