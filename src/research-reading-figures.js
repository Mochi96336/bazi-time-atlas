// Research reading figures (review 2026-11-21): one figure per step.
//   01 · cycle fan — the home page's vocabulary: a fixed gold needle marks the
//        start, and three rings (年柱 · 公曆 · 日柱) turn underneath it. After N
//        years the cell under the needle is where each cycle has got to; the
//        gold-outlined start cell shows how far it still is from coming back.
//        Each ring counts in its own unit (1 cell = 1 year / 10 years / 1 day).
//   lab · the same fan with a start date, any number of years, and shortcuts.
//   03 · Earth-rotation uncertainty — how wide the 1σ ΔT range grows against
//        one double-hour and one day.
// Pure presentation: the arithmetic is integer calendar maths and the ΔT
// uncertainty comes from src/astronomy/deep-time-earth-rotation.js.
import { futureDeltaTOneSigmaSeconds } from "./astronomy/deep-time-earth-rotation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
export const BASE = Object.freeze({ year: 2026, month: 9, day: 13 });
const BASE_DAY_INDEX = 26; // 2026-09-13 is 庚寅
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const mod = (value, period) => ((value % period) + period) % period;
const fmt = value => value.toLocaleString("en-US");

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

/** Julian day number of a proleptic Gregorian date. */
export function dayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

const isLeap = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const sexagenaryName = index => STEMS[mod(index, 10)] + BRANCHES[mod(index, 12)];

/** Year pillar index (甲子 = 0). The year turns at 立春, taken here as 4 February. */
export function yearPillarIndex({ year, month, day }) {
  const pillarYear = month < 2 || (month === 2 && day < 4) ? year - 1 : year;
  return mod(pillarYear - 4, 60);
}

/** Day pillar index (甲子 = 0), anchored on 2026-09-13 = 庚寅. */
export function dayPillarIndex({ year, month, day }) {
  return mod(dayNumber(year, month, day) - dayNumber(BASE.year, BASE.month, BASE.day) + BASE_DAY_INDEX, 60);
}

/** The same month and day `years` later (29 February falls back to the 28th). */
export function laterDate(start, years) {
  const year = start.year + years;
  const day = start.month === 2 && start.day === 29 && !isLeap(year) ? 28 : start.day;
  return Object.freeze({ year, month: start.month, day });
}

const shortest = (value, period) => {
  const r = mod(value, period);
  return r > period / 2 ? r - period : r;
};

/** Where each counter stands after `years`, measured from `start` on the same month/day. */
export function cyclePhases(years, start = BASE) {
  const target = laterDate(start, years);
  const days = dayNumber(target.year, target.month, target.day) - dayNumber(start.year, start.month, start.day);
  return Object.freeze({
    years,
    days,
    start,
    target,
    year: Object.freeze({ offset: shortest(years, 60), period: 60, unit: "年", from: yearPillarIndex(start), to: yearPillarIndex(target) }),
    day: Object.freeze({ offset: shortest(days, 60), period: 60, unit: "天", from: dayPillarIndex(start), to: dayPillarIndex(target) }),
    gregorian: Object.freeze({ offset: shortest(years, 400), period: 400, unit: "年", from: 0, to: mod(years, 400) })
  });
}

/** First positive number of years after which the year and day pillars are both back. */
export function nextYearDayReturn(start = BASE) {
  for (let years = 60; years <= 24000; years += 60) {
    if (cyclePhases(years, start).day.offset === 0) return years;
  }
  return 24000;
}

export const CYCLE_MILESTONES = Object.freeze([1200, 1980, 8000, 24000]);

const RINGS = Object.freeze([
  { key: "year", name: "年柱", note: "60 年一圈 · 1 格＝1 年", cells: 60 },
  { key: "gregorian", name: "公曆", note: "400 年一圈 · 1 格＝10 年", cells: 40 },
  { key: "day", name: "日柱", note: "60 天一圈 · 1 格＝1 天", cells: 60 }
]);

function gapText(phase) {
  const amount = `${Math.abs(phase.offset)} ${phase.unit}`;
  return phase.offset < 0 ? `還差 ${amount}` : `多走了 ${amount}`;
}

