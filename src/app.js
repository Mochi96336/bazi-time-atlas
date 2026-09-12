import { solarTerms, baziMonths, seasons, zodiacSigns } from "./data.js";
import { annularSectorPath, midpointAngle, polar } from "./geometry.js";

const NS = "http://www.w3.org/2000/svg";
const svg = document.querySelector("#atlas-wheel");
const cx = 430, cy = 430;
const CARDINAL_ANGLES = new Set([0, 90, 180, 270]);
const state = {
  selected: { type: "month", key: "卯" },
  layers: { terms: true, months: true, seasons: true, zodiac: true, debug: false }
};
const groups = Object.fromEntries(
  ["selection", "seasons", "months", "terms", "zodiac", "debug"].map(name => [
    name,
    svg.querySelector(`[data-layer-group="${name}"]`)
  ])
);

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

function makeSelectable(node, selection, title) {
  node.classList.add("selectable");
  node.setAttribute("tabindex", "0");
  node.setAttribute("role", "button");
  node.setAttribute("aria-label", title);
  const activate = () => {
    state.selected = selection;
    renderSelection();
  };
  node.addEventListener("click", activate);
  node.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
}

function renderStaticWheel() {
  seasons.forEach((season, index) => {
    const path = svgEl("path", {
      d: annularSectorPath(cx, cy, 91, 132, season.start, season.end),
      class: `season-sector season-${index}`,
      "data-select-type": "season",
      "data-select-key": season.name
    }, groups.seasons);
    textAt(groups.seasons, 111, midpointAngle(season.start, season.end), season.name, "season-label");
    makeSelectable(path, { type: "season", key: season.name }, `${season.name}季`);
  });

  baziMonths.forEach(month => {
    const path = svgEl("path", {
      d: annularSectorPath(cx, cy, 145, 235, month.start, month.end),
      class: `month-sector element-${month.element}`,
      "data-select-type": "month",
      "data-select-key": month.branch
    }, groups.months);
    textAt(groups.months, 190, midpointAngle(month.start, month.end), month.branch, "month-branch");
    makeSelectable(path, { type: "month", key: month.branch }, `${month.branch}月，五行${month.element}`);
  });

  solarTerms.forEach(term => {
    const isCardinal = CARDINAL_ANGLES.has(term.longitude);
    const lineInner = polar(cx, cy, 247, term.longitude);
    const lineOuterRadius = term.kind === "jie" ? 300 : isCardinal ? 292 : 281;
    const lineOuter = polar(cx, cy, lineOuterRadius, term.longitude);
    const lineClasses = ["term-line"];
    const labelClasses = ["term-label"];
    if (term.kind === "jie") { lineClasses.push("jie"); labelClasses.push("jie"); }
    if (isCardinal) { lineClasses.push("cardinal"); labelClasses.push("cardinal"); }

    const line = svgEl("line", {
      x1: lineInner.x,
      y1: lineInner.y,
      x2: lineOuter.x,
      y2: lineOuter.y,
      class: lineClasses.join(" "),
      "data-term": term.name
    }, groups.terms);
    line.setAttribute("aria-hidden", "true");

    const labelRadius = term.kind === "jie" ? 323 : 304;
    const label = textAt(groups.terms, labelRadius, term.longitude, term.name, labelClasses.join(" "));
    label.setAttribute("data-term", term.name);
  });

  zodiacSigns.forEach(sign => {
    const path = svgEl("path", {
      d: annularSectorPath(cx, cy, 342, 414, sign.start, sign.end),
      class: "zodiac-sector",
      "data-select-type": "zodiac",
      "data-select-key": sign.name
    }, groups.zodiac);
    textAt(groups.zodiac, 378, midpointAngle(sign.start, sign.end), sign.name, "zodiac-label");
    makeSelectable(path, { type: "zodiac", key: sign.name }, `${sign.name}宮，${sign.element}象，${sign.modality}`);
  });

  [0, 90, 180, 270].forEach(angle => {
    textAt(groups.zodiac, 407, angle, `${angle}°`, "quadrant-angle");
    const p1 = polar(cx, cy, 78, angle);
    const p2 = polar(cx, cy, 420, angle);
    svgEl("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "debug-axis" }, groups.debug);
    textAt(groups.debug, 399, angle + 2.5, `${angle}°`, "debug-label");
  });
}

function overlappingZodiac(start, end) {
  const ranges = [];
  const segments = end < start ? [[start, 360], [0, end]] : [[start, end]];
  for (const sign of zodiacSigns) {
    for (const [a, b] of segments) {
      const overlapStart = Math.max(a, sign.start);
      const overlapEnd = Math.min(b, sign.end);
      if (overlapEnd > overlapStart) ranges.push(`${sign.name} ${overlapStart}°–${overlapEnd}°`);
    }
  }
  return ranges;
}

function clearHighlights() {
  svg.querySelectorAll(".is-selected, .is-related").forEach(node => node.classList.remove("is-selected", "is-related"));
}

function highlightSelector(type, key, className = "is-selected") {
  svg.querySelector(`[data-select-type="${type}"][data-select-key="${key}"]`)?.classList.add(className);
}

function highlightTerm(name) {
  svg.querySelectorAll(`[data-term="${name}"]`).forEach(node => node.classList.add("is-related"));
}

function renderSelectionBand(start, end) {
  groups.selection.replaceChildren();
  svgEl("path", {
    d: annularSectorPath(cx, cy, 82, 418, start, end),
    class: "selection-band"
  }, groups.selection);
}

function renderSelection() {
  clearHighlights();
  const title = document.querySelector("#detail-title");
  const eyebrow = document.querySelector("#detail-eyebrow");
  const body = document.querySelector("#detail-body");
  const facts = document.querySelector("#detail-facts");
  const relation = document.querySelector("#detail-relation");

  if (state.selected.type === "month") {
    const month = baziMonths.find(item => item.branch === state.selected.key);
    renderSelectionBand(month.start, month.end);
    highlightSelector("month", month.branch);
    solarTerms
      .filter(term => term.name === month.startTerm || term.name === month.endTerm)
      .forEach(term => highlightTerm(term.name));
    overlappingZodiac(month.start, month.end)
      .forEach(item => highlightSelector("zodiac", item.split(" ")[0], "is-related"));

    eyebrow.textContent = "八字月支";
    title.textContent = `${month.branch}月`;
    body.textContent = `${month.startTerm} → ${month.endTerm}。由兩個「節」界定的 30° 太陽黃經區段。`;
    facts.innerHTML = `<span>主五行 <strong>${month.element}</strong></span><span>${month.start}° → ${month.end}°</span>`;
    relation.textContent = `熱帶黃道交疊：${overlappingZodiac(month.start, month.end).join("、")}。這是幾何交疊，不代表兩套系統等價。`;
    return;
  }

  if (state.selected.type === "zodiac") {
    const sign = zodiacSigns.find(item => item.name === state.selected.key);
    renderSelectionBand(sign.start, sign.end);
    highlightSelector("zodiac", sign.name);
    eyebrow.textContent = "熱帶黃道十二宮";
    title.textContent = `${sign.name}宮`;
    body.textContent = `${sign.start}° → ${sign.end}°，固定 30°。這裡是 tropical zodiac，不是現代天文星座邊界。`;
    facts.innerHTML = `<span>元素 <strong>${sign.element}</strong></span><span>模式 <strong>${sign.modality}</strong></span>`;
    const overlappingMonths = baziMonths.filter(month => overlappingZodiac(month.start, month.end).some(x => x.startsWith(sign.name)));
    relation.textContent = `八字月支交疊：${overlappingMonths.map(m => `${m.branch}月`).join("、")}。宮界與月界整體錯開 15°。`;
    return;
  }

  const season = seasons.find(item => item.name === state.selected.key);
  renderSelectionBand(season.start, season.end);
  highlightSelector("season", season.name);
  eyebrow.textContent = "傳統節氣季節";
  title.textContent = `${season.name}季`;
  body.textContent = `${season.startTerm} → ${season.endTerm}，跨度 90°。季節起點使用立春、立夏、立秋、立冬。`;
  facts.innerHTML = `<span>${season.start}° → ${season.end}°</span><span>跨度 <strong>90°</strong></span>`;
  relation.textContent = "這裡不是用春分、夏至、秋分、冬至作季節起點。";
}

function wireControls() {
  document.querySelectorAll("[data-toggle-layer]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleLayer;
      state.layers[key] = !state.layers[key];
      button.classList.toggle("active", state.layers[key]);
      button.setAttribute("aria-pressed", String(state.layers[key]));
      groups[key].hidden = !state.layers[key];
    });
  });
}

renderStaticWheel();
wireControls();
renderSelection();
