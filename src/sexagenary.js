import { polar, annularSectorPath } from "./geometry.js";
import {
  heavenlyStems,
  earthlyBranches,
  sexagenaryCycle,
  cycleItem,
  wrapCycleIndex
} from "./sexagenary-data.js";

const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("#sexagenary-wheel");
const cx = 430;
const cy = 430;
let activeIndex = 0;

const groups = Object.fromEntries(
  ["guides", "stems", "branches", "cycle", "selection"].map(name => [
    name,
    svg.querySelector(`[data-cycle-group="${name}"]`)
  ])
);

const stemNodes = [];
const branchNodes = [];
const cycleNodes = [];

function svgEl(tag, attrs = {}, parent = svg) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function textAt(parent, radius, angle, text, className, attrs = {}) {
  const { x, y } = polar(cx, cy, radius, angle);
  const node = svgEl("text", { x, y, class: className, ...attrs }, parent);
  node.textContent = text;
  return node;
}

function addTitle(node, text) {
  const title = document.createElementNS(NS, "title");
  title.textContent = text;
  node.appendChild(title);
}

function renderGuides() {
  [205, 270, 365].forEach(radius => {
    svgEl("circle", { cx, cy, r: radius, class: "cycle-guide-ring" }, groups.guides);
  });
  textAt(groups.guides, 164, 0, "天干 · 10", "cycle-guide-caption");
  textAt(groups.guides, 238, 0, "地支 · 12", "cycle-guide-caption");
}

function renderStemRing() {
  heavenlyStems.forEach((stem, index) => {
    const angle = index * 36;
    const point = polar(cx, cy, 205, angle);
    const circle = svgEl("circle", {
      cx: point.x,
      cy: point.y,
      r: 25,
      class: `phase-node element-${stem.element}`
    }, groups.stems);
    const label = textAt(groups.stems, 205, angle, stem.name, "phase-node-label");
    stemNodes.push({ circle, label });
  });
}

function renderBranchRing() {
  earthlyBranches.forEach((branch, index) => {
    const angle = index * 30;
    const point = polar(cx, cy, 270, angle);
    const circle = svgEl("circle", {
      cx: point.x,
      cy: point.y,
      r: 22,
      class: `phase-node element-${branch.element}`
    }, groups.branches);
    const label = textAt(groups.branches, 270, angle, branch.name, "phase-node-label");
    branchNodes.push({ circle, label });
  });
}

function renderCycleRing() {
  sexagenaryCycle.forEach((item, index) => {
    const angle = index * 6;
    const tickInner = polar(cx, cy, index % 5 === 0 ? 337 : 343, angle);
    const tickOuter = polar(cx, cy, 356, angle);
    const tick = svgEl("line", {
      x1: tickInner.x,
      y1: tickInner.y,
      x2: tickOuter.x,
      y2: tickOuter.y,
      class: `cycle-tick${index % 5 === 0 ? " major" : ""}`
    }, groups.cycle);

    const dotPoint = polar(cx, cy, 365, angle);
    const dot = svgEl("circle", {
      cx: dotPoint.x,
      cy: dotPoint.y,
      r: index % 5 === 0 ? 5.5 : 4.2,
      class: `cycle-dot${index % 5 === 0 ? " major" : ""}`
    }, groups.cycle);

    if (index % 5 === 0) {
      textAt(groups.cycle, 396, angle, String(item.ordinal).padStart(2, "0"), "cycle-index-label");
    }

    const hit = svgEl("path", {
      d: annularSectorPath(cx, cy, 326, 410, angle - 3, angle + 3),
      class: "cycle-hit",
      tabindex: 0,
      role: "button",
      "aria-label": `第 ${item.ordinal} 位，${item.name}`
    }, groups.cycle);
    addTitle(hit, `${String(item.ordinal).padStart(2, "0")} · ${item.name}`);
    hit.addEventListener("click", () => setActive(index));
    hit.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActive(index);
      }
    });

    cycleNodes.push({ tick, dot, hit });
  });
}

function renderGrid() {
  const grid = document.querySelector("#cycle-grid");
  sexagenaryCycle.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cycle-grid-button";
    button.dataset.cycleIndex = String(index);
    button.innerHTML = `<span>${String(item.ordinal).padStart(2, "0")}</span><strong>${item.name}</strong>`;
    button.addEventListener("click", () => setActive(index));
    grid.appendChild(button);
  });
}

