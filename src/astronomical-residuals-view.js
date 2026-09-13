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
      <div class="eyebrow">BaZi pillar-boundary exposure</div>
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
    <div class="pillar-impact-strip" aria-label="分歧窗口依受影響柱位分解">
      <div class="pillar-impact-item month-only">
        <span>Month only · 11 節</span>
        <strong id="pillar-impact-month-only-hours">—</strong>
        <small id="pillar-impact-month-only-percent">—</small>
      </div>
      <div class="pillar-impact-item year-month">
        <span>Year + Month · 立春</span>
        <strong id="pillar-impact-year-month-hours">—</strong>
        <small id="pillar-impact-year-month-percent">—</small>
      </div>
    </div>
    <div id="month-boundary-window-grid" class="month-boundary-window-grid" aria-label="十二個交節分歧窗口與月支跨界"></div>
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
  const yearSide = window.isYearBoundary
    ? ` · 年界：基準=${window.baseYearSide === "new" ? "新年柱" : "前一年柱"}，目標=${window.targetYearSide === "new" ? "新年柱" : "前一年柱"}`
    : "";
  return `${window.name} · ${window.monthTransition} · ${impact} · 窗口內基準=${window.baseWindowBranch}月、目標=${window.targetWindowBranch}月${yearSide}`;
}

function renderMonthBoundaryExposure(result) {
  const panel = ensureMonthBoundaryPanel();
  if (!panel) return;
  const exposure = monthBoundaryDisagreementExposureFromResiduals(result);
  const grid = panel.querySelector("#month-boundary-window-grid");
  const maxWindow = Math.max(...exposure.windows.map(window => window.widthHours), 1e-9);
  const liChunWindow = exposure.yearMonthWindow;

  setText("month-boundary-exposure-hours", `${exposure.unionExposureHours.toFixed(2)} h`);
  setText("month-boundary-exposure-percent", `${exposure.yearPercent.toFixed(3)}% of normalized year`);
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
  setText("pillar-impact-month-only-percent", `${exposure.monthOnlyPercent.toFixed(3)}% of normalized year`);
  setText("pillar-impact-year-month-hours", `${exposure.yearMonthExposureHours.toFixed(2)} h`);
  setText("pillar-impact-year-month-percent", `${exposure.yearMonthPercent.toFixed(3)}% of normalized year`);

  grid?.replaceChildren();
  exposure.windows.forEach(window => {
    const item = document.createElement("div");
    item.className = `month-boundary-window ${window.direction}${window.isYearBoundary ? " year-boundary" : ""}`;
    item.dataset.term = window.name;
    item.dataset.windowHours = window.widthHours.toFixed(6);
    item.dataset.beforeBranch = window.beforeBranch;
    item.dataset.afterBranch = window.afterBranch;
    item.dataset.pillarImpact = window.pillarImpact;
    if (window.baseWindowBranch) item.dataset.baseWindowBranch = window.baseWindowBranch;
    if (window.targetWindowBranch) item.dataset.targetWindowBranch = window.targetWindowBranch;
    item.title = windowTitle(window);
    item.style.setProperty("--window-width", `${Math.max(0, window.widthHours / maxWindow * 100).toFixed(3)}%`);
    item.innerHTML = `
      <span>${window.name}${window.isYearBoundary ? " · 年界" : ""}</span>
      <i aria-hidden="true"><b></b></i>
      <strong>${window.widthHours.toFixed(2)} h</strong>
      <small>${window.monthTransition} · ${window.isYearBoundary ? "年＋月" : "月"}</small>
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
  instrument.dataset.yearBoundaryLiChunWindowHours = (liChunWindow?.widthHours ?? 0).toFixed(6);
  instrument.dataset.yearBoundaryLiChunBeforeBranch = liChunWindow?.beforeBranch ?? "none";
  instrument.dataset.yearBoundaryLiChunAfterBranch = liChunWindow?.afterBranch ?? "none";
  instrument.dataset.yearBoundaryLiChunBaseMonthBranch = liChunWindow?.baseWindowBranch ?? "aligned";
  instrument.dataset.yearBoundaryLiChunTargetMonthBranch = liChunWindow?.targetWindowBranch ?? "aligned";
  instrument.dataset.monthBoundaryClosed = String(exposure.closed);
}

function renderMonthBoundaryUnavailable() {
  const panel = ensureMonthBoundaryPanel();
  panel?.querySelector("#month-boundary-window-grid")?.replaceChildren();
  setText("month-boundary-exposure-hours", "model unavailable");
  setText("month-boundary-exposure-percent", "—");
  setText("month-boundary-largest", "—");
  setText("month-boundary-overlap", "—");
  setText("pillar-impact-month-only-hours", "—");
  setText("pillar-impact-month-only-percent", "—");
  setText("pillar-impact-year-month-hours", "—");
  setText("pillar-impact-year-month-percent", "—");
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
  delete instrument.dataset.yearBoundaryLiChunWindowHours;
  delete instrument.dataset.yearBoundaryLiChunBeforeBranch;
  delete instrument.dataset.yearBoundaryLiChunAfterBranch;
  delete instrument.dataset.yearBoundaryLiChunBaseMonthBranch;
  delete instrument.dataset.yearBoundaryLiChunTargetMonthBranch;
  delete instrument.dataset.monthBoundaryClosed;
}

function renderUnavailable(message) {
  group.replaceChildren();
  termGrid?.replaceChildren();
  renderMonthBoundaryUnavailable();
  setResidualHeadline("model unavailable");
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
  setText("astronomy-rms-residual", `${result.rmsHours.toFixed(2)} h RMS`);
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
