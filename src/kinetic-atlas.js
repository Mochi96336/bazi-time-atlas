import { baziMonths, solarTerms, zodiacSigns } from "./data.js";
import { apparentSolarLongitude } from "./astronomy/solar-longitude.js";
import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { monthPillarForYearStem } from "./calendar/five-tigers.js";

const NS = "http://www.w3.org/2000/svg";
const DAY_MS = 86_400_000;
const UTC_OFFSET_HOURS = 8;
const CX = 600;
const CY = 1360;
const CURSOR_ANGLE = -90;
const FAN_START = -170;
const FAN_END = -10;
const RADII = Object.freeze({
  inner: 760,
  yearOuter: 834,
  monthOuter: 908,
  dayOuter: 982,
  solarOuter: 1072,
  zodiacOuter: 1182
});
const GUIDE_RADII = Object.freeze([
  RADII.inner,
  RADII.yearOuter,
  RADII.monthOuter,
  RADII.dayOuter,
  RADII.solarOuter,
  RADII.zodiacOuter
]);

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SEXAGENARY = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);

const SCALE_CONFIG = Object.freeze({
  day: {
    label: "日內 / 48 小時",
    spanDays: 1,
    sliderStep: 1 / 144,
    playDaysPerSecond: .25,
    edgeLabel: "1 日"
  },
  year: {
    label: "一年",
    spanDays: 183,
    sliderStep: .25,
    playDaysPerSecond: 6,
    edgeLabel: "約半年"
  },
  cycle: {
    label: "六十年",
    spanDays: 365.2422 * 30,
    sliderStep: 1,
    playDaysPerSecond: 365.2422,
    edgeLabel: "約 30 年"
  }
});

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const instantInput = document.querySelector("#instant-input");
const playButton = document.querySelector("#play-button");
const nowButton = document.querySelector("#now-button");
const scaleButtons = [...document.querySelectorAll("[data-scale]")];

const state = {
  anchorMs: Date.now(),
  selectedMs: Date.now(),
  scale: "year",
  playing: false,
  animationFrame: null,
  lastAnimationTs: null,
  legacyProjection: null
};

const ringSpecs = {
  year: { group: document.querySelector("#year-track"), inner: RADII.inner, outer: RADII.yearOuter, className: "year-sector" },
  month: { group: document.querySelector("#month-track"), inner: RADII.yearOuter, outer: RADII.monthOuter, className: "month-sector" },
  day: { group: document.querySelector("#day-track"), inner: RADII.monthOuter, outer: RADII.dayOuter, className: "day-sector" }
};

const ringRuntime = {};
const solarTrack = document.querySelector("#solar-track");
const zodiacTrack = document.querySelector("#zodiac-track");
const termSectorNodes = [];
const zodiacSectorNodes = [];
let solarRotation = null;
let lastSolarLongitude = null;

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function polar(radius, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
}

