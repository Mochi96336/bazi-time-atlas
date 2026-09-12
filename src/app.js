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
const centerKicker = document.querySelector("#center-kicker");
const centerValue = document.querySelector("#center-value");
const centerNote = document.querySelector("#center-note");

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
    if (term.kind === "jie") {
      lineClasses.push("jie");
      labelClasses.push("jie");
    } else {
      lineClasses.push("zhongqi");
      labelClasses.push("zhongqi");
    }
    if (isCardinal) {
      lineClasses.push("cardinal");
      labelClasses.push("cardinal");
    }

    const line = svgEl("line", {
      x1: lineInner.x,
      y1: lineInner.y,
      x2: lineOuter.x,
      y2: lineOuter.y,
      class: lineClasses.join(" "),
      "data-term": term.name,
      "data-select-type": "term",
      "data-select-key": term.name
    }, groups.terms);
    line.setAttribute("aria-hidden", "true");

    const labelRadius = term.kind === "jie" ? 323 : 304;
    const label = textAt(groups.terms, labelRadius, term.longitude, term.name, labelClasses.join(" "), {
      "data-term": term.name,
      "data-select-type": "term",
      "data-select-key": term.name
    });

    const hitInner = polar(cx, cy, 242, term.longitude);
    const hitOuter = polar(cx, cy, 334, term.longitude);
    const hit = svgEl("line", {
      x1: hitInner.x,
      y1: hitInner.y,
      x2: hitOuter.x,
      y2: hitOuter.y,
      class: "term-hit",
      "data-select-type": "term",
      "data-select-key": term.name
    }, groups.terms);
    makeSelectable(hit, { type: "term", key: term.name }, `${term.name}，太陽黃經 ${term.longitude} 度，${term.kind === "jie" ? "節" : "中氣"}`);
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

function splitRange(start, end) {
  return end < start ? [[start, 360], [0, end]] : [[start, end]];
}

function rangesOverlap(startA, endA, startB, endB) {
  return splitRange(startA, endA).some(([a0, a1]) =>
    splitRange(startB, endB).some(([b0, b1]) => Math.min(a1, b1) > Math.max(a0, b0))
  );
}

function rangeContains(start, end, angle) {
  return splitRange(start, end).some(([a, b]) => angle >= a && angle < b);
}

function overlappingZodiac(start, end) {
  const ranges = [];
  const segments = splitRange(start, end);
  for (const sign of zodiacSigns) {
    for (const [a, b] of segments) {
      const overlapStart = Math.max(a, sign.start);
      const overlapEnd = Math.min(b, sign.end);
      if (overlapEnd > overlapStart) ranges.push(`${sign.name} ${overlapStart}°–${overlapEnd}°`);
    }
  }
  return ranges;
}

function overlappingMonths(start, end) {
  return baziMonths.filter(month => rangesOverlap(start, end, month.start, month.end));
}

function monthAt(angle) {
  return baziMonths.find(month => rangeContains(month.start, month.end, angle));
}

function zodiacAt(angle) {
  return zodiacSigns.find(sign => angle >= sign.start && angle < sign.end);
}

function clearHighlights() {
  svg.querySelectorAll(".is-selected, .is-related").forEach(node => node.classList.remove("is-selected", "is-related"));
}

function highlightSelector(type, key, className = "is-selected") {
  svg.querySelectorAll(`[data-select-type="${type}"][data-select-key="${key}"]`)
    .forEach(node => node.classList.add(className));
}

function highlightTerm(name, className = "is-related") {
  svg.querySelectorAll(`[data-term="${name}"]`).forEach(node => node.classList.add(className));
}

function renderSelectionBand(start, end) {
  groups.selection.replaceChildren();
  svgEl("path", {
    d: annularSectorPath(cx, cy, 82, 418, start, end),
    class: "selection-band"
  }, groups.selection);
}

function renderSelectionRay(angle) {
  groups.selection.replaceChildren();
  const inner = polar(cx, cy, 82, angle);
  const outer = polar(cx, cy, 418, angle);
  svgEl("line", {
    x1: inner.x,
    y1: inner.y,
    x2: outer.x,
    y2: outer.y,
    class: "selection-ray"
  }, groups.selection);
}

