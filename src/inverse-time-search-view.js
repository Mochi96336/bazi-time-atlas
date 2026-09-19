import { searchInversePillarIntervals } from "./search/inverse-pillar-search.js";
import { sexagenaryCycle } from "./sexagenary-data.js";
import { normalizeAtlasTimeContext } from "./wheel/atlas-time-context.js";
import {
  civilFieldsFromInstant,
  formatAtlasCivil
} from "./wheel/atlas-display-model.js";
import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";

const PILLAR_IDS = Object.freeze(["year", "month", "day", "hour"]);
const PILLAR_LABELS = Object.freeze({
  year:"年",
  month:"月",
  day:"日",
  hour:"時"
});
const PILLAR_DATASET_KEYS = Object.freeze({
  year:"yearPillar",
  month:"monthPillar",
  day:"dayPillar",
  hour:"hourPillar"
});
const SEXAGENARY_NAMES = Object.freeze(sexagenaryCycle.map(item => item.name));
const SEXAGENARY_INDEX = new Map(SEXAGENARY_NAMES.map((name, index) => [name, index]));
const TOOTH_DEGREES = 6;
const OFFSET_EPSILON = 0.001;
const DAY_MS = 86_400_000;
const SEARCH_DEBOUNCE_MS = 180;
const SEARCH_STAGE_MAX_RESULTS = 512;
const SEARCH_MAX_RESULTS = 48;
const SEARCH_HORIZON_MS = Object.freeze({
  hour:3 * DAY_MS,
  day:31 * DAY_MS,
  month:3 * 366 * DAY_MS,
  year:31 * 366 * DAY_MS
});

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function selectedInstant(instrument) {
  const value = Number(instrument?.dataset.selectedInstantMs);
  if (!Number.isFinite(value)) {
    throw new RangeError("Selected Instant is unavailable");
  }
  return value;
}

function currentTimeContext(instrument) {
  return normalizeAtlasTimeContext({
    utcOffsetHours:Number(instrument?.dataset.utcOffsetHours),
    dayBoundary:instrument?.dataset.dayBoundary
  });
}

function sameTimeContext(a, b) {
  return a.utcOffsetHours === b.utcOffsetHours && a.dayBoundary === b.dayBoundary;
}

function formatInstant(instantMs, context) {
  return formatAtlasCivil(civilFieldsFromInstant(instantMs, context));
}

export function inverseWheelPillarForOffset({
  currentPillar,
  offsetDegrees,
  names = SEXAGENARY_NAMES
}) {
  if (!Number.isFinite(offsetDegrees)) throw new RangeError("offsetDegrees must be finite");
  const index = names.indexOf(currentPillar);
  if (index < 0) throw new RangeError("currentPillar must be one canonical sexagenary name");
  const teeth = Math.round(offsetDegrees / TOOTH_DEGREES);
  return names[modulo(index - teeth, names.length)];
}

export function inverseWheelConstraints({ pillars = {}, offsets = {} } = {}) {
  return Object.freeze(Object.fromEntries(PILLAR_IDS.map(id => {
    const offset = Number(offsets[id] ?? 0);
    const current = pillars[id];
    if (!Number.isFinite(offset) || Math.abs(offset) <= OFFSET_EPSILON) return [id, null];
    return [id, inverseWheelPillarForOffset({ currentPillar:current, offsetDegrees:offset })];
  })));
}

export function formatInverseMatchPillars(pillars = {}) {
  return PILLAR_IDS
    .flatMap(id => {
      const name = typeof pillars[id] === "string" ? pillars[id] : pillars[id]?.name;
      return name ? [`${PILLAR_LABELS[id]} ${name}`] : [];
    })
    .join(" · ");
}

function activeConstraintIds(constraints) {
  return PILLAR_IDS.filter(id => typeof constraints[id] === "string" && constraints[id]);
}

function slowestConstraintId(constraints) {
  return PILLAR_IDS.find(id => typeof constraints[id] === "string" && constraints[id]) ?? null;
}

