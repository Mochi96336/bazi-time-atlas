// Research reading figures (review 2026-11-21): one figure per step.
//   01 · three cycle dials — which of the three counters are back at the start
//        after 1,200 / 1,980 / 8,000 / 24,000 years.
//   03 · Earth-rotation uncertainty — how wide the 1σ ΔT range grows against
//        one double-hour and one day.
// Pure presentation: the arithmetic is integer calendar maths and the ΔT
// uncertainty comes from src/astronomy/deep-time-earth-rotation.js.
import { futureDeltaTOneSigmaSeconds } from "./astronomy/deep-time-earth-rotation.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BASE = Object.freeze({ year: 2026, month: 9, day: 13 });
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

/** Days from 0000-03-01-style epoch (proleptic Gregorian). */
export function dayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

const shortest = (value, period) => {
  const r = ((value % period) + period) % period;
  return r > period / 2 ? r - period : r;
};

/** Phase of each counter after `years`, measured from BASE on the same month/day. */
export function cyclePhases(years) {
  const days = dayNumber(BASE.year + years, BASE.month, BASE.day) - dayNumber(BASE.year, BASE.month, BASE.day);
  return Object.freeze({
    years,
    days,
    year: Object.freeze({ offset: shortest(years, 60), period: 60, unit: "年" }),
    day: Object.freeze({ offset: shortest(days, 60), period: 60, unit: "天" }),
    gregorian: Object.freeze({ offset: shortest(years, 400), period: 400, unit: "年" })
  });
}

export const CYCLE_MILESTONES = Object.freeze([1200, 1980, 8000, 24000]);

const DIALS = Object.freeze([
  { key: "year", name: "年柱", note: "60 年一輪" },
  { key: "day", name: "日柱", note: "60 天一輪" },
  { key: "gregorian", name: "公曆", note: "400 年一輪" }
]);

export function milestoneSentence(phases) {
  const aligned = DIALS.filter(dial => phases[dial.key].offset === 0).map(dial => dial.name);
  const missing = DIALS.filter(dial => phases[dial.key].offset !== 0);
  const years = phases.years.toLocaleString("en-US");
  if (!missing.length) return `${years} 年後：三個都回到起點。這就是曆法上的 24,000 年。`;
  const gap = missing.map(dial => `${dial.name}還差 ${Math.abs(phases[dial.key].offset)} ${phases[dial.key].unit}`).join("、");
  return `${years} 年後：${aligned.join("、")}回到起點，但${gap}。`;
}

function polar(cx, cy, r, turn) {
  const angle = turn * Math.PI * 2 - Math.PI / 2;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function arcPath(cx, cy, r, fromTurn, toTurn) {
  if (Math.abs(toTurn - fromTurn) < 1e-6) return "";
  const [x0, y0] = polar(cx, cy, r, fromTurn);
  const [x1, y1] = polar(cx, cy, r, toTurn);
  const large = Math.abs(toTurn - fromTurn) > 0.5 ? 1 : 0;
  const sweep = toTurn > fromTurn ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function installCycleDials() {
  const root = document.querySelector("#research-cycle-dials");
  if (!root) return;
  const stage = root.querySelector(".cycle-dials-stage");
  const sentence = root.querySelector("#cycle-dials-sentence");
  const buttons = [...root.querySelectorAll("[data-cycle-milestone]")];
  const dials = new Map();

  for (const dial of DIALS) {
    const cell = document.createElement("div");
    cell.className = "cycle-dial";
    cell.dataset.dial = dial.key;
    const svg = el("svg", { viewBox: "0 0 160 160", "aria-hidden": "true" });
    el("circle", { class: "cycle-dial-track", cx: 80, cy: 80, r: 62 }, svg);
    for (let i = 0; i < 12; i += 1) {
      const [x0, y0] = polar(80, 80, 56, i / 12);
      const [x1, y1] = polar(80, 80, 62, i / 12);
      el("line", { class: "cycle-dial-tick", x1: x0, y1: y0, x2: x1, y2: y1 }, svg);
    }
    const gap = el("path", { class: "cycle-dial-gap" }, svg);
    const [sx, sy] = polar(80, 80, 62, 0);
    el("line", { class: "cycle-dial-start", x1: sx, y1: sy - 9, x2: sx, y2: sy + 9 }, svg);
    const hand = el("line", { class: "cycle-dial-hand", x1: 80, y1: 80, x2: 80, y2: 18 }, svg);
    const dot = el("circle", { class: "cycle-dial-dot", cx: 80, cy: 18, r: 7 }, svg);
    el("circle", { class: "cycle-dial-hub", cx: 80, cy: 80, r: 4 }, svg);
    const label = document.createElement("div");
    label.className = "cycle-dial-label";
    label.innerHTML = `<strong>${dial.name}</strong><small>${dial.note}</small><b class="cycle-dial-status">—</b>`;
    cell.append(svg, label);
    stage.append(cell);
    dials.set(dial.key, { cell, gap, hand, dot, status: label.querySelector(".cycle-dial-status"), turn: 0 });
  }

  let frame = 0;
  function draw(key, turn) {
    const dial = dials.get(key);
    dial.turn = turn;
    const [x, y] = polar(80, 80, 62, turn);
    dial.hand.setAttribute("x2", x.toFixed(2));
    dial.hand.setAttribute("y2", y.toFixed(2));
    dial.dot.setAttribute("cx", x.toFixed(2));
    dial.dot.setAttribute("cy", y.toFixed(2));
    dial.gap.setAttribute("d", arcPath(80, 80, 62, Math.min(0, turn), Math.max(0, turn)));
  }

  function select(years, { animate = true } = {}) {
    const phases = cyclePhases(years);
    cancelAnimationFrame(frame);
    const targets = DIALS.map(dial => [dial.key, phases[dial.key].offset / phases[dial.key].period]);
    for (const dial of DIALS) {
      const { offset, unit } = phases[dial.key];
      const view = dials.get(dial.key);
      view.cell.dataset.aligned = String(offset === 0);
      view.status.textContent = offset === 0 ? "✓ 回到起點" : `差 ${Math.abs(offset)} ${unit}`;
    }
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.cycleMilestone) === years));
    }
    sentence.textContent = milestoneSentence(phases);
    root.dataset.years = String(years);
    if (!animate || reduceMotion()) {
      for (const [key, turn] of targets) draw(key, turn);
      return;
    }
    const from = new Map(targets.map(([key]) => [key, dials.get(key).turn]));
    const start = performance.now();
    const duration = 650;
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      for (const [key, turn] of targets) draw(key, from.get(key) + (turn - from.get(key)) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => select(Number(button.dataset.cycleMilestone)));
  }
  select(Number(root.dataset.defaultYears ?? 1980), { animate: false });
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

if (typeof document !== "undefined") {
  installCycleDials();
  installRotationUncertainty();
  relocateEvidenceSupport();
}
