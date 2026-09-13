import { rankExactDiscreteAstronomyCandidates } from "./recurrence/near-recurrence.js";

const NS = "http://www.w3.org/2000/svg";
const instrument = document.querySelector("#recurrence-instrument");
const ranking = document.querySelector("#near-recurrence-ranking");
const chart = document.querySelector("#near-recurrence-chart");
let currentSearch = null;

function svgEl(tag, attrs = {}, parent = chart) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent.appendChild(node);
  return node;
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function baseYearFromInstrument() {
  const match = /^(\d{1,7})-/.exec(instrument?.dataset.baseDate ?? "");
  return match ? Number(match[1]) : null;
}

function selectedDeltaFromInstrument() {
  const value = Number(instrument?.dataset.deltaYears);
  return Number.isFinite(value) ? value : null;
}

function formatYears(value) {
  return value.toLocaleString("en-US");
}

function selectCandidate(candidate) {
  window.dispatchEvent(new CustomEvent("recurrence:select-delta", {
    detail: {
      deltaYears: candidate.deltaYears,
      source: "near-recurrence"
    }
  }));
  instrument?.scrollIntoView({
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start"
  });
}

function renderRanking(search) {
  if (!ranking) return;
  ranking.replaceChildren();
  search.ranked.slice(0, 6).forEach((candidate, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `near-ranking-row${index === 0 ? " best" : ""}`;
    row.dataset.deltaYears = String(candidate.deltaYears);
    row.dataset.maxResidualHours = candidate.maxAbsHours.toFixed(6);
    row.setAttribute(
      "aria-label",
      `跳到 +${formatYears(candidate.deltaYears)} 年，十二節最大殘差 ${candidate.maxAbsHours.toFixed(2)} 小時`
    );
    row.innerHTML = `
      <span>${index + 1}</span>
      <strong>+${formatYears(candidate.deltaYears)} 年</strong>
      <em>${candidate.maxAbsHours.toFixed(2)} h max</em>
      <small>${candidate.rmsHours.toFixed(2)} h RMS</small>
    `;
    row.addEventListener("click", () => selectCandidate(candidate));
    ranking.appendChild(row);
  });
}

function makeDotInteractive(dot, candidate) {
  dot.setAttribute("role", "button");
  dot.setAttribute("tabindex", "0");
  dot.setAttribute("aria-label", `跳到 +${formatYears(candidate.deltaYears)} 年`);
  dot.addEventListener("click", () => selectCandidate(candidate));
  dot.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectCandidate(candidate);
  });
}

function renderChart(search) {
  if (!chart) return;
  chart.replaceChildren();
  const width = 1000;
  const height = 180;
  const left = 28;
  const right = 18;
  const top = 16;
  const bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxDelta = search.chronological.at(-1)?.deltaYears ?? 1;
  const maxResidual = Math.max(...search.chronological.map(item => item.maxAbsHours), 1);

  svgEl("line", { x1:left, y1:height-bottom, x2:width-right, y2:height-bottom, class:"near-axis" });
  svgEl("line", { x1:left, y1:top, x2:left, y2:height-bottom, class:"near-axis" });

  search.chronological.forEach(candidate => {
    const x = left + candidate.deltaYears / maxDelta * plotWidth;
    const y = top + candidate.maxAbsHours / maxResidual * plotHeight;
    const isBest = candidate.deltaYears === search.best?.deltaYears;
    const isFirst = candidate.multiple === 1;
    const dot = svgEl("circle", {
      cx:x,
      cy:y,
      r:isBest ? 5.2 : isFirst ? 4.2 : 2.8,
      class:`near-dot${isBest ? " best" : ""}${isFirst ? " first" : ""}`,
      "data-delta-years":candidate.deltaYears,
      "data-max-residual-hours":candidate.maxAbsHours.toFixed(6)
    });
    makeDotInteractive(dot, candidate);
    const title = document.createElementNS(NS, "title");
    title.textContent = `+${formatYears(candidate.deltaYears)} 年 · max ${candidate.maxAbsHours.toFixed(2)} h · RMS ${candidate.rmsHours.toFixed(2)} h`;
    dot.appendChild(title);
  });

  for (const fraction of [0, .25, .5, .75, 1]) {
    const x = left + fraction * plotWidth;
    const label = svgEl("text", { x, y:height-8, class:"near-axis-label" });
    label.textContent = `${Math.round(maxDelta * fraction / 1000)}k`;
  }
}