function renderNeighbors() {
  const host = document.querySelector("#cycle-neighbors");
  host.replaceChildren();
  [-2, -1, 0, 1, 2].forEach(offset => {
    const index = wrapCycleIndex(activeIndex + offset);
    const item = cycleItem(index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cycle-neighbor${offset === 0 ? " active" : ""}`;
    button.innerHTML = `<strong>${item.name}</strong><span>${String(item.ordinal).padStart(2, "0")}</span>`;
    button.setAttribute("aria-label", `切換到第 ${item.ordinal} 位 ${item.name}`);
    button.addEventListener("click", () => setActive(index));
    host.appendChild(button);
  });
}

function renderSelection(item) {
  groups.selection.replaceChildren();
  const angle = item.index * 6;
  const inner = polar(cx, cy, 314, angle);
  const outer = polar(cx, cy, 391, angle);
  svgEl("line", {
    x1: inner.x,
    y1: inner.y,
    x2: outer.x,
    y2: outer.y,
    class: "cycle-selection-ray"
  }, groups.selection);
  const cap = polar(cx, cy, 365, angle);
  svgEl("circle", { cx: cap.x, cy: cap.y, r: 9, class: "cycle-selection-cap" }, groups.selection);
}

function updateInspector(item) {
  document.querySelector("#cycle-title").textContent = item.name;
  document.querySelector("#cycle-ordinal").textContent = `${String(item.ordinal).padStart(2, "0")} / 60`;
  document.querySelector("#stem-name").textContent = item.stem.name;
  document.querySelector("#stem-meta").textContent = `${item.stem.yinYang} · ${item.stem.element}`;
  document.querySelector("#stem-phase").textContent = `${item.stemIndex + 1} / 10`;
  document.querySelector("#branch-name").textContent = item.branch.name;
  document.querySelector("#branch-meta").textContent = `${item.branch.yinYang} · ${item.branch.element}`;
  document.querySelector("#branch-phase").textContent = `${item.branchIndex + 1} / 12`;
  document.querySelector("#cycle-relation").textContent = `第 ${item.ordinal} 位：天干走到 ${item.stem.name}，地支走到 ${item.branch.name}；兩者同為${item.stem.yinYang}。每前進一步，兩條序列各自前進一格。`;

  document.querySelector("#mobile-stem-name").textContent = item.stem.name;
  document.querySelector("#mobile-stem-meta").textContent = `${item.stem.yinYang} · ${item.stem.element} · ${item.stemIndex + 1} / 10`;
  document.querySelector("#mobile-branch-name").textContent = item.branch.name;
  document.querySelector("#mobile-branch-meta").textContent = `${item.branch.yinYang} · ${item.branch.element} · ${item.branchIndex + 1} / 12`;

  document.querySelector("#cycle-center-kicker").textContent = `${String(item.ordinal).padStart(2, "0")} / 60`;
  document.querySelector("#cycle-center-value").textContent = item.name;
  document.querySelector("#cycle-center-note").textContent = `${item.stem.name} · ${item.stemIndex + 1}/10　${item.branch.name} · ${item.branchIndex + 1}/12`;
  svg.setAttribute("aria-label", `六十甲子第 ${item.ordinal} 位 ${item.name}；天干 ${item.stem.name}，地支 ${item.branch.name}`);
}

function updateHighlights(item) {
  stemNodes.forEach((node, index) => {
    const active = index === item.stemIndex;
    node.circle.classList.toggle("active", active);
    node.label.classList.toggle("active", active);
  });
  branchNodes.forEach((node, index) => {
    const active = index === item.branchIndex;
    node.circle.classList.toggle("active", active);
    node.label.classList.toggle("active", active);
  });
  cycleNodes.forEach((node, index) => {
    const active = index === item.index;
    node.tick.classList.toggle("active", active);
    node.dot.classList.toggle("active", active);
    node.dot.setAttribute("r", active ? "8" : index % 5 === 0 ? "5.5" : "4.2");
    node.hit.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".cycle-grid-button").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.cycleIndex) === item.index);
  });
}

function setActive(index) {
  activeIndex = wrapCycleIndex(index);
  const item = cycleItem(activeIndex);
  renderSelection(item);
  updateHighlights(item);
  updateInspector(item);
  renderNeighbors();
}

function wireControls() {
  document.querySelector("#cycle-prev").addEventListener("click", () => setActive(activeIndex - 1));
  document.querySelector("#cycle-next").addEventListener("click", () => setActive(activeIndex + 1));
  svg.setAttribute("tabindex", "0");
  svg.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive(activeIndex + 1);
    }
  });
}

renderGuides();
renderStemRing();
renderBranchRing();
renderCycleRing();
renderGrid();
wireControls();
setActive(0);