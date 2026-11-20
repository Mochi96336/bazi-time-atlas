// Repair D5: "偏移是慢慢累積出來的" — Li Chun drift at the four source-backed
// epochs, so readers see the 10–14 day gap grows with time instead of being a
// fixed offset. Only real points are drawn; joining segments are dashed.
import { liChunDriftAccumulation } from "./research/li-chun-drift-accumulation.js";

const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("#research-drift-accumulation-svg");
const sentence = document.querySelector("#research-drift-accumulation-sentence");

function el(tag, attrs, parent, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function humanDays(value) {
  const abs = Math.abs(value);
  if (abs < 0.05) return "0 天";
  const rounded = abs < 1 ? abs.toFixed(1) : abs.toFixed(1);
  return value < 0 ? `提前 ${rounded} 天` : `延後 ${rounded} 天`;
}

const compactMedia = window.matchMedia("(max-width: 480px)");

function render() {
  svg.replaceChildren();
  const points = liChunDriftAccumulation();
  // Phones get their own narrower coordinate system so 14-15 px labels stay
  // >= 12 CSS px instead of shrinking with a desktop-width viewBox.
  const W = compactMedia.matches ? 400 : 720, H = compactMedia.matches ? 280 : 300;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const M = compactMedia.matches ? { left:52, right:16, top:36, bottom:52 } : { left:64, right:28, top:36, bottom:58 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const yMin = -12, yMax = 2;
  const x = delta => M.left + delta / 24000 * plotW;
  const y = days => M.top + (yMax - days) / (yMax - yMin) * plotH;

  const axes = el("g", { class:"rda-axes" }, svg);
  for (const tick of [0, -4, -8, -12]) {
    el("line", { x1:M.left, x2:W - M.right, y1:y(tick), y2:y(tick), class:tick === 0 ? "rda-zero" : "rda-grid" }, axes);
    el("text", { x:M.left - 10, y:y(tick), class:"rda-y-label" }, axes, tick === 0 ? "0 天" : `${Math.abs(tick)} 天`);
  }
  el("text", { x:M.left - 10, y:M.top - 18, class:"rda-y-title" }, axes, "提前");
  for (const tick of [0, 8000, 16000, 24000]) {
    const anchor = tick === 0 ? "start" : tick === 24000 ? "end" : "middle";
    if (compactMedia.matches && tick === 16000) continue;
    el("text", { x:x(tick), y:H - M.bottom + 24, class:"rda-x-label", "text-anchor":anchor }, axes, tick === 0 ? "現在" : `+${tick.toLocaleString("en-US")} 年`);
  }

  const path = points.map((point, index) => `${index ? "L" : "M"}${x(point.deltaYears).toFixed(1)} ${y(point.driftDays).toFixed(1)}`).join(" ");
  el("path", { d:path, class:"rda-link" }, svg);

  const marks = el("g", { class:"rda-points" }, svg);
  points.forEach((point, index) => {
    const g = el("g", { class:`rda-point${index === points.length - 1 ? " is-final" : ""}`, "data-delta-years":point.deltaYears }, marks);
    el("circle", { cx:x(point.deltaYears), cy:y(point.driftDays), r:index === points.length - 1 ? 7 : 5.5 }, g);
    // Label placement per epoch: the base sits below its point (the 1,980-year
    // point is close to it horizontally and labels above); the final point
    // labels above-left so it never meets the x-axis.
    const anchorEnd = point.deltaYears === 24000;
    const labelX = x(point.deltaYears) + (anchorEnd ? -14 : point.deltaYears === 0 ? -4 : 10);
    const labelY = point.deltaYears === 0 ? y(point.driftDays) + 26
      : anchorEnd ? y(point.driftDays) - 36
        : y(point.driftDays) + (point.driftDays > -1 ? -18 : 24);
    el("text", { x:labelX, y:labelY, class:"rda-value", "text-anchor":anchorEnd ? "end" : "start" }, g,
      point.deltaYears === 0 ? "2026 基準" : `${point.year} · ${humanDays(point.driftDays)}`);
    if (point.deltaYears) {
      el("text", { x:labelX, y:labelY + 16, class:"rda-source", "text-anchor":anchorEnd ? "end" : "start" }, g, point.source);
    }
  });

  const [, p1980, p8000, p24000] = points;
  if (sentence) {
    sentence.textContent =
      `1,980 年後立春只差${humanDays(p1980.driftDays).replace("延後 ", "約 ").replace("提前 ", "約 ")}，` +
      `8,000 年後${humanDays(p8000.driftDays)}，24,000 年後才${humanDays(p24000.driftDays)}：差距是越來越快地累積出來的。`;
  }
  svg.dataset.ready = "true";
}

if (svg) {
  render();
  compactMedia.addEventListener("change", render);
}
