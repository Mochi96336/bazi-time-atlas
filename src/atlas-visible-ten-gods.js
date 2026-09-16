import { tenGodForStem } from "./calendar/ten-gods.js";

const PILLAR_KEYS = Object.freeze(["year", "month", "day", "hour"]);
const PILLAR_LABELS = Object.freeze({
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "時柱"
});
const PILLAR_PATTERN = /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/;

function normalizedPillar(value) {
  return typeof value === "string" && PILLAR_PATTERN.test(value) ? value : null;
}

export function visibleStemTenGodState({
  yearPillar,
  monthPillar,
  dayPillar,
  hourPillar
} = {}) {
  const pillars = {
    year: normalizedPillar(yearPillar),
    month: normalizedPillar(monthPillar),
    day: normalizedPillar(dayPillar),
    hour: normalizedPillar(hourPillar)
  };
  if (Object.values(pillars).some(value => value === null)) return null;

  const dayMaster = pillars.day[0];
  const entries = PILLAR_KEYS.map(key => {
    const pillar = pillars[key];
    const stem = pillar[0];
    const relation = key === "day" ? null : tenGodForStem(dayMaster, stem);
    return Object.freeze({
      key,
      label: PILLAR_LABELS[key],
      pillar,
      stem,
      tenGod: key === "day" ? "日主" : relation.name,
      relationGroup: key === "day" ? "day-master" : relation.group
    });
  });

  return Object.freeze({ dayMaster, entries: Object.freeze(entries) });
}

function stateFromInstrument(instrument) {
  return visibleStemTenGodState({
    yearPillar: instrument.dataset.yearPillar,
    monthPillar: instrument.dataset.monthPillar,
    dayPillar: instrument.dataset.dayPillar,
    hourPillar: instrument.dataset.hourPillar
  });
}

function ensureStylesheet() {
  if (document.querySelector("link[data-atlas-visible-ten-gods-styles]")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./atlas-visible-ten-gods.css";
  stylesheet.dataset.atlasVisibleTenGodsStyles = "1";
  document.head.append(stylesheet);
}

function createPanel() {
  const panel = document.createElement("section");
  panel.id = "atlas-visible-ten-gods";
  panel.className = "atlas-visible-ten-gods";
  panel.hidden = true;
  panel.setAttribute("aria-label", "四柱明干十神分析");

  const header = document.createElement("header");
  header.className = "atlas-visible-ten-gods-head";
  const copy = document.createElement("div");
  const kicker = document.createElement("small");
  kicker.textContent = "FOUR PILLARS · VISIBLE STEMS";
  const title = document.createElement("strong");
  title.textContent = "四柱分析 · 明干十神";
  copy.append(kicker, title);
  const master = document.createElement("span");
  master.className = "atlas-visible-ten-gods-master";
  header.append(copy, master);

  const grid = document.createElement("div");
  grid.className = "atlas-visible-ten-gods-grid";
  for (const key of PILLAR_KEYS) {
    const cell = document.createElement("div");
    cell.className = "atlas-visible-ten-gods-cell";
    cell.dataset.pillar = key;
    cell.innerHTML = `<span>${PILLAR_LABELS[key]}</span><strong>—</strong><small>—</small>`;
    grid.append(cell);
  }

  const note = document.createElement("p");
  note.className = "atlas-visible-ten-gods-note";
  note.textContent = "只比較四柱表面天干相對日主的五行方向與陰陽同異；不含藏干、旺衰、權重或吉凶判斷。";
  panel.append(header, grid, note);
  return panel;
}

export function installAtlasVisibleTenGods(instrument = document.querySelector("#kinetic-instrument")) {
  if (!instrument) return null;
  const existing = instrument.querySelector("#atlas-visible-ten-gods");
  if (existing) return existing;

  ensureStylesheet();
  const panel = createPanel();
  const readout = instrument.querySelector(".instrument-readout");
  if (readout) readout.insertAdjacentElement("afterend", panel);
  else instrument.append(panel);

  const update = () => {
    const state = stateFromInstrument(instrument);
    const analysisOpen = instrument.dataset.analysisOpen === "true";
    panel.hidden = !analysisOpen || state === null;
    panel.dataset.available = String(state !== null);
    if (!state) return;

    panel.querySelector(".atlas-visible-ten-gods-master").textContent = `${state.dayMaster}日主`;
    for (const entry of state.entries) {
      const cell = panel.querySelector(`[data-pillar="${entry.key}"]`);
      if (!cell) continue;
      cell.querySelector("strong").textContent = entry.pillar;
      cell.querySelector("small").textContent = entry.tenGod;
      cell.dataset.tenGod = entry.tenGod;
      cell.dataset.relationGroup = entry.relationGroup;
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(instrument, {
    attributes: true,
    attributeFilter: [
      "data-analysis-open",
      "data-year-pillar",
      "data-month-pillar",
      "data-day-pillar",
      "data-hour-pillar"
    ]
  });
  update();
  return panel;
}
