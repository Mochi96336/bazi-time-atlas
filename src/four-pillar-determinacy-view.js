import { fourPillarDeterminacy } from "./recurrence/four-pillar-determinacy.js";

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
  const deltaYears = Number(instrument.dataset.deltaYears);
  const discreteYearClosed = boolDataset("yearClosed");
  const discreteDayClosed = boolDataset("dayClosed");
  const astronomyValidity = instrument.dataset.astronomyValidity;

  if (!Number.isInteger(deltaYears) || discreteYearClosed === null || discreteDayClosed === null || !astronomyValidity) {
    renderPending();
    return;
  }

  const result = fourPillarDeterminacy({
    deltaYears,
    yearSequenceAligned: deltaYears % 60 === 0,
    discreteYearClosed,
    discreteDayClosed,
    astronomyWithinRange: astronomyValidity === "within-range"
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

  setText(
    "determinacy-scope-value",
    result.identity
      ? "同一比較狀態 · 4 / 4 相同"
      : resolvedCount === 2
        ? "Year + Month 可隔離 · Day + Hour 未解"
        : resolvedCount === 0
          ? "沒有完整四柱可作純交界歸因"
          : `${resolvedCount} / 4 柱可由此層解析`
  );
  setText(
    "determinacy-footnote",
    result.identity
      ? "Δ=0 是同一狀態，因此四柱相同是定義上的 identity，不是深時間模型推導。"
      : `比較框架＝春分共同歸零的季節內形狀。絕對民用日相位：未保留；地方時：未建模；ΔT：未建模。${discreteDayClosed ? " 即使內圈日序顯示 0/60，也不能把它直接升格成此交節窗口內的日柱結論。" : ""}`
  );
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
      "data-year-closed",
      "data-day-closed",
      "data-astronomy-validity"
    ]
  });
  scheduleRefresh();
}
