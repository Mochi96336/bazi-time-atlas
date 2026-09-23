import {
  GLOBAL_GREGORIAN_YEAR_SEQUENCE_DAY_PERIOD,
  canonicalRecurrenceCandidates,
  findFirstLocalYearSequenceDayRecurrence,
  recurrenceState,
  validateGregorianDate
} from "./recurrence/gregorian-cycle.js";
import { BERGER_MODEL } from "./recurrence/berger-orbit.js";
import {
  phaseAngleOnFan,
  phaseFanCells,
  signedShortestPhase
} from "./recurrence/phase-fan-geometry.js";

const NS = "http://www.w3.org/2000/svg";
const CX = 600;
const CY = 820;
const CURSOR_ANGLE = -90;
const FAN_START = -170;
const FAN_END = -10;
const MAX_GREGORIAN_YEAR = 10_000_000;
const FINE_SLIDER_MAX = GLOBAL_GREGORIAN_YEAR_SEQUENCE_DAY_PERIOD;
const PHASE_MODULUS = Object.freeze({ gregorian:400, year:60, day:60 });

const svg = document.querySelector("#recurrence-wheel");
const instrument = document.querySelector("#recurrence-instrument");
const yearInput = document.querySelector("#base-year");
const monthInput = document.querySelector("#base-month");
const dayInput = document.querySelector("#base-day");
const deltaNumber = document.querySelector("#delta-number");
const deltaSlider = document.querySelector("#delta-slider");
const candidateButtons = document.querySelector("#candidate-buttons");
const derivationSteps = document.querySelector("#discrete-derivation-steps");
const cursorGroup = document.querySelector("#recurrence-cursor");
const DERIVATION_DELTAS = Object.freeze([400, 1200, 8000, 24_000]);

// Radial scale follows the same product grammar as the main atlas: shorter
// recurrence cycles live inside, longer cycles live outside. Astronomy remains
// the outer comparison layer rather than another discrete gear.
const ringSpecs = Object.freeze({
  day: { group: document.querySelector("#day-ring"), inner:270, outer:360, sectors:60, phasePerSector:1, modulus:60, className:"day-sector" },
  year: { group: document.querySelector("#year-ring"), inner:360, outer:450, sectors:60, phasePerSector:1, modulus:60, className:"year-sector" },
  gregorian: { group: document.querySelector("#gregorian-ring"), inner:450, outer:560, sectors:40, phasePerSector:10, modulus:400, className:"gregorian-sector" }
});

let currentBase = { year:2026, month:9, day:13 };
let currentDelta = 0;
let candidateStates = [];