export function milestoneSentence(phases) {
  const aligned = RINGS.filter(ring => phases[ring.key].offset === 0).map(ring => ring.name);
  const missing = RINGS.filter(ring => phases[ring.key].offset !== 0);
  const years = fmt(phases.years);
  if (phases.years === 0) return "還沒出發：三圈都停在起點。";
  if (!missing.length) return `${years} 年後：三個都回到起點。`;
  const gap = missing.map(ring => `${ring.name}${gapText(phases[ring.key])}`).join("、");
  if (!aligned.length) return `${years} 年後：三個都不在起點，${gap}。`;
  return `${years} 年後：${aligned.join("、")}回到起點，但${gap}。`;
}

const formatDate = ({ year, month, day }) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/* ---------- the fan ---------- */

// 0° is straight up, clockwise positive (the home wheel's convention).
function polar(cx, cy, r, degrees) {
  const a = (degrees * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

function sectorPath(cx, cy, r0, r1, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const p = (r, a) => polar(cx, cy, r, a).map(v => v.toFixed(2)).join(" ");
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

function arcPath(cx, cy, r, a0, a1) {
  if (Math.abs(a1 - a0) < 0.01) return "";
  const [from, to] = a0 < a1 ? [a0, a1] : [a1, a0];
  const p = a => polar(cx, cy, r, a).map(v => v.toFixed(2)).join(" ");
  return `M ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)}`;
}

const VISIBLE_DEGREES = 125; // how far round each side of the needle the fan shows

/**
 * Builds a cycle fan inside `host`. Returns `show(phases, { animate })`.
 * The rings turn under a fixed needle exactly like the home wheel.
 */
export function createCycleFan(host) {
  host.classList.add("cycle-fan");
  const svg = el("svg", { class: "cycle-fan-svg", role: "img" });
  const rows = document.createElement("div");
  rows.className = "cycle-fan-rows";
  const rowViews = new Map();
  for (const ring of RINGS) {
    const row = document.createElement("div");
    row.className = "cycle-fan-row";
    row.dataset.ring = ring.key;
    row.innerHTML = `<span class="cycle-fan-name"><i aria-hidden="true"></i><strong>${ring.name}</strong><small>${ring.note}</small></span><span class="cycle-fan-pair">—</span><b class="cycle-fan-status">—</b>`;
    rows.append(row);
    rowViews.set(ring.key, { row, pair: row.querySelector(".cycle-fan-pair"), status: row.querySelector(".cycle-fan-status") });
  }
  host.append(svg, rows);

  let layout = null;
  let current = null;
  const shown = new Map(RINGS.map(ring => [ring.key, 0]));
  let frame = 0;

  function build() {
    const width = Math.max(300, Math.round(host.getBoundingClientRect().width || 860));
    const narrow = width < 560;
    const R = Math.min(width / 2 - (narrow ? 4 : 16), 340);
    const top = narrow ? 22 : 30;
    const cx = width / 2;
    const cy = top + R;
    const height = Math.round(cy + R * Math.cos(((180 - VISIBLE_DEGREES) * Math.PI) / 180) + 6);
    const bands = narrow
      ? { year: [R * 0.76, R], gregorian: [R * 0.63, R * 0.73], day: [R * 0.37, R * 0.6] }
      : { year: [R * 0.8, R], gregorian: [R * 0.69, R * 0.77], day: [R * 0.47, R * 0.66] };
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const defs = el("defs", {}, svg);
    const fadeId = `cycle-fan-fade-${Math.random().toString(36).slice(2, 8)}`;
    const gradient = el("linearGradient", { id: fadeId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: (cy / height).toFixed(3), "stop-color": "#fff", "stop-opacity": 1 }, gradient);
    el("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }, gradient);
    const mask = el("mask", { id: `${fadeId}-m` }, defs);
    el("rect", { x: 0, y: 0, width, height, fill: `url(#${fadeId})` }, mask);
    const body = el("g", { mask: `url(#${fadeId}-m)` }, svg);
    // labels sit above the needle (with a halo), cells below it — as on the home wheel
    const needleLayer = el("g", { class: "cycle-fan-needle-layer" }, svg);
    const labelBody = el("g", { mask: `url(#${fadeId}-m)` }, svg);

    const rings = new Map();
    for (const ring of RINGS) {
      const [r0, r1] = bands[ring.key];
      const step = 360 / ring.cells;
      const group = el("g", { class: "cycle-fan-ring", "data-ring": ring.key }, body);
      const labels = el("g", { class: "cycle-fan-ring cycle-fan-ring-labels", "data-ring": ring.key }, labelBody);
      const cells = [];
      for (let i = 0; i < ring.cells; i += 1) {
        const centre = i * step;
        const cell = el("path", { class: "cycle-fan-cell", d: sectorPath(cx, cy, r0, r1, centre - step / 2, centre + step / 2) }, group);
        let label = null;
        const gregorianLabel = ring.key === "gregorian" && i % 10 === 0;
        if (ring.key !== "gregorian" || gregorianLabel) {
          // luopan style: stem above branch along the radius, one glyph wide
          const mid = (r0 + r1) / 2;
          label = el("g", { class: "cycle-fan-label", "data-mid": mid.toFixed(2) }, labels);
          const pitch = ring.key === "gregorian" ? 0 : narrow ? 7 : 8;
          const glyphs = ring.key === "gregorian" ? [0] : [-pitch, pitch];
          for (const dy of glyphs) el("text", { x: cx.toFixed(2), y: (cy - mid + dy).toFixed(2) }, label);
        }
        cells.push({ cell, label, centre });
      }
      rings.set(ring.key, { group, labels, cells, step, r0, r1, gap: el("path", { class: "cycle-fan-gap", "data-ring": ring.key }, body) });
    }

    // the needle: fixed, like the home wheel's cursor
    const needleTop = cy - R - (narrow ? 14 : 20);
    el("line", { class: "cycle-fan-needle", x1: cx, x2: cx, y1: needleTop + 6, y2: cy - bands.day[0] }, needleLayer);
    el("path", { class: "cycle-fan-needle-head", d: `M ${cx - 6} ${needleTop - 4} L ${cx + 6} ${needleTop - 4} L ${cx} ${needleTop + 7} Z` }, needleLayer);

    const centre = el("g", { class: "cycle-fan-centre" }, svg);
    const years = el("text", { class: "cycle-fan-years", x: cx, y: cy - (narrow ? R * 0.06 : R * 0.2) }, centre);
    const dates = el("text", { class: "cycle-fan-dates", x: cx, y: cy - R * 0.2 + 30 }, centre);
    host.dataset.narrow = String(narrow);
    layout = { width, narrow, cx, cy, R, rings, years, dates };
  }

  function paintRing(key, offset) {
    const ring = layout.rings.get(key);
    const spec = RINGS.find(item => item.key === key);
    const unitsPerCell = key === "gregorian" ? 10 : 1;
    const rotation = (-offset / unitsPerCell) * ring.step;
    const turn = `rotate(${rotation.toFixed(3)} ${layout.cx.toFixed(2)} ${layout.cy.toFixed(2)})`;
    ring.group.setAttribute("transform", turn);
    ring.labels.setAttribute("transform", turn);
    for (const { label, centre } of ring.cells) {
      if (!label) continue;
      const absolute = mod(centre + rotation, 360);
      const hidden = absolute > VISIBLE_DEGREES + 6 && absolute < 360 - VISIBLE_DEGREES - 6;
      label.style.visibility = hidden ? "hidden" : "";
      // minor labels fade away from the needle so the reading stays near it
      const distance = Math.min(absolute, 360 - absolute);
      const [near, span, floor] = layout.narrow ? [30, 40, 0] : [55, 70, 0.2];
      const key = label.classList.contains("is-minor");
      label.style.opacity = !key || distance <= near ? "" : String(Math.max(floor, 1 - (distance - near) / span).toFixed(2));
      const flip = absolute > 90 && absolute < 270;
      const pivotY = (layout.cy - Number(label.dataset.mid)).toFixed(2);
      label.setAttribute("transform", `rotate(${centre.toFixed(2)} ${layout.cx.toFixed(2)} ${layout.cy.toFixed(2)})${flip ? ` rotate(180 ${layout.cx.toFixed(2)} ${pivotY})` : ""}`);
    }
    const radius = ring.r1 - (spec.key === "gregorian" ? 0 : 3);
    ring.gap.setAttribute("d", arcPath(layout.cx, layout.cy, radius, Math.max(-179, Math.min(179, rotation)), 0));
  }

  function label(phases) {
    for (const ring of RINGS) {
      const view = layout.rings.get(ring.key);
      const phase = phases[ring.key];
      const startCell = ring.key === "gregorian" ? 0 : phase.from;
      const targetCell = ring.key === "gregorian" ? Math.round(phase.to / 10) % 40 : phase.to;
      view.cells.forEach(({ cell, label: text }, i) => {
        // 60-pair rings: cell i is 干支 i placed relative to the start's 干支
        cell.classList.toggle("is-start", i === startCell);
        cell.classList.toggle("is-target", i === targetCell);
        if (!text) return;
        text.classList.toggle("is-start", i === startCell);
        text.classList.toggle("is-target", i === targetCell);
        text.classList.toggle("is-minor", i !== startCell && i !== targetCell);
        const glyphs = text.querySelectorAll("text");
        if (ring.key === "gregorian") glyphs[0].textContent = i === 0 ? "起點" : `+${i * 10}`;
        else {
          const name = sexagenaryName(i);
          glyphs[0].textContent = name[0];
          glyphs[1].textContent = name[1];
        }
      });
      if (ring.key !== "gregorian") {
        // place 干支 i so that the start's 干支 sits at angle 0 before rotating
        view.cells.forEach(({ cell, label: text }, i) => {
          const centre = mod(i - phase.from, ring.cells) * view.step;
          cell.setAttribute("d", sectorPath(layout.cx, layout.cy, view.r0, view.r1, centre - view.step / 2, centre + view.step / 2));
          view.cells[i].centre = centre;
        });
      }
      const row = rowViews.get(ring.key);
      row.row.dataset.aligned = String(phase.offset === 0);
      row.pair.textContent = ring.key === "gregorian"
        ? `${phases.start.year} → ${phases.target.year}`
        : `${sexagenaryName(phase.from)} → ${sexagenaryName(phase.to)}`;
      row.status.textContent = phase.offset === 0 ? "✓ 回到起點" : gapText(phase);
    }
    layout.years.textContent = phases.years === 0 ? "起點" : `+${fmt(phases.years)} 年`;
    layout.dates.textContent = `${formatDate(phases.start)} → ${formatDate(phases.target)}`;
    svg.setAttribute("aria-label", milestoneSentence(phases));
    host.dataset.years = String(phases.years);
    host.dataset.aligned = RINGS.filter(ring => phases[ring.key].offset === 0).map(ring => ring.key).join(" ");
  }

  function show(phases, { animate = true } = {}) {
    current = phases;
    cancelAnimationFrame(frame);
    label(phases);
    const targets = RINGS.map(ring => [ring.key, phases[ring.key].offset]);
    if (!animate || reduceMotion()) {
      for (const [key, offset] of targets) { shown.set(key, offset); paintRing(key, offset); }
      return;
    }
    const from = new Map(shown);
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / 650);
      const eased = 1 - (1 - t) ** 3;
      for (const [key, offset] of targets) {
        const value = from.get(key) + (offset - from.get(key)) * eased;
        shown.set(key, value);
        paintRing(key, value);
      }
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  build();
  let lastWidth = layout.width;
  let pending = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const width = Math.max(300, Math.round(host.getBoundingClientRect().width || 860));
      if (width === lastWidth || !current) return;
      lastWidth = width;
      build();
      label(current);
      for (const ring of RINGS) paintRing(ring.key, shown.get(ring.key));
    });
  }).observe(host);
  return { show };
}