export function searchInverseWheelIntervals({
  constraints,
  startMs,
  endMs,
  timeContext,
  maxResults = SEARCH_MAX_RESULTS
}) {
  const activeIds = activeConstraintIds(constraints);
  if (!activeIds.length) {
    return Object.freeze({ matches:Object.freeze([]), stats:Object.freeze({ boundarySteps:0 }) });
  }

  let windows = [{ startMs, endMs }];
  let boundarySteps = 0;
  let truncated = false;

  // Refine from slow clocks to fast clocks. This preserves the canonical solver
  // while avoiding a 60-year Hour-by-Hour scan for a four-pillar query.
  for (const id of activeIds) {
    const next = [];
    for (const window of windows) {
      const result = searchInversePillarIntervals({
        constraints:{ [id]:constraints[id] },
        startMs:window.startMs,
        endMs:window.endMs,
        timeContext,
        maxResults:SEARCH_STAGE_MAX_RESULTS
      });
      boundarySteps += result.stats.boundarySteps;
      truncated ||= result.truncated;
      for (const match of result.matches) {
        next.push({ startMs:match.startMs, endMs:match.endMs });
        if (next.length >= SEARCH_STAGE_MAX_RESULTS) {
          truncated = true;
          break;
        }
      }
      if (next.length >= SEARCH_STAGE_MAX_RESULTS) break;
    }
    windows = next;
    if (!windows.length) break;
  }

  const pillars = Object.freeze(Object.fromEntries(
    activeIds.map(id => [id, Object.freeze({ name:constraints[id] })])
  ));
  const limited = windows.slice(0, maxResults).map(window => Object.freeze({
    ...window,
    pillars
  }));
  if (windows.length > maxResults) truncated = true;

  return Object.freeze({
    matches:Object.freeze(limited),
    truncated,
    stats:Object.freeze({ boundarySteps, constrainedRings:Object.freeze([...activeIds]) })
  });
}

function nearestMatch(matches, anchorMs) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const match of matches) {
    const distance = anchorMs < match.startMs
      ? match.startMs - anchorMs
      : anchorMs >= match.endMs
        ? anchorMs - match.endMs
        : 0;
    if (distance >= bestDistance) continue;
    const instantMs = distance === 0
      ? anchorMs
      : Math.round(match.startMs + Math.max(0, match.endMs - match.startMs) / 2);
    best = { ...match, instantMs };
    bestDistance = distance;
  }
  return best;
}

function autoSearch({ constraints, selectedMs, context }) {
  const slowest = slowestConstraintId(constraints);
  if (!slowest) return null;
  const baseHorizon = SEARCH_HORIZON_MS[slowest];
  let lastResult = null;

  // One natural cycle catches the nearest ordinary recurrence. A second cycle
  // handles combinations whose first candidate month/year cannot satisfy the
  // faster rings without turning the UI into a user-managed range picker.
  for (const multiplier of [1, 2]) {
    lastResult = searchInverseWheelIntervals({
      constraints,
      startMs:selectedMs - baseHorizon * multiplier,
      endMs:selectedMs + baseHorizon * multiplier,
      timeContext:context,
      maxResults:SEARCH_MAX_RESULTS
    });
    if (lastResult.matches.length) return lastResult;
  }
  return lastResult;
}

function relabelToolMode(documentRef) {
  const open = documentRef.querySelector("#analysis-toggle");
  const close = documentRef.querySelector("#analysis-close");
  if (open) {
    open.textContent = "工具";
    open.title = "顯示找時間、分類、參考系與太陽時間等工具";
  }
  if (close) {
    close.textContent = "完成";
    close.title = "收起工具並回到標準時間視圖";
  }

  const tenGodTitle = documentRef.querySelector("#atlas-visible-ten-gods .atlas-visible-ten-gods-head strong");
  if (tenGodTitle?.textContent?.includes("四柱分析")) tenGodTitle.textContent = "四柱 · 明干十神";

  for (const item of documentRef.querySelectorAll(".atlas-notes li")) {
    const strong = item.querySelector("strong");
    if (strong?.textContent?.trim() !== "分析") continue;
    item.innerHTML = "<strong>工具</strong>：需要找時間、分類、參考系或太陽時間比較時再展開；收起後回到標準時間視圖。";
  }
}

