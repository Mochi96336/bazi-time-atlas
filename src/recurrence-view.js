import {
  GLOBAL_GREGORIAN_YEAR_DAY_PERIOD,
  canonicalRecurrenceCandidates,
  findFirstLocalYearDayRecurrence,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";

const NS = "http://www.w3.org/2000/svg";
const CX = 600;
const CY = 820;
const CURSOR_ANGLE = -90;
const FAN_START = -170;
const FAN_END = -10;

const svg = document.querySelector("#recurrence-wheel");
const instrument = document.querySelector("#recurrence-instrument");
const yearInput = document.querySelector("#base-year");
const monthInput = document.querySelector("#base-month");
const dayInput = document.querySelector("#base-day");
const deltaNumber = document.querySelector("#delta-number");
const deltaSlider = document.querySelector("#delta-slider");
const candidateButtons = document.querySelector("#candidate-buttons");
const milestoneRows = document.querySelector("#milestone-rows");

const ringSpecs = Object.freeze({
  gregorian: { group: document.querySelector("#gregorian-ring"), inner: 270, outer: 360, sectors: 40, sectorYears: 10, className: "gregorian-sector" },
  year: { group: document.querySelector("#year-ring"), inner: 360, outer: 450, sectors: 60, sectorYears: 1, className: "year-sector" },
  day: { group: document.querySelector("#day-ring"), inner: 450, outer: 560, sectors: 60, sectorYears: 1, className: "day-sector" }
});

let currentBase = { year: 2026, month: 9, day: 13 };
let currentDelta = 0;
let candidateStates = [];

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function polar(radius, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
}

function annularSectorPath(inner, outer, startDegrees, endDegrees) {
  let end = endDegrees;
  while (end <= startDegrees) end += 360;
  const span = end - startDegrees;
  const p1 = polar(outer, startDegrees);
  const p2 = polar(outer, end);
  const p3 = polar(inner, end);
  const p4 = polar(inner, startDegrees);
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${outer} ${outer} 0 ${span > 180 ? 1 : 0} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)} L ${p3.x.toFixed(3)} ${p3.y.toFixed(3)} A ${inner} ${inner} 0 ${span > 180 ? 1 : 0} 0 ${p4.x.toFixed(3)} ${p4.y.toFixed(3)} Z`;
}

function arcPath(radius, startDegrees, endDegrees) {
  const p1 = polar(radius, startDegrees);
  const p2 = polar(radius, endDegrees);
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
}

function svgEl(tag, attrs = {}, parent = svg) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function renderGuides() {
  const group = document.querySelector("#recurrence-guides");
  [270, 360, 450, 560].forEach(radius => {
    svgEl("path", { d: arcPath(radius, FAN_START, FAN_END), class: "recurrence-guide" }, group);
  });
}

function renderRing(key) {
  const spec = ringSpecs[key];
  const sectorAngle = 360 / spec.sectors;
  spec.group.classList.add("recurrence-track");

  for (let index = 0; index < spec.sectors; index += 1) {
    svgEl("path", {
      d: annularSectorPath(spec.inner, spec.outer, index * sectorAngle + .12, (index + 1) * sectorAngle - .12),
      class: `phase-sector ${spec.className}`
    }, spec.group);

    const tickAngle = index * sectorAngle;
    const p1 = polar(spec.outer - (index % 5 === 0 ? 10 : 6), tickAngle);
    const p2 = polar(spec.outer, tickAngle);
    svgEl("line", {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      class: `phase-tick${index % 5 === 0 ? " major" : ""}`
    }, spec.group);

    const showLabel = key === "gregorian" ? index % 10 === 0 : index % 10 === 0;
    if (showLabel) {
      const radius = (spec.inner + spec.outer) / 2;
      const angle = index * sectorAngle + sectorAngle / 2;
      const p = polar(radius, angle);
      const label = svgEl("text", {
        x: p.x,
        y: p.y,
        class: "phase-label",
        transform: `rotate(${angle + 90} ${p.x} ${p.y})`
      }, spec.group);
      label.textContent = key === "gregorian" ? String(index * spec.sectorYears) : String(index);
    }
  }

  const zeroInner = polar(spec.inner + 2, 0);
  const zeroOuter = polar(spec.outer - 2, 0);
  svgEl("line", {
    x1: zeroInner.x, y1: zeroInner.y, x2: zeroOuter.x, y2: zeroOuter.y,
    class: "zero-mark"
  }, spec.group);
  const zeroPoint = polar((spec.inner + spec.outer) / 2, 1.5);
  const zeroLabel = svgEl("text", { x: zeroPoint.x, y: zeroPoint.y, class: "zero-label" }, spec.group);
  zeroLabel.textContent = "0";
}

function renderCursor() {
  const group = document.querySelector("#recurrence-cursor");
  const inner = polar(258, CURSOR_ANGLE);
  const outer = polar(575, CURSOR_ANGLE);
  svgEl("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-halo" }, group);
  svgEl("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-line" }, group);
  const labelPoint = polar(595, CURSOR_ANGLE);
  const label = svgEl("text", { x: labelPoint.x, y: labelPoint.y, class: "cursor-label" }, group);
  label.textContent = "SAME REFERENCE";
}

function rotateRing(key, phase, modulus) {
  const anglePerUnit = 360 / modulus;
  const rotation = CURSOR_ANGLE - phase * anglePerUnit;
  ringSpecs[key].group.setAttribute("transform", `rotate(${rotation.toFixed(4)} ${CX} ${CY})`);
}

function readBaseDate() {
  return {
    year: Number(yearInput.value),
    month: Number(monthInput.value),
    day: Number(dayInput.value)
  };
}

function formatDate(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function stateMeaning(state, localYears) {
  if (state.deltaYears === 0) return "基準點";
  if (state.closed.gregorian && state.closed.year && state.closed.day) return "三層全域閉合";
  if (state.deltaYears === localYears && state.closed.year && state.closed.day) return "此起點年＋日首次重遇";
  if (state.closed.gregorian && state.closed.year) return "公曆＋年序閉合；日序仍偏";
  if (state.closed.gregorian && state.closed.day) return "公曆＋日序閉合；年序仍偏";
  if (state.closed.gregorian) return "公曆閏年骨架回原位";
  if (state.closed.year) return "年序回原位";
  if (state.closed.day) return "日序回原位";
  return "沒有完整閉合";
}

function phaseCell(closed, phase) {
  const text = phase === null ? "—" : closed ? "✓ 0" : `+${phase}`;
  return `<span class="${closed ? "phase-ok" : "phase-no"}">${text}</span>`;
}

function rebuildCandidates() {
  const local = findFirstLocalYearDayRecurrence(currentBase);
  const localYears = local?.deltaYears ?? null;
  candidateStates = canonicalRecurrenceCandidates(currentBase);
  candidateButtons.replaceChildren();
  milestoneRows.replaceChildren();

  candidateStates.forEach(state => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.deltaYears = String(state.deltaYears);
    button.textContent = state.deltaYears === localYears ? `局部 ${state.deltaYears}` : state.deltaYears.toLocaleString("en-US");
    button.addEventListener("click", () => setDelta(state.deltaYears));
    candidateButtons.appendChild(button);

    const row = document.createElement("div");
    row.className = "milestone-row";
    row.dataset.deltaYears = String(state.deltaYears);
    row.innerHTML = `<strong>${state.deltaYears.toLocaleString("en-US")}</strong>${phaseCell(state.closed.gregorian, state.phases.gregorian)}${phaseCell(state.closed.year, state.phases.year)}${phaseCell(state.closed.day, state.phases.day)}<span>${stateMeaning(state, localYears)}</span>`;
    row.addEventListener("click", () => setDelta(state.deltaYears));
    milestoneRows.appendChild(row);
  });

  setText("local-recurrence", local ? `${local.deltaYears.toLocaleString("en-US")} 年` : "未找到");
}

function setClosureArticle(key, closed, phase) {
  const article = document.querySelector(`[data-closure="${key}"]`);
  article.classList.toggle("is-closed", closed);
  article.classList.toggle("is-open", !closed);
  setText(`${key}-status`, phase === null ? "無對應日期" : closed ? "閉合 · 0" : `偏移 ${phase}`);
}

function renderState() {
  let state;
  try {
    state = recurrenceState(currentBase, currentDelta);
  } catch (error) {
    setText("closure-summary", error.message);
    return;
  }

  rotateRing("gregorian", state.phases.gregorian, 400);
  rotateRing("year", state.phases.year, 60);
  rotateRing("day", state.phases.day ?? 0, 60);

  setText("gregorian-phase-readout", `${state.phases.gregorian} / 400`);
  setText("year-phase-readout", `${state.phases.year} / 60`);
  setText("day-phase-readout", state.phases.day === null ? "—" : `${state.phases.day} / 60`);
  setText("delta-readout", `${currentDelta.toLocaleString("en-US")} 年`);
  setText("target-date-readout", state.targetValid ? formatDate(state.targetDate) : `${state.targetDate.year}-${String(state.targetDate.month).padStart(2,"0")}-${String(state.targetDate.day).padStart(2,"0")}（不存在）`);

  setClosureArticle("gregorian", state.closed.gregorian, state.phases.gregorian);
  setClosureArticle("year", state.closed.year, state.phases.year);
  setClosureArticle("day", state.closed.day, state.phases.day);

  const localYears = findFirstLocalYearDayRecurrence(currentBase)?.deltaYears ?? null;
  setText("closure-summary", stateMeaning(state, localYears));

  instrument.dataset.deltaYears = String(currentDelta);
  instrument.dataset.gregorianPhase = String(state.phases.gregorian);
  instrument.dataset.yearPhase = String(state.phases.year);
  instrument.dataset.dayPhase = state.phases.day === null ? "invalid" : String(state.phases.day);
  instrument.dataset.gregorianClosed = String(state.closed.gregorian);
  instrument.dataset.yearClosed = String(state.closed.year);
  instrument.dataset.dayClosed = String(state.closed.day);
  instrument.dataset.globalClosed = String(state.closed.gregorian && state.closed.year && state.closed.day);

  candidateButtons.querySelectorAll("button").forEach(button => button.classList.toggle("active", Number(button.dataset.deltaYears) === currentDelta));
  milestoneRows.querySelectorAll(".milestone-row").forEach(row => row.classList.toggle("active", Number(row.dataset.deltaYears) === currentDelta));
}

function setDelta(value) {
  const next = Math.max(0, Math.min(GLOBAL_GREGORIAN_YEAR_DAY_PERIOD, Math.round(Number(value) || 0)));
  currentDelta = next;
  deltaNumber.value = String(next);
  deltaSlider.value = String(next);
  renderState();
}

function updateBaseDate() {
  const next = readBaseDate();
  if (!validateGregorianDate(next)) {
    instrument.dataset.baseDateValid = "false";
    setText("closure-summary", "基準日期無效");
    return;
  }
  currentBase = next;
  instrument.dataset.baseDateValid = "true";
  rebuildCandidates();
  renderState();
}

function bindControls() {
  [yearInput, monthInput, dayInput].forEach(input => input.addEventListener("change", updateBaseDate));
  deltaNumber.addEventListener("change", () => setDelta(deltaNumber.value));
  deltaSlider.addEventListener("input", () => setDelta(deltaSlider.value));
}

function initialize() {
  renderGuides();
  renderRing("gregorian");
  renderRing("year");
  renderRing("day");
  renderCursor();
  bindControls();
  rebuildCandidates();
  setDelta(0);
}

initialize();
