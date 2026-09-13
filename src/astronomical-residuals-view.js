import {
  BERGER_MODEL,
  solarTermShapeResiduals
} from "./recurrence/berger-orbit.js";

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

function renderUnavailable(message) {
  group.replaceChildren();
  termGrid?.replaceChildren();
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
