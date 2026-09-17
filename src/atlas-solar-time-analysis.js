import {
  atlasSolarTimeAnalysisState,
  normalizeAtlasLongitude
} from "./atlas-solar-time-analysis-model.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  formatAtlasUtcOffset,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function sameDate(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function formatClock(time, reference) {
  const clock = `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
  if (!reference || sameDate(time, reference)) return clock;
  return `${pad(time.year, 4)}-${pad(time.month)}-${pad(time.day)} · ${clock}`;
}

function formatSignedMinutes(value) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(2)} min`;
}

function readTimeContext(instrument) {
  return normalizeAtlasTimeContext({
    utcOffsetHours:Number(
      instrument.dataset.utcOffsetHours ?? DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours
    ),
    dayBoundary:instrument.dataset.dayBoundary ?? DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
  });
}

function queryLongitude() {
  const raw = new URLSearchParams(location.search).get("lon");
  if (raw === null || raw.trim() === "") return { raw:"", value:null, valid:true };
  const value = Number(raw);
  try {
    return { raw, value:normalizeAtlasLongitude(value), valid:true };
  } catch {
    return { raw, value:null, valid:false };
  }
}

function replaceLongitudeInUrl(value) {
  const url = new URL(location.href);
  if (value === null) url.searchParams.delete("lon");
  else url.searchParams.set("lon", String(value));
  history.replaceState(null, "", url);
}

function createBasisRow(row, civilInput) {
  const item = document.createElement("div");
  item.className = "atlas-solar-basis-row";
  item.dataset.timeBasis = row.id;
  item.dataset.dayPillar = row.day.name;
  item.dataset.hourPillar = row.hour.name;
  item.dataset.dayChanged = String(row.changedFromCivil.day);
  item.dataset.hourChanged = String(row.changedFromCivil.hour);

  const basis = document.createElement("span");
  basis.textContent = row.label;
  const clock = document.createElement("small");
  clock.textContent = formatClock(row.clock, civilInput);
  basis.append(clock);

  const day = document.createElement("b");
  day.textContent = `日 ${row.day.name}`;
  day.dataset.changed = row.changedFromCivil.day ? "1" : "0";
  const hour = document.createElement("b");
  hour.textContent = `時 ${row.hour.name}`;
  hour.dataset.changed = row.changedFromCivil.hour ? "1" : "0";
  item.append(basis, day, hour);
  return item;
}