function renderSelection() {
  const selectedDelta = selectedDeltaFromInstrument();
  const exactCandidate = currentSearch?.chronological.find(candidate => candidate.deltaYears === selectedDelta) ?? null;

  ranking?.querySelectorAll(".near-ranking-row").forEach(row => {
    const selected = Number(row.dataset.deltaYears) === selectedDelta;
    row.classList.toggle("selected", selected);
    row.setAttribute("aria-pressed", String(selected));
  });
  chart?.querySelectorAll(".near-dot").forEach(dot => {
    const selected = Number(dot.dataset.deltaYears) === selectedDelta;
    dot.classList.toggle("selected", selected);
    dot.setAttribute("aria-pressed", String(selected));
  });

  if (exactCandidate) {
    instrument.dataset.nearSearchSelectedDeltaYears = String(exactCandidate.deltaYears);
    instrument.dataset.nearSearchSelectedMaxResidualHours = exactCandidate.maxAbsHours.toFixed(6);
  } else {
    delete instrument.dataset.nearSearchSelectedDeltaYears;
    delete instrument.dataset.nearSearchSelectedMaxResidualHours;
  }
}

function renderSearch(baseYear) {
  try {
    const search = rankExactDiscreteAstronomyCandidates(baseYear);
    const best = search.best;
    if (!best) throw new Error("no future exact-discrete candidate exists inside the model horizon");
    currentSearch = search;

    renderRanking(search);
    renderChart(search);
    setText("near-candidate-count", `${search.candidateCount} 個`);
    setText("near-best-delta", `+${formatYears(best.deltaYears)} 年`);
    setText("near-best-residual", `${best.maxAbsHours.toFixed(2)} h max · ${best.rmsHours.toFixed(2)} h RMS`);
    setText("near-search-horizon", `搜尋到 +${formatYears(search.chronological.at(-1).deltaYears)} 年`);

    instrument.dataset.nearSearchCandidateCount = String(search.candidateCount);
    instrument.dataset.nearSearchBestDeltaYears = String(best.deltaYears);
    instrument.dataset.nearSearchBestMaxResidualHours = best.maxAbsHours.toFixed(6);
    instrument.dataset.nearSearchBestRmsHours = best.rmsHours.toFixed(6);
    instrument.dataset.nearSearchLastDeltaYears = String(search.chronological.at(-1).deltaYears);
    renderSelection();
  } catch (error) {
    currentSearch = null;
    ranking?.replaceChildren();
    chart?.replaceChildren();
    setText("near-candidate-count", "—");
    setText("near-best-delta", "model unavailable");
    setText("near-best-residual", error instanceof Error ? error.message : String(error));
    setText("near-search-horizon", "—");
    instrument.dataset.nearSearchCandidateCount = "0";
    delete instrument.dataset.nearSearchBestDeltaYears;
    delete instrument.dataset.nearSearchBestMaxResidualHours;
    delete instrument.dataset.nearSearchBestRmsHours;
    delete instrument.dataset.nearSearchLastDeltaYears;
    delete instrument.dataset.nearSearchSelectedDeltaYears;
    delete instrument.dataset.nearSearchSelectedMaxResidualHours;
  }
}

function refreshSearch() {
  const baseYear = baseYearFromInstrument();
  if (Number.isFinite(baseYear)) renderSearch(baseYear);
}

if (instrument && ranking && chart) {
  new MutationObserver(records => {
    if (records.some(record => record.attributeName === "data-base-date")) refreshSearch();
    else if (records.some(record => record.attributeName === "data-delta-years")) renderSelection();
  }).observe(instrument, {
    attributes:true,
    attributeFilter:["data-base-date", "data-delta-years"]
  });
  queueMicrotask(refreshSearch);
}