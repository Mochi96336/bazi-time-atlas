import {
  BERGER_MODEL,
  solarTermShapeResiduals
} from "./recurrence/berger-orbit.js";
import { monthBoundaryDisagreementExposureFromResiduals } from "./recurrence/month-boundary-risk.js";

const NS = "http://www.w3.org/2000/svg";
const CX = 600;
const CY = 820;
const FAN_START = -170;
const FAN_END = -10;
const BASELINE_RADIUS = 625;
const RESIDUAL_PIXELS = 50;

const svg = document.querySelector("#recurrence-wheel");
const instrument = document.querySelector("#recurrence-instrument");
const group = document.querySelector("#astronomy-residual-ring");
const termGrid = document.querySelector("#astronomy-term-grid");
let monthBoundaryPanel = null;

function polar(radius, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
}

function arcPath(radius, startDegrees, endDegrees) {
  const p1 = polar(radius, startDegrees);
  const p2 = polar(radius, endDegrees);
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
}

function svgEl(tag, attrs = {}, parent = group) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function setResidualHeadline(value) {
  setText("astronomy-legend-readout", value);
  setText("astronomy-max-residual", value);
}

function formatSignedHours(value) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.005) return "0.00 h";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} h`;
}

function baseYearFromInstrument() {
  const match = /^(\d{1,7})-/.exec(instrument?.dataset.baseDate ?? "");
  return match ? Number(match[1]) : null;
}

function currentDelta() {
  const value = Number(instrument?.dataset.deltaYears);
  return Number.isFinite(value) ? value : null;
}

function ensureMonthBoundaryPanel() {
  if (monthBoundaryPanel?.isConnected) return monthBoundaryPanel;
  if (!termGrid) return null;

  const panel = document.createElement("section");
  panel.id = "month-boundary-exposure";
  panel.className = "month-boundary-exposure";
  panel.setAttribute("aria-label", "十二節位移對八字月界與年界判定的潛在分歧窗口");
  panel.innerHTML = `
    <div class="month-boundary-copy">
      <div class="eyebrow">年／月柱邊界</div>
      <h3>交節窗口不只告訴你偏了多久，也能指出會差在哪一柱。</h3>
      <p>把春分固定成共同 0 點後，每個「節」從基準位置移到目標位置時會掃過一小段時間。只有出生相位落在這些區間內，兩個年份才會站在不同的月支 sector；11 個節只影響月柱，立春的 丑→寅 同時也是本站採用的年柱切換邊界。比例仍是幾何相位窗口，不是人口上的「八字錯誤率」。</p>
    </div>
    <div class="month-boundary-stat">
      <span>窗口聯集</span>
      <strong id="month-boundary-exposure-hours">—</strong>
      <small id="month-boundary-exposure-percent">—</small>
    </div>
    <div class="month-boundary-stat">
      <span>最大單一邊界</span>
      <strong id="month-boundary-largest">—</strong>
      <small id="month-boundary-overlap">—</small>
    </div>
    <div id="boundary-shift-diagram" class="boundary-shift-diagram" aria-label="基準與目標交節邊界錯開示意">
      <div class="boundary-shift-key">
        <span>邊界錯開示意</span>
        <strong>兩條邊界之間＝分歧窗口</strong>
      </div>
      <div id="boundary-shift-rows" class="boundary-shift-rows"></div>
    </div>
    <div class="pillar-impact-strip" aria-label="分歧窗口依受影響柱位分解">
      <div class="pillar-impact-item month-only">
        <span>僅月柱 · 11 節</span>
        <strong id="pillar-impact-month-only-hours">—</strong>
        <small id="pillar-impact-month-only-percent">—</small>
      </div>
      <div class="pillar-impact-item year-month">
        <span>年柱＋月柱 · 立春</span>
        <strong id="pillar-impact-year-month-hours">—</strong>
        <small id="pillar-impact-year-month-percent">—</small>
      </div>
    </div>
    <div id="full-pillar-attribution-note" class="full-pillar-attribution" aria-live="polite">—</div>
    <div id="month-boundary-window-grid" class="month-boundary-window-grid" aria-label="十二個交節分歧窗口、月支跨界與完整干支狀態"></div>
  `;
  termGrid.insertAdjacentElement("afterend", panel);
  monthBoundaryPanel = panel;
  return panel;
}

function windowTitle(window) {
  const impact = window.isYearBoundary ? "年柱＋月柱" : "月柱";
  if (window.direction === "aligned") {
    return `${window.name} · ${window.monthTransition} · ${impact} · 基準與目標邊界重合`;
  }
  const base = window.baseWindowPillars;
  const target = window.targetWindowPillars;
  const yearSide = window.isYearBoundary
    ? ` · 年界：基準=${window.baseYearSide === "new" ? "新年柱" : "前一年柱"}，目標=${window.targetYearSide === "new" ? "新年柱" : "前一年柱"}`
    : "";
  const ganzhi = base && target
    ? ` · 完整柱：基準 ${base.yearPillar}/${base.monthPillar}；目標 ${target.yearPillar}/${target.monthPillar}`
    : "";
  const attribution = window.pureBoundaryAttribution ? " · 年序閉合，可作純交節歸因" : " · 年序未閉合，完整柱另含背景年序偏移";
  return `${window.name} · ${window.monthTransition} · ${impact} · 窗口內基準=${window.baseWindowBranch}月、目標=${window.targetWindowBranch}月${yearSide}${ganzhi}${attribution}`;
}

function fullPillarMarkup(window, yearSequenceAligned) {
  if (window.direction === "aligned") return `<em class="window-ganzhi aligned">邊界重合</em>`;
  if (!yearSequenceAligned) return `<em class="window-ganzhi mixed">年序未閉合</em>`;
  const base = window.baseWindowPillars;
  const target = window.targetWindowPillars;
  if (!base || !target) return `<em class="window-ganzhi mixed">—</em>`;

  if (window.isYearBoundary) {
    return `<em class="window-ganzhi year-month-ganzhi"><span>${base.yearPillar}·${base.monthPillar}</span><b>↔</b><span>${target.yearPillar}·${target.monthPillar}</span></em>`;
  }
  return `<em class="window-ganzhi"><span>${base.monthPillar}</span><b>↔</b><span>${target.monthPillar}</span></em>`;
}

function makeBoundaryShiftRow(window, scaleHours, { role, label, meta } = {}) {
  if (!window) return null;
  const row = document.createElement("div");
  row.className = `boundary-shift-row ${window.direction}`;
  row.dataset.boundaryShiftRole = role ?? "featured";
  row.dataset.boundaryShiftTerm = window.name;
  row.dataset.boundaryShiftLiChun = String(window.isYearBoundary);
  row.dataset.boundaryShiftWindowHours = window.widthHours.toFixed(6);
  row.dataset.boundaryShiftDirection = window.direction;

  const gap = scaleHours > 1e-9
    ? Math.max(0, Math.min(42, window.widthHours / scaleHours * 42))
    : 0;
  const left = 50 - gap / 2;
  const right = 50 + gap / 2;
  const base = window.direction === "target-earlier" ? right : left;
  const target = window.direction === "target-earlier" ? left : right;
  row.style.setProperty("--boundary-window-left", `${left.toFixed(3)}%`);
  row.style.setProperty("--boundary-window-width", `${gap.toFixed(3)}%`);
  row.style.setProperty("--boundary-base-pos", `${base.toFixed(3)}%`);
  row.style.setProperty("--boundary-target-pos", `${target.toFixed(3)}%`);

  const impact = window.isYearBoundary ? "年＋月柱" : "月柱";
  const rowLabel = label ?? window.name;
  const rowMeta = meta ?? `${window.widthHours.toFixed(2)} h · ${impact}`;
  row.setAttribute(
    "aria-label",
    `${rowLabel}：基準與目標交節邊界相差 ${window.widthHours.toFixed(2)} 小時；${window.direction === "aligned" ? "邊界重合" : `中間為${impact}可能不同的分歧窗口`}`
  );
  row.innerHTML = `
    <div class="boundary-shift-row-head"><span>${rowLabel}</span><strong>${rowMeta}</strong></div>
    <div class="boundary-shift-plot" aria-hidden="true">
      <div class="boundary-shift-lane"><span>基準</span><i><em class="boundary-shift-window"></em><b class="boundary-shift-base"></b></i></div>
      <div class="boundary-shift-lane"><span>目標</span><i><em class="boundary-shift-window"></em><b class="boundary-shift-target"></b></i></div>
    </div>
  `;
  return row;
}

function renderBoundaryShiftDiagram(panel, exposure) {
  const diagram = panel?.querySelector("#boundary-shift-diagram");
  const rows = panel?.querySelector("#boundary-shift-rows");
  if (!diagram || !rows) return;

  diagram.hidden = false;
  rows.replaceChildren();

  const liChun = exposure.yearMonthWindow;
  if (exposure.closed) {
    const identity = liChun ?? exposure.largestWindow;
    const row = makeBoundaryShiftRow(identity, 1, {
      role:"identity",
      label:"十二節",
      meta:"0.00 h · 邊界重合"
    });
    if (row) rows.appendChild(row);
    return;
  }

  const largest = exposure.largestWindow;
  const scaleHours = Math.max(largest?.widthHours ?? 0, liChun?.widthHours ?? 0, 1e-9);
  if (largest) {
    const sameAsLiChun = Boolean(liChun && largest.name === liChun.name);
    const row = makeBoundaryShiftRow(largest, scaleHours, {
      role:sameAsLiChun ? "largest-li-chun" : "largest",
      label:sameAsLiChun ? `最大 · ${largest.name} · 立春年界` : `最大 · ${largest.name}`
    });
    if (row) rows.appendChild(row);
  }
  if (liChun && (!largest || liChun.name !== largest.name)) {
    const row = makeBoundaryShiftRow(liChun, scaleHours, {
      role:"li-chun",
      label:"立春年界"
    });
    if (row) rows.appendChild(row);
  }
}

function renderMonthBoundaryExposure(result) {
  const panel = ensureMonthBoundaryPanel();
  if (!panel) return;
  const exposure = monthBoundaryDisagreementExposureFromResiduals(result);
  const grid = panel.querySelector("#month-boundary-window-grid");
  const maxWindow = Math.max(...exposure.windows.map(window => window.widthHours), 1e-9);
  const liChunWindow = exposure.yearMonthWindow;
  renderBoundaryShiftDiagram(panel, exposure);

  setText("month-boundary-exposure-hours", `${exposure.unionExposureHours.toFixed(2)} h`);
  setText("month-boundary-exposure-percent", `相位窗口 ${exposure.yearPercent.toFixed(3)}% · 非人口機率`);
  setText(
    "month-boundary-largest",
    exposure.largestWindow ? `${exposure.largestWindow.name} · ${exposure.largestWindow.widthHours.toFixed(2)} h` : "0.00 h"
  );
  setText(
    "month-boundary-overlap",
    exposure.overlapHours > 0.005
      ? `窗口重疊 ${exposure.overlapHours.toFixed(2)} h；聯集已去重。`
      : `${exposure.mergedWindows.length} 個不重疊窗口`
  );
  setText("pillar-impact-month-only-hours", `${exposure.monthOnlyExposureHours.toFixed(2)} h`);
  setText("pillar-impact-month-only-percent", `相位窗口 ${exposure.monthOnlyPercent.toFixed(3)}%`);
  setText("pillar-impact-year-month-hours", `${exposure.yearMonthExposureHours.toFixed(2)} h`);
  setText("pillar-impact-year-month-percent", `相位窗口 ${exposure.yearMonthPercent.toFixed(3)}%`);
  setText(
    "full-pillar-attribution-note",
    exposure.yearSequenceAligned
      ? "年序已閉合：下方完整干支固定為「左＝基準、右＝目標」，差異可隔離為交節邊界移動的結果。"
      : "年序未閉合：月支窗口仍有效，但完整年／月干支另含 60 年年序背景偏移，因此不作純交節歸因。"
  );
  panel.classList.toggle("year-sequence-misaligned", !exposure.yearSequenceAligned);

  grid?.replaceChildren();
  exposure.windows.forEach(window => {
    const item = document.createElement("div");
    item.className = `month-boundary-window ${window.direction}${window.isYearBoundary ? " year-boundary" : ""}`;
    item.dataset.term = window.name;
    item.dataset.windowHours = window.widthHours.toFixed(6);
    item.dataset.beforeBranch = window.beforeBranch;
    item.dataset.afterBranch = window.afterBranch;
    item.dataset.pillarImpact = window.pillarImpact;
    item.dataset.pureBoundaryAttribution = String(window.pureBoundaryAttribution);
    if (window.baseWindowBranch) item.dataset.baseWindowBranch = window.baseWindowBranch;
    if (window.targetWindowBranch) item.dataset.targetWindowBranch = window.targetWindowBranch;
    if (window.baseWindowPillars) {
      item.dataset.baseYearPillar = window.baseWindowPillars.yearPillar;
      item.dataset.baseMonthPillar = window.baseWindowPillars.monthPillar;
      item.dataset.baseActiveYearLabel = String(window.baseWindowPillars.activeYearLabel);
    }
    if (window.targetWindowPillars) {
      item.dataset.targetYearPillar = window.targetWindowPillars.yearPillar;
      item.dataset.targetMonthPillar = window.targetWindowPillars.monthPillar;
      item.dataset.targetActiveYearLabel = String(window.targetWindowPillars.activeYearLabel);
    }
    item.title = windowTitle(window);
    item.style.setProperty("--window-width", `${Math.max(0, window.widthHours / maxWindow * 100).toFixed(3)}%`);
    item.innerHTML = `
      <span>${window.name}${window.isYearBoundary ? " · 年界" : ""}</span>
      <i aria-hidden="true"><b></b></i>
      <strong>${window.widthHours.toFixed(2)} h</strong>
      <small>${window.monthTransition} · ${window.isYearBoundary ? "年＋月" : "月"}</small>
      ${fullPillarMarkup(window, exposure.yearSequenceAligned)}
    `;
    grid?.appendChild(item);
  });

  instrument.dataset.monthBoundaryExposureValidity = "within-range";
  instrument.dataset.monthBoundaryExposureHours = exposure.unionExposureHours.toFixed(6);
  instrument.dataset.monthBoundaryExposurePercent = exposure.yearPercent.toFixed(6);
  instrument.dataset.monthBoundaryRawSweepHours = exposure.rawSweepHours.toFixed(6);
  instrument.dataset.monthBoundaryOverlapHours = exposure.overlapHours.toFixed(6);
  instrument.dataset.monthBoundaryWindowCount = String(exposure.windows.length);
  instrument.dataset.monthBoundaryMergedWindowCount = String(exposure.mergedWindows.length);
  instrument.dataset.monthBoundaryLargestTerm = exposure.largestWindow?.name ?? "none";
  instrument.dataset.monthBoundaryLargestWindowHours = (exposure.largestWindow?.widthHours ?? 0).toFixed(6);
  instrument.dataset.monthOnlyExposureHours = exposure.monthOnlyExposureHours.toFixed(6);
  instrument.dataset.monthOnlyExposurePercent = exposure.monthOnlyPercent.toFixed(6);
  instrument.dataset.yearMonthExposureHours = exposure.yearMonthExposureHours.toFixed(6);
  instrument.dataset.yearMonthExposurePercent = exposure.yearMonthPercent.toFixed(6);
  instrument.dataset.yearSequenceAligned = String(exposure.yearSequenceAligned);
  instrument.dataset.fullPillarAttribution = exposure.fullPillarAttribution;
  instrument.dataset.yearBoundaryLiChunWindowHours = (liChunWindow?.widthHours ?? 0).toFixed(6);
  instrument.dataset.yearBoundaryLiChunBeforeBranch = liChunWindow?.beforeBranch ?? "none";
  instrument.dataset.yearBoundaryLiChunAfterBranch = liChunWindow?.afterBranch ?? "none";
  instrument.dataset.yearBoundaryLiChunBaseMonthBranch = liChunWindow?.baseWindowBranch ?? "aligned";
  instrument.dataset.yearBoundaryLiChunTargetMonthBranch = liChunWindow?.targetWindowBranch ?? "aligned";
  instrument.dataset.yearBoundaryLiChunBaseYearPillar = liChunWindow?.baseWindowPillars?.yearPillar ?? "aligned";
  instrument.dataset.yearBoundaryLiChunTargetYearPillar = liChunWindow?.targetWindowPillars?.yearPillar ?? "aligned";
  instrument.dataset.yearBoundaryLiChunBaseMonthPillar = liChunWindow?.baseWindowPillars?.monthPillar ?? "aligned";
  instrument.dataset.yearBoundaryLiChunTargetMonthPillar = liChunWindow?.targetWindowPillars?.monthPillar ?? "aligned";
  instrument.dataset.monthBoundaryClosed = String(exposure.closed);
}

function renderMonthBoundaryUnavailable() {
  const panel = ensureMonthBoundaryPanel();
  panel?.querySelector("#month-boundary-window-grid")?.replaceChildren();
  panel?.querySelector("#boundary-shift-rows")?.replaceChildren();
  const boundaryDiagram = panel?.querySelector("#boundary-shift-diagram");
  if (boundaryDiagram) boundaryDiagram.hidden = true;
  panel?.classList.remove("year-sequence-misaligned");
  setText("month-boundary-exposure-hours", "模型不可用");
  setText("month-boundary-exposure-percent", "—");
  setText("month-boundary-largest", "—");
  setText("month-boundary-overlap", "—");
  setText("pillar-impact-month-only-hours", "—");
  setText("pillar-impact-month-only-percent", "—");
  setText("pillar-impact-year-month-hours", "—");
  setText("pillar-impact-year-month-percent", "—");
  setText("full-pillar-attribution-note", "—");
  instrument.dataset.monthBoundaryExposureValidity = "outside-range";
  delete instrument.dataset.monthBoundaryExposureHours;
  delete instrument.dataset.monthBoundaryExposurePercent;
  delete instrument.dataset.monthBoundaryRawSweepHours;
  delete instrument.dataset.monthBoundaryOverlapHours;
  delete instrument.dataset.monthBoundaryWindowCount;
  delete instrument.dataset.monthBoundaryMergedWindowCount;
  delete instrument.dataset.monthBoundaryLargestTerm;
  delete instrument.dataset.monthBoundaryLargestWindowHours;
  delete instrument.dataset.monthOnlyExposureHours;
  delete instrument.dataset.monthOnlyExposurePercent;
  delete instrument.dataset.yearMonthExposureHours;
  delete instrument.dataset.yearMonthExposurePercent;
  delete instrument.dataset.yearSequenceAligned;
  delete instrument.dataset.fullPillarAttribution;
  delete instrument.dataset.yearBoundaryLiChunWindowHours;
  delete instrument.dataset.yearBoundaryLiChunBeforeBranch;
  delete instrument.dataset.yearBoundaryLiChunAfterBranch;
  delete instrument.dataset.yearBoundaryLiChunBaseMonthBranch;
  delete instrument.dataset.yearBoundaryLiChunTargetMonthBranch;
  delete instrument.dataset.yearBoundaryLiChunBaseYearPillar;
  delete instrument.dataset.yearBoundaryLiChunTargetYearPillar;
  delete instrument.dataset.yearBoundaryLiChunBaseMonthPillar;
  delete instrument.dataset.yearBoundaryLiChunTargetMonthPillar;
  delete instrument.dataset.monthBoundaryClosed;
}

function renderUnavailable(message) {
  group.replaceChildren();
  termGrid?.replaceChildren();
  renderMonthBoundaryUnavailable();
  setResidualHeadline("模型不可用");
  setText("astronomy-rms-residual", "—");
  setText("astronomy-orbit-readout", message);
  setText("astronomy-scale-readout", "—");
  instrument.dataset.astronomyModel = BERGER_MODEL.id;
  instrument.dataset.astronomyValidity = "outside-range";
  instrument.dataset.astronomyShapeClosed = "false";
  delete instrument.dataset.astronomyMaxResidualHours;
  delete instrument.dataset.astronomyRmsResidualHours;
  delete instrument.dataset.astronomyMinResidualHours;
  delete instrument.dataset.astronomyMaxSignedResidualHours;
  delete instrument.dataset.astronomyTermCount;
}

function renderTermGrid(result) {
  if (!termGrid) return;
  termGrid.replaceChildren();
  result.terms.forEach(term => {
    const item = document.createElement("div");
    item.className = `astronomy-term-cell ${term.residualHours >= 0 ? "positive" : "negative"}`;
    item.innerHTML = `<span>${term.name}</span><strong>${formatSignedHours(term.residualHours)}</strong>`;
    termGrid.appendChild(item);
  });
}

function renderResidualRing(result) {
  group.replaceChildren();
  svgEl("path", {
    d: arcPath(BASELINE_RADIUS, FAN_START + 5, FAN_END - 5),
    class: "astronomy-baseline"
  });

  const scaleHours = Math.max(24, Math.ceil(result.maxAbsHours / 24) * 24);
  const firstAngle = FAN_START + 12;
  const lastAngle = FAN_END - 12;
  const step = (lastAngle - firstAngle) / (result.terms.length - 1);

  result.terms.forEach((term, index) => {
    const angle = firstAngle + index * step;
    const normalized = Math.max(-1, Math.min(1, term.residualHours / scaleHours));
    const targetRadius = BASELINE_RADIUS + normalized * RESIDUAL_PIXELS;
    const basePoint = polar(BASELINE_RADIUS, angle);
    const targetPoint = polar(targetRadius, angle);

    svgEl("line", {
      x1: basePoint.x,
      y1: basePoint.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
      class: `astronomy-residual-whisker ${term.residualHours >= 0 ? "positive" : "negative"}`,
      "data-astro-term": term.name,
      "data-residual-hours": term.residualHours.toFixed(6)
    });
    svgEl("circle", {
      cx: basePoint.x,
      cy: basePoint.y,
      r: 2.8,
      class: "astronomy-base-dot"
    });
    svgEl("circle", {
      cx: targetPoint.x,
      cy: targetPoint.y,
      r: 4.2,
      class: `astronomy-target-dot ${term.residualHours >= 0 ? "positive" : "negative"}`
    });

    const labelPoint = polar(690, angle);
    const label = svgEl("text", {
      x: labelPoint.x,
      y: labelPoint.y,
      class: `astronomy-term-label${index % 2 ? " minor" : ""}`,
      transform: `rotate(${angle + 90} ${labelPoint.x} ${labelPoint.y})`
    });
    label.textContent = term.name;
  });

  const extensionInner = polar(575, -90);
  const extensionOuter = polar(690, -90);
  svgEl("line", {
    x1: extensionInner.x,
    y1: extensionInner.y,
    x2: extensionOuter.x,
    y2: extensionOuter.y,
    class: "astronomy-reference-extension"
  });

  setText("astronomy-scale-readout", `外圈徑向尺：±${scaleHours} h`);
}

function renderResult(result) {
  renderResidualRing(result);
  renderTermGrid(result);
  renderMonthBoundaryExposure(result);

  setResidualHeadline(`${result.maxAbsHours.toFixed(2)} h`);
  setText("astronomy-rms-residual", `${result.rmsHours.toFixed(2)} h`);
  setText(
    "astronomy-orbit-readout",
    `e ${result.baseParameters.eccentricity.toFixed(5)} → ${result.targetParameters.eccentricity.toFixed(5)} · 近日點 ${result.baseParameters.perihelionLongitudeDegrees.toFixed(1)}° → ${result.targetParameters.perihelionLongitudeDegrees.toFixed(1)}°`
  );

  instrument.dataset.astronomyModel = result.model.id;
  instrument.dataset.astronomyValidity = "within-range";
  instrument.dataset.astronomyBaseYear = String(result.baseYear);
  instrument.dataset.astronomyTargetYear = String(result.targetYear);
  instrument.dataset.astronomyMaxResidualHours = result.maxAbsHours.toFixed(6);
  instrument.dataset.astronomyRmsResidualHours = result.rmsHours.toFixed(6);
  instrument.dataset.astronomyMinResidualHours = result.minHours.toFixed(6);
  instrument.dataset.astronomyMaxSignedResidualHours = result.maxHours.toFixed(6);
  instrument.dataset.astronomyShapeClosed = String(result.closed);
  instrument.dataset.astronomyTermCount = String(result.terms.length);
}

function refresh() {
  const baseYear = baseYearFromInstrument();
  const delta = currentDelta();
  if (!Number.isFinite(baseYear) || !Number.isFinite(delta)) return;

  try {
    renderResult(solarTermShapeResiduals(baseYear, baseYear + delta));
  } catch (error) {
    renderUnavailable(error instanceof Error ? error.message : String(error));
  }
}

if (svg && instrument && group) {
  new MutationObserver(refresh).observe(instrument, {
    attributes: true,
    attributeFilter: ["data-base-date", "data-delta-years"]
  });
  queueMicrotask(refresh);
}