function createReadout(documentRef) {
  const readout = documentRef.createElement("div");
  readout.id = "inverse-time-search-readout";
  readout.className = "inverse-time-search-readout";
  readout.hidden = true;
  readout.setAttribute("aria-live", "polite");
  readout.innerHTML = `
    <strong data-inverse-wheel-query>找時間</strong>
    <span data-inverse-wheel-status>拖動年／月／日／時環設定條件。</span>
    <button type="button" data-inverse-wheel-apply hidden>前往</button>
  `;
  return readout;
}

function offsetSnapshot(documentRef) {
  return Object.fromEntries(PILLAR_IDS.map(id => {
    const track = documentRef.querySelector(`#${id}-track`);
    return [id, Number(track?.dataset.manualOffset ?? 0)];
  }));
}

function pillarSnapshot(instrument) {
  return Object.fromEntries(PILLAR_IDS.map(id => [id, instrument.dataset[PILLAR_DATASET_KEYS[id]]]));
}

function constraintsFromInstrument(instrument, documentRef) {
  return inverseWheelConstraints({
    pillars:pillarSnapshot(instrument),
    offsets:offsetSnapshot(documentRef)
  });
}

function screenPointToWorld(svg, clientX, clientY) {
  const matrix = svg?.getScreenCTM?.();
  if (!matrix) return null;
  const inverse = matrix.inverse();
  if (typeof DOMPoint === "function") {
    const point = new DOMPoint(clientX, clientY).matrixTransform(inverse);
    return { x:point.x, y:point.y };
  }
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const world = point.matrixTransform(inverse);
  return { x:world.x, y:world.y };
}

function isSolarBandPointer(svg, event) {
  const world = screenPointToWorld(svg, event.clientX, event.clientY);
  if (!world) return false;
  const radius = Math.hypot(world.x - 600, world.y - 1360);
  return radius >= 750 && radius <= 900;
}