/* ---------- 01 · fixed start, four milestones ---------- */

function installCycleFan() {
  const root = document.querySelector("#research-cycle-fan");
  if (!root) return;
  const fan = createCycleFan(root.querySelector(".cycle-fan-stage"));
  const sentence = root.querySelector("#cycle-fan-sentence");
  const buttons = [...root.querySelectorAll("[data-cycle-milestone]")];
  const select = (years, options) => {
    const phases = cyclePhases(years);
    fan.show(phases, options);
    sentence.textContent = milestoneSentence(phases);
    for (const button of buttons) button.setAttribute("aria-pressed", String(Number(button.dataset.cycleMilestone) === years));
    root.dataset.years = String(years);
  };
  for (const button of buttons) button.addEventListener("click", () => select(Number(button.dataset.cycleMilestone)));
  select(Number(root.dataset.defaultYears ?? 1980), { animate: false });
  root.dataset.ready = "true";
}

/* ---------- lab · any start date, any number of years ---------- */

const MAX_LAB_YEARS = 24000;

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Object.freeze({ year, month, day });
}

function installLabFan() {
  const root = document.querySelector("#research-lab-fan");
  if (!root) return;
  const fan = createCycleFan(root.querySelector(".cycle-fan-stage"));
  const dateInput = root.querySelector("#lab-fan-start");
  const yearsInput = root.querySelector("#lab-fan-years");
  const slider = root.querySelector("#lab-fan-slider");
  const sentence = root.querySelector("#lab-fan-sentence");
  const nextButton = root.querySelector("[data-lab-jump='next']");
  const nextLabel = root.querySelector("#lab-fan-next-years");
  const jumps = [...root.querySelectorAll("[data-lab-jump]")];
  let start = BASE;
  let years = 0;
  let nextYears = nextYearDayReturn(start);

  const update = ({ animate = true } = {}) => {
    const phases = cyclePhases(years, start);
    fan.show(phases, { animate });
    sentence.textContent = milestoneSentence(phases);
    yearsInput.value = String(years);
    slider.value = String(years);
    nextLabel.textContent = `${fmt(nextYears)} 年`;
    nextButton.dataset.labYears = String(nextYears);
    for (const button of jumps) button.setAttribute("aria-pressed", String(Number(button.dataset.labYears) === years));
    root.dataset.years = String(years);
  };
  const setYears = (value, options) => {
    const parsed = Math.round(Number(value));
    years = Number.isFinite(parsed) ? Math.max(0, Math.min(MAX_LAB_YEARS, parsed)) : 0;
    update(options);
  };

  dateInput.value = formatDate(start);
  dateInput.addEventListener("change", () => {
    const parsed = parseDate(dateInput.value);
    if (!parsed) { dateInput.value = formatDate(start); return; }
    start = parsed;
    nextYears = nextYearDayReturn(start);
    update();
  });
  yearsInput.addEventListener("change", () => setYears(yearsInput.value));
  slider.addEventListener("input", () => setYears(slider.value, { animate: false }));
  for (const button of jumps) button.addEventListener("click", () => setYears(button.dataset.labYears));
  update({ animate: false });
  root.dataset.ready = "true";
}