function setCenterReadout(kicker, value, note) {
  centerKicker.textContent = kicker;
  centerValue.textContent = value;
  centerNote.textContent = note;
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

    setCenterReadout("八字月支", `${month.branch}月`, `${month.start}° → ${month.end}°`);
    eyebrow.textContent = "八字月支";
    title.textContent = `${month.branch}月`;
    body.textContent = `${month.startTerm} → ${month.endTerm}。由兩個「節」界定的 30° 太陽黃經區段。`;
    facts.innerHTML = `<span>主五行 <strong>${month.element}</strong></span><span>${month.start}° → ${month.end}°</span>`;
    relation.textContent = `熱帶黃道交疊：${overlappingZodiac(month.start, month.end).join("、")}。這是幾何交疊，不代表兩套系統等價。`;
    return;
  }

  if (state.selected.type === "term") {
    const term = solarTerms.find(item => item.name === state.selected.key);
    const sign = zodiacAt(term.longitude);
    renderSelectionRay(term.longitude);
    highlightSelector("term", term.name);
    highlightSelector("zodiac", sign.name, "is-related");

    let relationText;
    if (term.kind === "jie") {
      const previousMonth = baziMonths.find(month => month.endTerm === term.name);
      const nextMonth = baziMonths.find(month => month.startTerm === term.name);
      highlightSelector("month", previousMonth.branch, "is-related");
      highlightSelector("month", nextMonth.branch, "is-related");
      relationText = `八字月界：${previousMonth.branch}月 → ${nextMonth.branch}月；熱帶黃道：${sign.name}宮。`;
    } else {
      const month = monthAt(term.longitude);
      highlightSelector("month", month.branch, "is-related");
      relationText = `位於 ${month.branch}月內；熱帶黃道：${sign.name}宮。`;
    }

    const kindLabel = term.kind === "jie" ? "節" : "中氣";
    setCenterReadout("二十四節氣", term.name, `${term.longitude}° · ${kindLabel}`);
    eyebrow.textContent = "二十四節氣";
    title.textContent = term.name;
    body.textContent = term.kind === "jie"
      ? `太陽黃經 ${term.longitude}°。這是十二個「節」之一，同時也是八字月界。`
      : `太陽黃經 ${term.longitude}°。這是「中氣」，位於一個八字月區段之內。`;
    facts.innerHTML = `<span>太陽黃經 <strong>${term.longitude}°</strong></span><span><strong>${kindLabel}</strong></span>`;
    relation.textContent = relationText;
    return;
  }

  if (state.selected.type === "zodiac") {
    const sign = zodiacSigns.find(item => item.name === state.selected.key);
    const relatedMonths = overlappingMonths(sign.start, sign.end);
    renderSelectionBand(sign.start, sign.end);
    highlightSelector("zodiac", sign.name);
    relatedMonths.forEach(month => highlightSelector("month", month.branch, "is-related"));

    setCenterReadout("熱帶黃道", sign.name, `${sign.start}° → ${sign.end}°`);
    eyebrow.textContent = "熱帶黃道十二宮";
    title.textContent = `${sign.name}宮`;
    body.textContent = `${sign.start}° → ${sign.end}°，固定 30°。這裡是 tropical zodiac，不是現代天文星座邊界。`;
    facts.innerHTML = `<span>元素 <strong>${sign.element}</strong></span><span>模式 <strong>${sign.modality}</strong></span>`;
    relation.textContent = `八字月支交疊：${relatedMonths.map(month => `${month.branch}月`).join("、")}。宮界與月界整體錯開 15°。`;
    return;
  }

  const season = seasons.find(item => item.name === state.selected.key);
  const relatedMonths = overlappingMonths(season.start, season.end);
  renderSelectionBand(season.start, season.end);
  highlightSelector("season", season.name);
  relatedMonths.forEach(month => highlightSelector("month", month.branch, "is-related"));
  highlightTerm(season.startTerm);
  highlightTerm(season.endTerm);

  setCenterReadout("傳統四季", season.name, `${season.start}° → ${season.end}°`);
  eyebrow.textContent = "傳統節氣季節";
  title.textContent = `${season.name}季`;
  body.textContent = `${season.startTerm} → ${season.endTerm}，跨度 90°。季節起點使用立春、立夏、立秋、立冬。`;
  facts.innerHTML = `<span>${season.start}° → ${season.end}°</span><span>跨度 <strong>90°</strong></span>`;
  relation.textContent = `包含 ${relatedMonths.map(month => `${month.branch}月`).join("、")}。這裡不是用春分、夏至、秋分、冬至作季節起點。`;
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