function polar(radius, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  return { x:CX + Math.cos(angle) * radius, y:CY + Math.sin(angle) * radius };
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

function formatSigned(value) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

function renderGuides() {
  const group = document.querySelector("#recurrence-guides");
  for (const [key, spec] of Object.entries(ringSpecs)) {
    svgEl("path", {
      d:annularSectorPath(spec.inner + 2, spec.outer - 2, FAN_START, FAN_END),
      class:`phase-band phase-band-${key}`
    }, group);
  }
  [270, 360, 450, 560].forEach(radius => {
    svgEl("path", { d:arcPath(radius, FAN_START, FAN_END), class:"recurrence-guide" }, group);
  });
}

function renderRing(key) {
  const spec = ringSpecs[key];
  const cells = phaseFanCells({ modulus:spec.modulus, sectors:spec.sectors, fanStart:FAN_START, fanEnd:FAN_END });
  spec.group.classList.add("recurrence-track", "phase-gauge-track");
  spec.group.dataset.phaseGeometry = "signed-shortest-fan";
  spec.group.dataset.phaseModulus = String(spec.modulus);
  spec.group.dataset.radialScale = key;

  for (const cell of cells) {
    svgEl("path", {
      d:annularSectorPath(spec.inner, spec.outer, cell.startAngle + .06, cell.endAngle - .06),
      class:`phase-sector ${spec.className}`,
      "data-phase-cell":cell.index,
      "data-signed-start":cell.signedStart
    }, spec.group);

    const tickAngle = cell.startAngle;
    const major = cell.index % 10 === 0 || cell.index === spec.sectors / 2;
    const p1 = polar(spec.outer - (major ? 10 : 5), tickAngle);
    const p2 = polar(spec.outer, tickAngle);
    svgEl("line", {
      x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y,
      class:`phase-tick${major ? " major" : ""}`
    }, spec.group);

    if (cell.index % 10 === 0 || cell.index === spec.sectors / 2) {
      const radius = (spec.inner + spec.outer) / 2;
      const angle = cell.startAngle + (cell.endAngle - cell.startAngle) / 2;
      const p = polar(radius, angle);
      const label = svgEl("text", {
        x:p.x,
        y:p.y,
        class:"phase-label",
        transform:`rotate(${angle + 90} ${p.x} ${p.y})`
      }, spec.group);
      label.textContent = formatSigned(cell.signedStart);
    }
  }
}

function renderCursor() {
  const inner = polar(258, CURSOR_ANGLE);
  const outer = polar(575, CURSOR_ANGLE);
  svgEl("line", { x1:inner.x, y1:inner.y, x2:outer.x, y2:outer.y, class:"cursor-halo" }, cursorGroup);
  svgEl("line", { x1:inner.x, y1:inner.y, x2:outer.x, y2:outer.y, class:"cursor-line" }, cursorGroup);
  const labelPoint = polar(595, CURSOR_ANGLE);
  const label = svgEl("text", { x:labelPoint.x, y:labelPoint.y, class:"cursor-label" }, cursorGroup);
  label.textContent = "閉合 · 0";
}

function renderReturnMarkers(state) {
  cursorGroup.querySelectorAll("[data-return-marker]").forEach(node => node.remove());
  const phases = {
    day:state.phases.day,
    year:state.phases.yearSequence,
    gregorian:state.phases.gregorian
  };

  for (const [key, spec] of Object.entries(ringSpecs)) {
    const phase = phases[key];
    if (phase === null) continue;
    const signed = signedShortestPhase(phase, spec.modulus);
    const angle = phaseAngleOnFan({
      phase,
      modulus:spec.modulus,
      fanStart:FAN_START,
      fanEnd:FAN_END,
      referenceAngle:CURSOR_ANGLE
    });
    const p1 = polar(spec.inner + 5, angle);
    const p2 = polar(spec.outer - 5, angle);
    svgEl("line", {
      x1:p1.x,
      y1:p1.y,
      x2:p2.x,
      y2:p2.y,
      class:`return-marker return-marker-${key}${phase === 0 ? " is-closed" : ""}`,
      "data-return-marker":key,
      "data-return-angle":angle.toFixed(3),
      "data-phase-raw":phase,
      "data-phase-signed":signed,
      "data-phase-modulus":spec.modulus
    }, cursorGroup);
    const labelPoint = polar(spec.outer + 9, angle);
    const label = svgEl("text", {
      x:labelPoint.x,
      y:labelPoint.y,
      class:`return-marker-label return-marker-label-${key}`,
      "data-return-marker":`${key}-label`
    }, cursorGroup);
    label.textContent = formatSigned(signed);
  }
}

function readBaseDate() {
  return {
    year:Number(yearInput.value),
    month:Number(monthInput.value),
    day:Number(dayInput.value)
  };
}

function parseDateParam(value) {
  const match = /^(\d{1,7})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const date = { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]) };
  return validateGregorianDate(date) ? date : null;
}

function maxSelectableDelta(baseYear = currentBase.year) {
  const gregorianLimit = Math.max(0, MAX_GREGORIAN_YEAR - baseYear);
  const fineLimit = Math.min(FINE_SLIDER_MAX, gregorianLimit);
  const modelUpperYear = BERGER_MODEL.epochYear + BERGER_MODEL.validityYearsFromEpoch;
  const modelForwardLimit = Math.max(0, Math.floor(modelUpperYear - baseYear));
  return Math.min(gregorianLimit, Math.max(fineLimit, modelForwardLimit));
}

function clampDelta(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(maxSelectableDelta(), numeric));
}

function applyQueryPreset() {
  const params = new URLSearchParams(location.search);
  const queryDate = parseDateParam(params.get("date"));
  if (queryDate) {
    currentBase = queryDate;
    yearInput.value = String(queryDate.year);
    monthInput.value = String(queryDate.month);
    dayInput.value = String(queryDate.day);
  }

  const rawDelta = params.get("delta");
  const parsedDelta = rawDelta === null ? 0 : Number(rawDelta);
  const queryDelta = Number.isFinite(parsedDelta) ? clampDelta(parsedDelta) : 0;

  if (queryDate || rawDelta !== null) instrument.dataset.queryPreset = "1";
  return queryDelta;
}