function annularSectorPath(inner, outer, startDegrees, endDegrees) {
  let start = startDegrees;
  let end = endDegrees;
  while (end <= start) end += 360;
  const span = end - start;
  const largeArc = span > 180 ? 1 : 0;
  const p1 = polar(outer, start);
  const p2 = polar(outer, end);
  const p3 = polar(inner, end);
  const p4 = polar(inner, start);
  return [
    `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
    `L ${p3.x.toFixed(3)} ${p3.y.toFixed(3)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${p4.x.toFixed(3)} ${p4.y.toFixed(3)}`,
    "Z"
  ].join(" ");
}

function arcPath(radius, startDegrees, endDegrees) {
  const p1 = polar(radius, startDegrees);
  const p2 = polar(radius, endDegrees);
  const span = ((endDegrees - startDegrees) % 360 + 360) % 360;
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
}

function svgEl(tag, attrs = {}, parent = svg) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function addTitle(node, text) {
  const title = document.createElementNS(NS, "title");
  title.textContent = text;
  node.appendChild(title);
}

function ganzhiIndex(name) {
  return SEXAGENARY.indexOf(name);
}

function shortestCycleDelta(nextIndex, previousIndex, size = 60) {
  let delta = (nextIndex - previousIndex) % size;
  if (delta > size / 2) delta -= size;
  if (delta < -size / 2) delta += size;
  return delta;
}

function shortestAngleDelta(nextAngle, previousAngle) {
  let delta = normalizeDegrees(nextAngle) - normalizeDegrees(previousAngle);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

function renderGuides() {
  const guides = document.querySelector("#guide-layer");
  GUIDE_RADII.forEach(radius => {
    svgEl("path", { d: arcPath(radius, FAN_START, FAN_END), class: "guide-arc" }, guides);
  });
}

function renderCycleRing(key) {
  const spec = ringSpecs[key];
  const sectors = [];
  const group = spec.group;
  group.classList.add("ring-track", `${key}-track`);

  SEXAGENARY.forEach((label, index) => {
    const start = index * 6 + .18;
    const end = (index + 1) * 6 - .18;
    const path = svgEl("path", {
      d: annularSectorPath(spec.inner, spec.outer, start, end),
      class: `cycle-sector ${spec.className}`,
      "data-cycle-index": index,
      "data-cycle-label": label
    }, group);
    addTitle(path, `${index + 1} · ${label}`);
    sectors.push(path);

    const tickAngle = index * 6;
    const inner = polar(spec.outer - 8, tickAngle);
    const outer = polar(spec.outer, tickAngle);
    svgEl("line", {
      x1: inner.x,
      y1: inner.y,
      x2: outer.x,
      y2: outer.y,
      class: `ring-tick${index % 5 === 0 ? " major" : ""}`
    }, group);

    if (index % 5 === 0) {
      const radius = (spec.inner + spec.outer) / 2;
      const point = polar(radius, index * 6 + 3);
      const text = svgEl("text", {
        x: point.x,
        y: point.y,
        class: "cycle-label",
        transform: `rotate(${index * 6 + 93} ${point.x} ${point.y})`
      }, group);
      text.textContent = label;
    }
  });

  ringRuntime[key] = {
    ...spec,
    sectors,
    lastIndex: null,
    rotation: null
  };
}

function renderSolarRing() {
  solarTerms.forEach((term, index) => {
    const start = term.longitude;
    const end = term.longitude + 15;
    const path = svgEl("path", {
      d: annularSectorPath(RADII.dayOuter, RADII.solarOuter, start + .15, end - .15),
      class: `term-sector ${term.kind}`,
      "data-term-index": index
    }, solarTrack);
    addTitle(path, `${term.name} · ${term.longitude}°`);
    termSectorNodes.push(path);

    const markInner = polar(RADII.dayOuter, term.longitude);
    const markOuter = polar(term.kind === "jie" ? RADII.solarOuter : RADII.solarOuter - 12, term.longitude);
    svgEl("line", {
      x1: markInner.x,
      y1: markInner.y,
      x2: markOuter.x,
      y2: markOuter.y,
      class: `term-mark ${term.kind}`
    }, solarTrack);

    const labelPoint = polar(term.kind === "jie" ? RADII.solarOuter - 32 : RADII.solarOuter - 44, term.longitude + 7.5);
    const label = svgEl("text", {
      x: labelPoint.x,
      y: labelPoint.y,
      class: `term-label ${term.kind}`,
      transform: `rotate(${term.longitude + 97.5} ${labelPoint.x} ${labelPoint.y})`
    }, solarTrack);
    label.textContent = term.name;
  });
}

function renderZodiacRing() {
  zodiacSigns.forEach((sign, index) => {
    const path = svgEl("path", {
      d: annularSectorPath(RADII.solarOuter, RADII.zodiacOuter, sign.start + .15, sign.end - .15),
      class: "zodiac-sector",
      "data-zodiac-index": index
    }, zodiacTrack);
    addTitle(path, `${sign.name} · ${sign.element} · ${sign.modality}`);
    zodiacSectorNodes.push(path);

    const angle = sign.start + 15;
    const point = polar((RADII.solarOuter + RADII.zodiacOuter) / 2, angle);
    const label = svgEl("text", {
      x: point.x,
      y: point.y,
      class: "zodiac-label",
      transform: `rotate(${angle + 90} ${point.x} ${point.y})`
    }, zodiacTrack);
    label.textContent = sign.name;
  });
}

function renderCursor() {
  const cursorLayer = document.querySelector("#cursor-layer");
  const inner = polar(RADII.inner - 12, CURSOR_ANGLE);
  const outer = polar(RADII.zodiacOuter + 12, CURSOR_ANGLE);
  svgEl("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-halo" }, cursorLayer);
  svgEl("line", { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: "cursor-line" }, cursorLayer);
  const cap = polar(RADII.zodiacOuter + 21, CURSOR_ANGLE);
  svgEl("path", {
    d: `M ${cap.x - 6} ${cap.y - 1} L ${cap.x + 6} ${cap.y - 1} L ${cap.x} ${cap.y + 10} Z`,
    class: "cursor-cap"
  }, cursorLayer);
  const label = polar(RADII.zodiacOuter + 40, CURSOR_ANGLE);
  const text = svgEl("text", { x: label.x, y: label.y, class: "cursor-note" }, cursorLayer);
  text.textContent = "SELECTED INSTANT";
}

function setActiveSector(nodes, index) {
  nodes.forEach((node, nodeIndex) => node.classList.toggle("is-active", nodeIndex === index));
}

function alignCycleRing(key, index) {
  const runtime = ringRuntime[key];
  if (index < 0) return;
  if (runtime.rotation === null || runtime.lastIndex === null) {
    runtime.rotation = CURSOR_ANGLE - (index * 6 + 3);
  } else {
    runtime.rotation -= shortestCycleDelta(index, runtime.lastIndex) * 6;
  }
  runtime.lastIndex = index;
  runtime.group.setAttribute("transform", `rotate(${runtime.rotation.toFixed(4)} ${CX} ${CY})`);
  setActiveSector(runtime.sectors, index);
}

function alignLongitudeTracks(longitude) {
  if (solarRotation === null || lastSolarLongitude === null) {
    solarRotation = CURSOR_ANGLE - longitude;
  } else {
    solarRotation -= shortestAngleDelta(longitude, lastSolarLongitude);
  }
  lastSolarLongitude = longitude;
  const transform = `rotate(${solarRotation.toFixed(4)} ${CX} ${CY})`;
  solarTrack.setAttribute("transform", transform);
  zodiacTrack.setAttribute("transform", transform);
  setActiveSector(termSectorNodes, Math.floor(normalizeDegrees(longitude) / 15) % 24);
  setActiveSector(zodiacSectorNodes, Math.floor(normalizeDegrees(longitude) / 30) % 12);
}

function fieldsFromInstant(ms) {
  const shifted = new Date(ms + UTC_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
}

function instantFromLocalInput(value) {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d, h, min] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0) - UTC_OFFSET_HOURS * 3_600_000;
}

function inputValueFromFields(fields) {
  const pad = value => String(value).padStart(2, "0");
  const year = String(fields.year).padStart(4, "0");
  return `${year}-${pad(fields.month)}-${pad(fields.day)}T${pad(fields.hour)}:${pad(fields.minute)}`;
}

function formatCivil(fields) {
  const pad = value => String(value).padStart(2, "0");
  return `${fields.year}-${pad(fields.month)}-${pad(fields.day)} · ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

function rangeContains(start, end, angle) {
  const normalized = normalizeDegrees(angle);
  if (end > start) return normalized >= start && normalized < end;
  return normalized >= start || normalized < end;
}

function baziMonthAt(longitude) {
  return baziMonths.find(month => rangeContains(month.start, month.end, longitude));
}

function zodiacAt(longitude) {
  return zodiacSigns.find(sign => rangeContains(sign.start, sign.end, longitude));
}

function termAt(longitude) {
  return solarTerms[Math.floor(normalizeDegrees(longitude) / 15) % 24];
}

function midpoint(start, end) {
  const span = normalizeDegrees(end - start);
  return normalizeDegrees(start + span / 2);
}

function nearestCycleIndexForBranch(branch, preferredIndex) {
  const candidates = SEXAGENARY
    .map((name, index) => ({ name, index }))
    .filter(item => item.name.endsWith(branch));
  return candidates.reduce((best, candidate) => {
    const distance = Math.abs(shortestCycleDelta(candidate.index, preferredIndex));
    return !best || distance < best.distance ? { index: candidate.index, distance } : best;
  }, null)?.index ?? preferredIndex;
}

function parseLegacyProjection() {
  const params = new URLSearchParams(location.search);
  if (params.has("instant")) {
    const instant = Date.parse(params.get("instant"));
    if (Number.isFinite(instant)) {
      state.anchorMs = instant;
      state.selectedMs = instant;
      return;
    }
  }

  const rawLongitude = params.has("lambda") ? Number(params.get("lambda")) : Number.NaN;
  const requestedMonth = params.get("month");
  const yearStem = params.get("yearStem");
  let longitude = Number.isFinite(rawLongitude) ? normalizeDegrees(rawLongitude) : null;
  let monthBranch = baziMonths.some(month => month.branch === requestedMonth) ? requestedMonth : null;

  if (longitude === null && monthBranch) {
    const month = baziMonths.find(item => item.branch === monthBranch);
    longitude = midpoint(month.start, month.end);
  }
  if (longitude !== null && !monthBranch) monthBranch = baziMonthAt(longitude)?.branch ?? null;
  if (longitude === null && !monthBranch) return;

  let monthPillar = null;
  if (yearStem && STEMS.includes(yearStem) && monthBranch) {
    monthPillar = monthPillarForYearStem(yearStem, monthBranch);
  }
  state.legacyProjection = { longitude, monthBranch, yearStem, monthPillar };
  document.body.classList.add("legacy-projection");
}

function clearLegacyProjection() {
  if (!state.legacyProjection) return;
  state.legacyProjection = null;
  document.body.classList.remove("legacy-projection");
  history.replaceState({}, "", location.pathname);
}

function resolveDisplayState() {
  const fields = fieldsFromInstant(state.selectedMs);
  const result = resolveBirthPillars(fields, {
    utcOffsetHours: UTC_OFFSET_HOURS,
    dayBoundary: DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  });
  const actualLongitude = apparentSolarLongitude(fields, UTC_OFFSET_HOURS);
  const longitude = state.legacyProjection?.longitude ?? actualLongitude;

  const yearName = result.pillars.year.name;
  let monthName = result.pillars.month.name;
  let monthBranch = result.pillars.month.branch;
  if (state.legacyProjection?.monthBranch) monthBranch = state.legacyProjection.monthBranch;
  if (state.legacyProjection?.monthPillar) monthName = state.legacyProjection.monthPillar;

  let monthIndex = ganzhiIndex(monthName);
  if (monthIndex < 0 || !monthName.endsWith(monthBranch)) {
    monthIndex = nearestCycleIndexForBranch(monthBranch, ganzhiIndex(result.pillars.month.name));
    monthName = SEXAGENARY[monthIndex];
  }

  return {
    fields,
    longitude,
    actualLongitude,
    pillars: result.pillars,
    yearName,
    monthName,
    monthBranch,
    monthIndex,
    yearIndex: ganzhiIndex(yearName),
    dayIndex: ganzhiIndex(result.pillars.day.name),
    activeTerm: termAt(longitude),
    activeZodiac: zodiacAt(longitude)
  };
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function updateReadout(display) {
  const { fields, longitude, pillars, yearName, monthName, activeTerm, activeZodiac } = display;
  setText("instant-readout", `${formatCivil(fields)} · UTC+08:00`);
  setText("solar-readout", `${longitude.toFixed(3)}°`);
  setText("term-readout", activeTerm.name);
  setText("year-active", yearName);
  setText("month-active", monthName);
  setText("day-active", pillars.day.name);
  setText("solar-active", `${activeTerm.name} ${longitude.toFixed(1)}°`);
  setText("zodiac-active", activeZodiac.name);

  setText("state-year", yearName);
  setText("state-month", monthName);
  setText("state-day", pillars.day.name);
  setText("state-hour", pillars.hour.name);
  setText("state-zodiac", activeZodiac.name);
  setText("state-term", activeTerm.name);

  instrument.dataset.yearPillar = yearName;
  instrument.dataset.monthPillar = monthName;
  instrument.dataset.dayPillar = pillars.day.name;
  instrument.dataset.hourPillar = pillars.hour.name;
  instrument.dataset.solarLongitude = longitude.toFixed(6);
  instrument.dataset.term = activeTerm.name;
  instrument.dataset.zodiac = activeZodiac.name;

  if (state.legacyProjection) {
    instrument.dataset.projectionMode = "legacy-longitude";
    instrument.dataset.projectionLongitude = longitude.toFixed(6);
    if (state.legacyProjection.monthBranch) instrument.dataset.focusMonth = state.legacyProjection.monthBranch;
    if (state.legacyProjection.yearStem) instrument.dataset.yearStem = state.legacyProjection.yearStem;
  } else {
    delete instrument.dataset.projectionMode;
    delete instrument.dataset.projectionLongitude;
    delete instrument.dataset.focusMonth;
    delete instrument.dataset.yearStem;
  }

  if (document.activeElement !== instantInput) instantInput.value = inputValueFromFields(fields);
}

function updateWheel() {
  const display = resolveDisplayState();
  alignCycleRing("year", display.yearIndex);
  alignCycleRing("month", display.monthIndex);
  alignCycleRing("day", display.dayIndex);
  alignLongitudeTracks(display.longitude);
  updateReadout(display);
}

function setSliderForScale() {
  const config = SCALE_CONFIG[state.scale];
  slider.min = String(-config.spanDays);
  slider.max = String(config.spanDays);
  slider.step = String(config.sliderStep);
  slider.value = String((state.selectedMs - state.anchorMs) / DAY_MS);
  setText("slider-left", `−${config.edgeLabel}`);
  setText("slider-right", `+${config.edgeLabel}`);
  setText("scale-readout", config.label);
  scaleButtons.forEach(button => button.classList.toggle("active", button.dataset.scale === state.scale));
}

function stopPlayback() {
  state.playing = false;
  state.lastAnimationTs = null;
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
  playButton.textContent = "播放";
  playButton.setAttribute("aria-pressed", "false");
}

function animationTick(timestamp) {
  if (!state.playing) return;
  if (state.lastAnimationTs !== null) {
    const elapsedSeconds = Math.min((timestamp - state.lastAnimationTs) / 1000, .1);
    const config = SCALE_CONFIG[state.scale];
    state.selectedMs += elapsedSeconds * config.playDaysPerSecond * DAY_MS;
    const offsetDays = (state.selectedMs - state.anchorMs) / DAY_MS;
    if (offsetDays >= config.spanDays) {
      state.selectedMs = state.anchorMs + config.spanDays * DAY_MS;
      slider.value = String(config.spanDays);
      updateWheel();
      stopPlayback();
      return;
    }
    slider.value = String(offsetDays);
    updateWheel();
  }
  state.lastAnimationTs = timestamp;
  state.animationFrame = requestAnimationFrame(animationTick);
}

function startPlayback() {
  clearLegacyProjection();
  state.playing = true;
  state.lastAnimationTs = null;
  playButton.textContent = "暫停";
  playButton.setAttribute("aria-pressed", "true");
  state.animationFrame = requestAnimationFrame(animationTick);
}

function bindControls() {
  scaleButtons.forEach(button => {
    button.addEventListener("click", () => {
      stopPlayback();
      clearLegacyProjection();
      state.scale = button.dataset.scale;
      state.anchorMs = state.selectedMs;
      setSliderForScale();
      updateWheel();
    });
  });

  slider.addEventListener("input", () => {
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = state.anchorMs + Number(slider.value) * DAY_MS;
    updateWheel();
  });

  playButton.addEventListener("click", () => {
    if (state.playing) stopPlayback();
    else startPlayback();
  });

  nowButton.addEventListener("click", () => {
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = Date.now();
    state.anchorMs = state.selectedMs;
    setSliderForScale();
    updateWheel();
  });

  instantInput.addEventListener("change", () => {
    const instant = instantFromLocalInput(instantInput.value);
    if (instant === null || !Number.isFinite(instant)) return;
    stopPlayback();
    clearLegacyProjection();
    state.selectedMs = instant;
    state.anchorMs = instant;
    setSliderForScale();
    updateWheel();
  });
}

function initialize() {
  renderGuides();
  renderCycleRing("year");
  renderCycleRing("month");
  renderCycleRing("day");
  renderSolarRing();
  renderZodiacRing();
  renderCursor();
  parseLegacyProjection();
  setSliderForScale();
  bindControls();
  updateWheel();
}

initialize();
