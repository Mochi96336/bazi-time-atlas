import "./app.js";
import { baziMonths } from "./data.js";
import { polar } from "./geometry.js";

const NS = "http://www.w3.org/2000/svg";
const cx = 430;
const cy = 430;
const params = new URLSearchParams(window.location.search);
const requestedMonth = params.get("month");
const requestedLongitude = Number(params.get("lambda"));
const hasLongitude = params.has("lambda") && Number.isFinite(requestedLongitude) && requestedLongitude >= 0 && requestedLongitude <= 360;
const longitude = hasLongitude ? ((requestedLongitude % 360) + 360) % 360 : null;

function rangeContains(start, end, angle) {
  if (end < start) return angle >= start || angle < end;
  return angle >= start && angle < end;
}

function monthAtLongitude(angle) {
  return baziMonths.find(month => rangeContains(month.start, month.end, angle));
}

function selectMonth(branch) {
  if (!baziMonths.some(month => month.branch === branch)) return false;
  const target = document.querySelector(
    `[data-select-type="month"][data-select-key="${branch}"]`
  );
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  return Boolean(target);
}

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function renderBirthProjection(angle) {
  const svg = document.querySelector("#atlas-wheel");
  if (!svg) return;

  const previous = svg.querySelector("[data-birth-projection]");
  previous?.remove();

  const group = svgEl("g", {
    class: "birth-projection",
    "data-birth-projection": angle.toFixed(6),
    "aria-label": `出生瞬間太陽黃經 ${angle.toFixed(2)} 度`
  }, svg);

  const inner = polar(cx, cy, 80, angle);
  const outer = polar(cx, cy, 420, angle);
  const monthPoint = polar(cx, cy, 190, angle);

  svgEl("line", {
    x1: inner.x,
    y1: inner.y,
    x2: outer.x,
    y2: outer.y,
    class: "birth-projection-ray"
  }, group);
  svgEl("circle", {
    cx: monthPoint.x,
    cy: monthPoint.y,
    r: 7,
    class: "birth-projection-month-point"
  }, group);
  svgEl("circle", {
    cx: outer.x,
    cy: outer.y,
    r: 9,
    class: "birth-projection-cap"
  }, group);

  const inspector = document.querySelector("#inspector");
  const facts = document.querySelector("#detail-facts");
  if (inspector && facts) {
    inspector.querySelector(".birth-projection-readout")?.remove();
    const readout = document.createElement("div");
    readout.className = "birth-projection-readout";
    readout.innerHTML = `<span>出生瞬間</span><strong>λ ${angle.toFixed(2)}°</strong><small>精確太陽黃經 · UTC offset 已於 Birth view 套用</small>`;
    facts.insertAdjacentElement("afterend", readout);
  }

  const existingLabel = svg.getAttribute("aria-label") ?? "年度圓盤";
  svg.setAttribute("aria-label", `${existingLabel}；出生瞬間太陽黃經 ${angle.toFixed(2)} 度`);
}

if (longitude !== null) {
  const derivedMonth = monthAtLongitude(longitude);
  if (derivedMonth) selectMonth(derivedMonth.branch);
  renderBirthProjection(longitude);
} else {
  selectMonth(requestedMonth);
}