function formatDate(date) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function syncQueryState() {
  const url = new URL(location.href);
  url.searchParams.set("date", formatDate(currentBase));
  url.searchParams.set("delta", String(currentDelta));
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function updateDeltaControlBounds() {
  const max = maxSelectableDelta();
  deltaNumber.max = String(max);
  instrument.dataset.maxSelectableDeltaYears = String(max);
}

function updateDeltaScaleMode() {
  const deep = currentDelta > FINE_SLIDER_MAX;
  deltaSlider.value = String(Math.min(currentDelta, FINE_SLIDER_MAX));
  deltaSlider.dataset.outOfRange = String(deep);
  instrument.dataset.deltaMode = deep ? "deep" : "fine";
  setText(
    "delta-range-note",
    deep
      ? `深時間 +${currentDelta.toLocaleString("en-US")} 年；滑桿仍保留 0–24,000 年細部尺度。`
      : "滑桿：0–24,000 年；深時間 exact 候選可由下方排名直接跳轉。"
  );
}

function stateMeaning(state, localYears) {
  if (state.deltaYears === 0) return "基準點";
  if (state.closed.gregorian && state.closed.yearSequence && state.closed.day) return "三個離散相位同時歸零";
  if (state.deltaYears === localYears && state.closed.yearSequence && state.closed.day) return "此起點 60 年序＋60 日序首次重遇";
  if (state.closed.gregorian && state.closed.yearSequence) return "公曆結構＋60 年序閉合；60 日序仍偏";
  if (state.closed.gregorian && state.closed.day) return "公曆結構＋60 日序閉合；60 年序仍偏";
  if (state.closed.gregorian) return "公曆結構回原位";
  if (state.closed.yearSequence) return "60 年序回原位";
  if (state.closed.day) return "60 日序回原位";
  return "沒有完整閉合";
}

function derivationPhase(label, closed, phase, modulus) {
  if (phase === null) return `<span><small>${label}</small><em class="phase-no">—</em></span>`;
  const signed = signedShortestPhase(phase, modulus);
  return `<span><small>${label}</small><em class="${closed ? "phase-ok" : "phase-no"}">${closed ? "0" : formatSigned(signed)}</em></span>`;
}

function derivationMeaning(deltaYears) {
  if (deltaYears === 400) return "400 年＝146,097 日；公曆結構先回到 0";
  if (deltaYears === 1200) return "公曆結構＋60 年序同時回到 0";
  if (deltaYears === 8000) return "公曆結構＋60 日序同時回到 0";
  return "三個離散相位第一次全域同時歸零";
}

function renderDerivation(states) {
  if (!derivationSteps) return;
  derivationSteps.replaceChildren();
  for (const deltaYears of DERIVATION_DELTAS) {
    const state = states.find(candidate => candidate.deltaYears === deltaYears);
    if (!state) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "discrete-derivation-step";
    button.dataset.deltaYears = String(deltaYears);
    button.innerHTML = `<strong>+${deltaYears.toLocaleString("en-US")} 年</strong><span class="discrete-derivation-phases">${derivationPhase("公曆", state.closed.gregorian, state.phases.gregorian, 400)}${derivationPhase("年序", state.closed.yearSequence, state.phases.yearSequence, 60)}${derivationPhase("日序", state.closed.day, state.phases.day, 60)}</span><small>${derivationMeaning(deltaYears)}</small>`;
    button.addEventListener("click", () => setDelta(deltaYears, { source:"derivation" }));
    derivationSteps.appendChild(button);
  }
}

function rebuildCandidates() {
  const local = findFirstLocalYearSequenceDayRecurrence(currentBase);
  const localYears = local?.deltaYears ?? null;
  candidateStates = canonicalRecurrenceCandidates(currentBase);
  candidateButtons.replaceChildren();
  renderDerivation(candidateStates);

  candidateStates.forEach(state => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.deltaYears = String(state.deltaYears);
    button.textContent = state.deltaYears === localYears ? `局部 ${state.deltaYears}` : state.deltaYears.toLocaleString("en-US");
    button.addEventListener("click", () => setDelta(state.deltaYears, { source:"canonical" }));
    candidateButtons.appendChild(button);

  });

  instrument.dataset.localYearSequenceDayRecurrence = local ? String(local.deltaYears) : "none";
}

function setClosureArticle(key, closed, phase) {
  const article = document.querySelector(`[data-closure="${key}"]`);
  const modulus = PHASE_MODULUS[key];
  const signed = phase === null ? null : signedShortestPhase(phase, modulus);
  article.classList.toggle("is-closed", closed);
  article.classList.toggle("is-open", !closed);
  if (phase === null) {
    delete article.dataset.phaseRaw;
    delete article.dataset.phaseSigned;
    delete article.dataset.phaseModulus;
  } else {
    article.dataset.phaseRaw = String(phase);
    article.dataset.phaseSigned = String(signed);
    article.dataset.phaseModulus = String(modulus);
  }
  setText(`${key}-status`, phase === null ? "—" : closed ? "0" : formatSigned(signed));
}