/* ---------- 03 · Earth-rotation uncertainty ---------- */

const ROTATION_START = 2026;
const ROTATION_END = 26026;
const SHICHEN_HOURS = 2;
const DAY_HOURS = 24;

/** Full width (2σ) of the ΔT range in hours at a decimal year. */
export function rotationRangeHours(year) {
  return (2 * futureDeltaTOneSigmaSeconds(year)) / 3600;
}

export function rotationCrossingYear(hours) {
  let lo = ROTATION_START;
  let hi = ROTATION_END;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (rotationRangeHours(mid) < hours) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2 / 100) * 100;
}

function installRotationUncertainty() {
  const figure = document.querySelector("#research-rotation-uncertainty");
  const svg = figure?.querySelector("svg");
  if (!svg) return;
  const shichenYear = rotationCrossingYear(SHICHEN_HOURS);
  const dayYear = rotationCrossingYear(DAY_HOURS);
  figure.dataset.shichenYear = String(shichenYear);
  figure.dataset.dayYear = String(dayYear);
  for (const node of figure.querySelectorAll("[data-rotation-year='shichen']")) node.textContent = shichenYear.toLocaleString("en-US");
  for (const node of figure.querySelectorAll("[data-rotation-year='day']")) node.textContent = dayYear.toLocaleString("en-US");
  const endDays = rotationRangeHours(ROTATION_END) / 2 / 24;
  for (const node of figure.querySelectorAll("[data-rotation-end]")) node.textContent = `±${endDays.toFixed(0)} 天`;

  const render = () => {
    const width = Math.max(320, Math.round(svg.getBoundingClientRect().width || 720));
    const narrow = width < 520;
    const height = narrow ? 300 : 340;
    const pad = { left: narrow ? 52 : 78, right: narrow ? 14 : 28, top: 24, bottom: 40 };
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const minLog = Math.log10(0.05);
    const maxLog = Math.log10(400);
    const x = year => pad.left + ((year - ROTATION_START) / (ROTATION_END - ROTATION_START)) * (width - pad.left - pad.right);
    const y = hours => pad.top + (1 - (Math.log10(Math.max(hours, 0.05)) - minLog) / (maxLog - minLog)) * (height - pad.top - pad.bottom);
    const bottom = height - pad.bottom;

    // zones: above one double-hour the Hour pillar is undecidable; above one day the Day pillar too
    el("rect", { class: "rotation-zone rotation-zone-hour", x: pad.left, y: y(DAY_HOURS), width: width - pad.left - pad.right, height: y(SHICHEN_HOURS) - y(DAY_HOURS) }, svg);
    el("rect", { class: "rotation-zone rotation-zone-day", x: pad.left, y: pad.top, width: width - pad.left - pad.right, height: y(DAY_HOURS) - pad.top }, svg);

    const grid = [[1 / 6, "10 分"], [SHICHEN_HOURS, "1 時辰"], [DAY_HOURS, "1 天"], [24 * 7, "1 週"]];
    for (const [hours, label] of grid) {
      const strong = hours === SHICHEN_HOURS || hours === DAY_HOURS;
      el("line", { class: `rotation-grid${strong ? " strong" : ""}`, x1: pad.left, x2: width - pad.right, y1: y(hours), y2: y(hours) }, svg);
      const text = el("text", { class: `rotation-axis${strong ? " strong" : ""}`, x: pad.left - 8, y: y(hours) + 4, "text-anchor": "end" }, svg);
      text.textContent = label;
    }
    const ticks = narrow ? [2026, 10026, 18026, 26026] : [2026, 6026, 10026, 14026, 18026, 22026, 26026];
    for (const year of ticks) {
      const text = el("text", { class: "rotation-axis", x: x(year), y: bottom + 24, "text-anchor": year === 2026 ? "start" : year === 26026 ? "end" : "middle" }, svg);
      text.textContent = String(year);
    }

    const samples = [];
    for (let i = 0; i <= 160; i += 1) {
      const year = ROTATION_START + 1 + ((ROTATION_END - ROTATION_START - 1) * i) / 160;
      samples.push([x(year), y(rotationRangeHours(year))]);
    }
    const line = samples.map(([px, py], i) => `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
    el("path", { class: "rotation-area", d: `${line} L ${samples.at(-1)[0].toFixed(1)} ${bottom} L ${samples[0][0].toFixed(1)} ${bottom} Z` }, svg);
    el("path", { class: "rotation-curve", d: line }, svg);

    const marks = [
      [shichenYear, SHICHEN_HOURS, `約 ${shichenYear} 年：時柱定不了`],
      [dayYear, DAY_HOURS, `約 ${dayYear} 年：日柱也定不了`]
    ];
    for (const [year, hours, label] of marks) {
      el("circle", { class: "rotation-mark", cx: x(year), cy: y(hours), r: 5 }, svg);
      const text = el("text", { class: "rotation-mark-label", x: x(year) + 10, y: y(hours) + (narrow ? 18 : 20) }, svg);
      text.textContent = label;
    }
    const endY = y(rotationRangeHours(ROTATION_END));
    el("circle", { class: "rotation-end", cx: x(ROTATION_END), cy: endY, r: 6 }, svg);
    const endLabel = el("text", { class: "rotation-mark-label strong", x: x(ROTATION_END) - 12, y: endY + 22, "text-anchor": "end" }, svg);
    endLabel.textContent = `26026 年：±${endDays.toFixed(0)} 天`;
  };

  render();
  let pending = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(render);
  }).observe(svg);
  figure.dataset.ready = "true";
}

/* The day/hour proof chain and the source audit follow the lab's Δ, so their
   disclosures live in the lab rather than under the 03 verdict. */
function relocateEvidenceSupport() {
  const source = document.querySelector("#research-evidence");
  const target = document.querySelector("#research-lab-evidence");
  if (!source || !target) return;
  const move = () => {
    for (const node of source.querySelectorAll(".research-evidence-support")) target.append(node);
  };
  move();
  new MutationObserver(move).observe(source, { childList: true, subtree: true });
}

/* A link into the researcher tools (e.g. #recurrence-instrument) opens them. */
function openLabToolsForHash() {
  const tools = document.querySelector("#research-lab-tools");
  if (!tools || !location.hash) return;
  let target = null;
  try { target = document.querySelector(decodeURIComponent(location.hash)); } catch { return; }
  if (target && tools.contains(target) && target !== tools && !tools.open) {
    tools.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }
}

if (typeof document !== "undefined") {
  openLabToolsForHash();
  window.addEventListener("hashchange", openLabToolsForHash);
  installCycleFan();
  installLabFan();
  installRotationUncertainty();
  relocateEvidenceSupport();
}