export function installInverseTimeSearch(instrument, documentRef = document) {
  if (!instrument) return null;
  relabelToolMode(documentRef);

  const compareButton = documentRef.querySelector("#compare-rings-button");
  if (!compareButton) return null;
  compareButton.hidden = true;
  compareButton.dataset.productEntry = "retired";

  if (documentRef.querySelector("#inverse-time-search-button")) return null;
  const nowButton = documentRef.querySelector("#now-button");
  const actionGroup = nowButton?.parentElement;
  const svg = documentRef.querySelector("#kinetic-wheel");
  if (!actionGroup || !svg) return null;

  const button = documentRef.createElement("button");
  button.id = "inverse-time-search-button";
  button.className = "control-button";
  button.type = "button";
  button.textContent = "找時間";
  button.title = "直接轉動年、月、日、時環，反查真正成立的時間";
  button.setAttribute("aria-pressed", "false");
  actionGroup.insertBefore(button, nowButton);

  const readout = createReadout(documentRef);
  instrument.append(readout);
  const query = readout.querySelector("[data-inverse-wheel-query]");
  const status = readout.querySelector("[data-inverse-wheel-status]");
  const apply = readout.querySelector("[data-inverse-wheel-apply]");
  const observedTracks = PILLAR_IDS
    .map(id => documentRef.querySelector(`#${id}-track`))
    .filter(Boolean);

  let active = false;
  let searchTimer = null;
  let candidate = null;
  let candidateContext = null;

  const clearPending = () => {
    if (searchTimer !== null) clearTimeout(searchTimer);
    searchTimer = null;
  };

  const setIdleSearchCopy = () => {
    query.textContent = "找時間";
    status.textContent = "拖動年／月／日／時環設定條件。";
    apply.hidden = true;
    candidate = null;
    candidateContext = null;
  };

  const deactivateUi = () => {
    active = false;
    clearPending();
    instrument.dataset.inverseTimeSearch = "available";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "找時間";
    readout.hidden = true;
    candidate = null;
    candidateContext = null;
  };

  const exitMode = () => {
    if (!active) return;
    deactivateUi();
    if (compareButton.getAttribute("aria-pressed") === "true") compareButton.click();
  };

  const runSearch = () => {
    searchTimer = null;
    if (!active) return;
    let constraints;
    let selectedMs;
    let context;
    try {
      constraints = constraintsFromInstrument(instrument, documentRef);
      selectedMs = selectedInstant(instrument);
      context = currentTimeContext(instrument);
    } catch (error) {
      query.textContent = "找時間";
      status.textContent = `目前時間基準無法查詢：${error?.message ?? String(error)}`;
      apply.hidden = true;
      return;
    }

    const description = formatInverseMatchPillars(constraints);
    if (!description) {
      setIdleSearchCopy();
      return;
    }
    query.textContent = description;
    status.textContent = "正在比對真實時間…";
    apply.hidden = true;

    try {
      const result = autoSearch({ constraints, selectedMs, context });
      const nearest = nearestMatch(result?.matches ?? [], selectedMs);
      if (!nearest) {
        candidate = null;
        candidateContext = null;
        status.textContent = "附近兩個自然週期沒有找到成立時間；可再轉一格或換一組。";
        return;
      }
      candidate = nearest;
      candidateContext = context;
      status.textContent = `最近符合 · ${formatInstant(nearest.instantMs, context)} · ${result.stats.boundarySteps} 個實際邊界`;
      apply.hidden = false;
      apply.textContent = "前往";
    } catch (error) {
      candidate = null;
      candidateContext = null;
      status.textContent = `搜尋失敗：${error?.message ?? String(error)}`;
      apply.hidden = true;
    }
  };

  const scheduleSearch = () => {
    if (!active) return;
    clearPending();
    const constraints = (() => {
      try { return constraintsFromInstrument(instrument, documentRef); }
      catch { return null; }
    })();
    if (constraints) {
      const description = formatInverseMatchPillars(constraints);
      query.textContent = description || "找時間";
      status.textContent = description ? "正在比對真實時間…" : "拖動年／月／日／時環設定條件。";
      apply.hidden = true;
    }
    searchTimer = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
  };

  const enterMode = () => {
    if (active) return;
    active = true;
    instrument.dataset.inverseTimeSearch = "active";
    button.setAttribute("aria-pressed", "true");
    button.textContent = "完成找時間";
    readout.hidden = false;
    setIdleSearchCopy();
    if (compareButton.getAttribute("aria-pressed") !== "true") compareButton.click();
  };

  button.addEventListener("click", () => {
    if (active) exitMode();
    else enterMode();
  });

  apply.addEventListener("click", () => {
    if (!candidate || !candidateContext) return;
    let liveContext;
    try { liveContext = currentTimeContext(instrument); }
    catch { liveContext = null; }
    if (!liveContext || !sameTimeContext(liveContext, candidateContext)) {
      status.textContent = "時間基準已變更，正在重新搜尋。";
      scheduleSearch();
      return;
    }
    const instantMs = candidate.instantMs;
    exitMode();
    instrument.dispatchEvent(new CustomEvent(SELECTED_INSTANT_COMMAND, {
      bubbles:true,
      detail:{ instantMs, source:"inverse-wheel-search" }
    }));
  });

  // Free Compare's drag engine already provides direct manipulation, inertia and
  // detents. Observe its rendered offsets and solve only after motion settles.
  const trackObserver = new MutationObserver(scheduleSearch);
  for (const track of observedTracks) {
    trackObserver.observe(track, { attributes:true, attributeFilter:["data-manual-offset"] });
  }

  // Solar longitude is not a four-pillar constraint. Keep the annual band as
  // context instead of letting it become a visually draggable but semantically
  // ignored pseudo-filter.
  svg.addEventListener("pointerdown", event => {
    if (!active || !isSolarBandPointer(svg, event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    status.textContent = "節氣／黃道保留為時間背景；找時間只轉年、月、日、時四個干支環。";
  }, true);

  const compareObserver = new MutationObserver(() => {
    if (active && compareButton.getAttribute("aria-pressed") !== "true") deactivateUi();
  });
  compareObserver.observe(compareButton, { attributes:true, attributeFilter:["aria-pressed"] });

  documentRef.addEventListener("keydown", event => {
    if (event.key === "Escape" && active) exitMode();
  });

  instrument.dataset.inverseTimeSearch = "available";
  return Object.freeze({
    button,
    readout,
    enterMode,
    exitMode,
    get active() { return active; }
  });
}

export const INVERSE_WHEEL_SEARCH_CONSTANTS = Object.freeze({
  toothDegrees:TOOTH_DEGREES,
  offsetEpsilon:OFFSET_EPSILON,
  searchHorizonMs:SEARCH_HORIZON_MS
});