function phaseReadout(phase, modulus) {
  if (phase === null) return "—";
  const signed = signedShortestPhase(phase, modulus);
  return `${phase} / ${modulus}${signed === 0 ? "" : ` · 最短 ${formatSigned(signed)}`}`;
}

function renderState() {
  let state;
  try {
    state = recurrenceState(currentBase, currentDelta);
  } catch (error) {
    setText("closure-summary", error.message);
    return;
  }

  renderReturnMarkers(state);

  setText("gregorian-phase-readout", phaseReadout(state.phases.gregorian, 400));
  setText("year-phase-readout", phaseReadout(state.phases.yearSequence, 60));
  setText("day-phase-readout", phaseReadout(state.phases.day, 60));
  setText("delta-readout", `${currentDelta.toLocaleString("en-US")} 年`);
  setText("target-date-readout", state.targetValid ? formatDate(state.targetDate) : `${state.targetDate.year}-${String(state.targetDate.month).padStart(2,"0")}-${String(state.targetDate.day).padStart(2,"0")}（不存在）`);

  setClosureArticle("gregorian", state.closed.gregorian, state.phases.gregorian);
  setClosureArticle("year", state.closed.yearSequence, state.phases.yearSequence);
  setClosureArticle("day", state.closed.day, state.phases.day);

  const localYears = findFirstLocalYearSequenceDayRecurrence(currentBase)?.deltaYears ?? null;
  setText("closure-summary", stateMeaning(state, localYears));

  instrument.dataset.baseDate = formatDate(currentBase);
  instrument.dataset.targetDate = state.targetValid ? formatDate(state.targetDate) : "invalid";
  instrument.dataset.deltaYears = String(currentDelta);
  instrument.dataset.phaseDisplay = "signed-shortest";
  instrument.dataset.gregorianPhase = String(state.phases.gregorian);
  instrument.dataset.yearSequencePhase = String(state.phases.yearSequence);
  instrument.dataset.dayPhase = state.phases.day === null ? "invalid" : String(state.phases.day);
  instrument.dataset.gregorianPhaseSigned = String(signedShortestPhase(state.phases.gregorian, 400));
  instrument.dataset.yearSequencePhaseSigned = String(signedShortestPhase(state.phases.yearSequence, 60));
  instrument.dataset.dayPhaseSigned = state.phases.day === null ? "invalid" : String(signedShortestPhase(state.phases.day, 60));
  instrument.dataset.gregorianClosed = String(state.closed.gregorian);
  instrument.dataset.yearSequenceClosed = String(state.closed.yearSequence);
  instrument.dataset.dayClosed = String(state.closed.day);
  instrument.dataset.globalClosed = String(state.closed.gregorian && state.closed.yearSequence && state.closed.day);

  candidateButtons.querySelectorAll("button").forEach(button => button.classList.toggle("active", Number(button.dataset.deltaYears) === currentDelta));
  derivationSteps?.querySelectorAll(".discrete-derivation-step").forEach(step => step.classList.toggle("active", Number(step.dataset.deltaYears) === currentDelta));
}

function setDelta(value, options = {}) {
  const next = clampDelta(value);
  currentDelta = next;
  deltaNumber.value = String(next);
  instrument.dataset.deltaSource = options.source ?? "control";
  updateDeltaScaleMode();
  renderState();
  if (options.syncQuery !== false) syncQueryState();
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
  updateDeltaControlBounds();
  rebuildCandidates();
  setDelta(currentDelta, { source:"base-date" });
}

function bindControls() {
  [yearInput, monthInput, dayInput].forEach(input => input.addEventListener("change", updateBaseDate));
  deltaNumber.addEventListener("change", () => setDelta(deltaNumber.value, { source:"number" }));
  deltaSlider.addEventListener("input", () => setDelta(deltaSlider.value, { source:"slider" }));
  window.addEventListener("recurrence:select-delta", event => {
    const deltaYears = Number(event.detail?.deltaYears);
    if (!Number.isFinite(deltaYears)) return;
    setDelta(deltaYears, { source:event.detail?.source ?? "external" });
  });
}

function initialize() {
  renderGuides();
  renderRing("day");
  renderRing("year");
  renderRing("gregorian");
  renderCursor();
  instrument.dataset.phaseGeometry = "signed-shortest-fan";
  instrument.dataset.phaseRadialOrder = "day,year,gregorian,astronomy";
  const initialDelta = applyQueryPreset();
  bindControls();
  instrument.dataset.baseDateValid = "true";
  updateDeltaControlBounds();
  rebuildCandidates();
  setDelta(initialDelta, { syncQuery:false, source:"initial" });
}

initialize();