export function installAtlasSolarTimeAnalysis(
  instrument = document.querySelector("#kinetic-instrument")
) {
  if (!instrument) return null;
  const existing = document.querySelector("#atlas-solar-time-analysis");
  if (existing) return existing;

  const panel = document.createElement("section");
  panel.id = "atlas-solar-time-analysis";
  panel.className = "atlas-solar-time-analysis";
  panel.hidden = true;
  panel.dataset.longitudeBound = "false";
  panel.dataset.ready = "false";
  panel.setAttribute("aria-label", "太陽時計時與日柱時柱敏感度分析");
  panel.innerHTML = `
    <header class="atlas-solar-analysis-head">
      <div>
        <small>TIME BASIS</small>
        <strong>太陽時比較</strong>
        <span>只比較 Day / Hour 邊界；不改 Selected Instant。</span>
      </div>
      <label class="atlas-solar-longitude-field">
        <span>實際經度</span>
        <input id="atlas-solar-longitude" type="number" min="-180" max="180" step="0.0001" inputmode="decimal" placeholder="例如 121.5" aria-label="實際經度，東經為正西經為負">
        <small>° · 東正／西負</small>
      </label>
    </header>
    <div id="atlas-solar-analysis-empty" class="atlas-solar-analysis-empty">
      輸入實際經度後，才比較民用、平太陽與視太陽時計時。UTC offset 不會被當成地理經度。
    </div>
    <div id="atlas-solar-analysis-result" class="atlas-solar-analysis-result" hidden>
      <div class="atlas-solar-corrections" aria-label="太陽時校正">
        <span>經度校正 <b id="atlas-solar-longitude-correction">—</b></span>
        <span>均時差 EoT <b id="atlas-solar-eot">—</b></span>
        <span>總校正 <b id="atlas-solar-total-correction">—</b></span>
      </div>
      <div class="atlas-solar-basis-head">
        <span>柱位敏感度</span>
        <strong id="atlas-solar-sensitivity-summary">—</strong>
      </div>
      <div id="atlas-solar-basis-rows" class="atlas-solar-basis-rows"></div>
      <small id="atlas-solar-analysis-meta" class="atlas-solar-analysis-meta">—</small>
    </div>
  `;
  instrument.insertAdjacentElement("afterend", panel);

  const longitudeInput = panel.querySelector("#atlas-solar-longitude");
  const empty = panel.querySelector("#atlas-solar-analysis-empty");
  const resultHost = panel.querySelector("#atlas-solar-analysis-result");
  const longitudeCorrection = panel.querySelector("#atlas-solar-longitude-correction");
  const equationOfTime = panel.querySelector("#atlas-solar-eot");
  const totalCorrection = panel.querySelector("#atlas-solar-total-correction");
  const summary = panel.querySelector("#atlas-solar-sensitivity-summary");
  const rowsHost = panel.querySelector("#atlas-solar-basis-rows");
  const meta = panel.querySelector("#atlas-solar-analysis-meta");
  let longitude = null;
  let longitudeValid = true;
  let renderTimer = null;

  const initial = queryLongitude();
  longitudeInput.value = initial.raw;
  longitudeValid = initial.valid;
  if (initial.valid) longitude = initial.value;
  else longitudeInput.setAttribute("aria-invalid", "true");

  function clearComputedState() {
    panel.dataset.longitudeBound = "false";
    delete panel.dataset.longitude;
    delete panel.dataset.meanSolarCorrectionMinutes;
    delete panel.dataset.equationOfTimeMinutes;
    delete panel.dataset.totalSolarCorrectionMinutes;
    delete panel.dataset.timeBasisSensitive;
    delete panel.dataset.daySensitive;
    delete panel.dataset.hourSensitive;
    resultHost.hidden = true;
    empty.hidden = false;
  }

  function render() {
    renderTimer = null;
    const analysisOpen = instrument.dataset.analysisOpen === "true";
    panel.hidden = !analysisOpen;
    if (!analysisOpen) return;

    const selectedMs = Number(instrument.dataset.selectedInstantMs);
    if (!Number.isFinite(selectedMs)) {
      panel.dataset.ready = "false";
      return;
    }

    panel.dataset.selectedInstantMs = String(selectedMs);
    if (!longitudeValid) {
      panel.dataset.ready = "true";
      clearComputedState();
      empty.textContent = "經度需為 −180° 至 +180° 的有限數字。";
      longitudeInput.setAttribute("aria-invalid", "true");
      return;
    }

    let state;
    try {
      state = atlasSolarTimeAnalysisState({
        selectedMs,
        timeContext:readTimeContext(instrument),
        longitudeDegrees:longitude
      });
    } catch {
      panel.dataset.ready = "false";
      clearComputedState();
      empty.textContent = "時間基準或經度狀態無法解析。";
      return;
    }

    panel.dataset.ready = "true";
    panel.dataset.selectedInstantMs = String(state.selectedMs);
    panel.dataset.longitudeBound = String(state.bound);
    panel.dataset.utcOffsetHours = String(state.timeContext.utcOffsetHours);
    panel.dataset.dayBoundary = state.timeContext.dayBoundary;
    longitudeInput.removeAttribute("aria-invalid");

    if (!state.bound) {
      clearComputedState();
      empty.textContent = "輸入實際經度後，才比較民用、平太陽與視太陽時計時。UTC offset 不會被當成地理經度。";
      return;
    }

    empty.hidden = true;
    resultHost.hidden = false;
    panel.dataset.longitude = state.longitudeDegrees.toFixed(4);
    panel.dataset.meanSolarCorrectionMinutes = state.corrections.longitudeMinutes.toFixed(4);
    panel.dataset.equationOfTimeMinutes = state.corrections.equationOfTimeMinutes.toFixed(4);
    panel.dataset.totalSolarCorrectionMinutes = state.corrections.totalMinutes.toFixed(4);
    panel.dataset.timeBasisSensitive = state.anyChange ? "1" : "0";
    panel.dataset.daySensitive = state.anyDayChange ? "1" : "0";
    panel.dataset.hourSensitive = state.anyHourChange ? "1" : "0";

    longitudeCorrection.textContent = formatSignedMinutes(state.corrections.longitudeMinutes);
    equationOfTime.textContent = formatSignedMinutes(state.corrections.equationOfTimeMinutes);
    totalCorrection.textContent = formatSignedMinutes(state.corrections.totalMinutes);
    rowsHost.replaceChildren(...state.rows.map(row => createBasisRow(row, state.civilInput)));

    const civil = state.rows[0];
    if (state.anyChange) {
      const changed = [
        state.anyDayChange ? "日界" : null,
        state.anyHourChange ? "時辰界" : null
      ].filter(Boolean).join(" + ");
      summary.textContent = `已跨 ${changed} · 僅比較`;
    } else {
      summary.textContent = `未跨界 · ${civil.day.name}日 / ${civil.hour.name}時`;
    }
    const hemisphere = state.longitudeDegrees >= 0 ? "E" : "W";
    meta.textContent = `${hemisphere}${Math.abs(state.longitudeDegrees).toFixed(4)}° · ${formatAtlasUtcOffset(state.timeContext.utcOffsetHours)} · 年／月固定同一物理瞬間；日／時套用目前換日規則。`;
  }

  function scheduleRender() {
    if (renderTimer !== null) clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 80);
  }

  longitudeInput.addEventListener("input", () => {
    if (longitudeInput.validity.badInput) {
      longitude = null;
      longitudeValid = false;
      longitudeInput.setAttribute("aria-invalid", "true");
      scheduleRender();
      return;
    }

    const raw = longitudeInput.value.trim();
    if (raw === "") {
      longitude = null;
      longitudeValid = true;
      longitudeInput.removeAttribute("aria-invalid");
      scheduleRender();
      return;
    }
    const value = Number(raw);
    try {
      longitude = normalizeAtlasLongitude(value);
      longitudeValid = true;
      longitudeInput.removeAttribute("aria-invalid");
    } catch {
      longitude = null;
      longitudeValid = false;
      longitudeInput.setAttribute("aria-invalid", "true");
    }
    scheduleRender();
  });

  longitudeInput.addEventListener("change", () => {
    if (!longitudeValid) return;
    replaceLongitudeInUrl(longitude);
  });

  const observer = new MutationObserver(scheduleRender);
  observer.observe(instrument, {
    attributes:true,
    attributeFilter:[
      "data-analysis-open",
      "data-selected-instant-ms",
      "data-utc-offset-hours",
      "data-day-boundary"
    ]
  });

  scheduleRender();
  return panel;
}
