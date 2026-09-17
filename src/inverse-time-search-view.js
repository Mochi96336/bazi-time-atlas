import { searchInversePillarIntervals } from "./search/inverse-pillar-search.js";
import { sexagenaryCycle } from "./sexagenary-data.js";
import { normalizeAtlasTimeContext } from "./wheel/atlas-time-context.js";
import {
  civilFieldsFromInstant,
  formatAtlasCivil
} from "./wheel/atlas-display-model.js";
import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";

const PILLAR_LABELS = Object.freeze({
  year:"年",
  month:"月",
  day:"日",
  hour:"時"
});

const SEARCH_RANGES = Object.freeze({
  month:Object.freeze({ label:"前後 30 日", spanMs:30 * 86_400_000 }),
  year:Object.freeze({ label:"前後 1 年", spanMs:366 * 86_400_000 }),
  fiveYear:Object.freeze({ label:"前後 5 年", spanMs:5 * 366 * 86_400_000 })
});

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

function optionMarkup() {
  return [
    '<option value="*">任意</option>',
    ...sexagenaryCycle.map(item => `<option value="${item.name}">${item.name}</option>`)
  ].join("");
}

function createPanel(documentRef) {
  const panel = documentRef.createElement("section");
  panel.id = "inverse-time-search-panel";
  panel.className = "inverse-time-search-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "反向找時間");
  panel.innerHTML = `
    <header class="inverse-search-head">
      <div>
        <strong>找時間</strong>
        <small>鎖定四柱條件，反向找真正成立的時間。</small>
      </div>
      <button type="button" class="inverse-search-close" aria-label="關閉找時間">關閉</button>
    </header>
    <div class="inverse-search-constraints" role="group" aria-label="四柱搜尋條件">
      ${["year", "month", "day", "hour"].map(id => `
        <label>
          <span>${PILLAR_LABELS[id]}</span>
          <select data-inverse-pillar="${id}" aria-label="${PILLAR_LABELS[id]}柱條件">${optionMarkup()}</select>
        </label>
      `).join("")}
    </div>
    <div class="inverse-search-actions">
      <button type="button" data-inverse-current>鎖定目前四柱</button>
      <button type="button" data-inverse-clear>清空</button>
      <label class="inverse-search-range">
        <span>搜尋範圍</span>
        <select data-inverse-range>
          ${Object.entries(SEARCH_RANGES).map(([id, range]) => `<option value="${id}"${id === "year" ? " selected" : ""}>${range.label}</option>`).join("")}
        </select>
      </label>
      <button type="button" data-inverse-run>搜尋</button>
    </div>
    <p class="inverse-search-status" data-inverse-status>先鎖定至少一柱。</p>
    <div class="inverse-search-results" data-inverse-results aria-live="polite"></div>
  `;
  return panel;
}

function formatInstant(instantMs, context) {
  return formatAtlasCivil(civilFieldsFromInstant(instantMs, context));
}

export function formatInverseMatchPillars(pillars = {}) {
  return Object.entries(PILLAR_LABELS)
    .flatMap(([id, label]) => pillars[id]?.name ? [`${label} ${pillars[id].name}`] : [])
    .join(" · ");
}

function constraintsFromPanel(panel) {
  return Object.fromEntries(
    [...panel.querySelectorAll("[data-inverse-pillar]")]
      .map(select => [select.dataset.inversePillar, select.value])
  );
}

function setConstraintsToCurrent(panel, instrument) {
  const values = {
    year:instrument.dataset.yearPillar,
    month:instrument.dataset.monthPillar,
    day:instrument.dataset.dayPillar,
    hour:instrument.dataset.hourPillar
  };
  for (const select of panel.querySelectorAll("[data-inverse-pillar]")) {
    select.value = values[select.dataset.inversePillar] || "*";
  }
}

function clearConstraints(panel) {
  panel.querySelectorAll("[data-inverse-pillar]").forEach(select => {
    select.value = "*";
  });
}

function renderResults(panel, result, context, documentRef, onSelect) {
  const status = panel.querySelector("[data-inverse-status]");
  const results = panel.querySelector("[data-inverse-results]");
  results.replaceChildren();

  if (!result.matches.length) {
    status.textContent = `這個範圍沒有符合時間 · 掃過 ${result.stats.boundarySteps} 個實際邊界區間`;
    return;
  }

  status.textContent = `${result.matches.length} 個符合區間${result.truncated ? "（結果已截斷）" : ""} · ${result.stats.boundarySteps} 個邊界區間`;
  for (const match of result.matches) {
    const instantMs = Math.round(match.startMs + Math.max(0, match.endMs - match.startMs) / 2);
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "inverse-search-result";
    button.dataset.instantMs = String(instantMs);
    button.innerHTML = `
      <strong>${formatInstant(match.startMs, context)}</strong>
      <span>≤ t &lt; ${formatInstant(match.endMs, context)}</span>
      <small>${formatInverseMatchPillars(match.pillars) || "符合條件"}</small>
    `;
    button.addEventListener("click", () => onSelect(instantMs, context));
    results.append(button);
  }
}

export function installInverseTimeSearch(instrument, documentRef = document) {
  if (!instrument) return null;

  // Free Compare remains an internal regression capability, but it is no longer
  // a product affordance. Keep the controller/fixtures intact while replacing
  // the visible entry with the real inverse-time path.
  const compareButton = documentRef.querySelector("#compare-rings-button");
  if (compareButton) {
    compareButton.hidden = true;
    compareButton.dataset.productEntry = "retired";
  }

  if (documentRef.querySelector("#inverse-time-search-button")) return null;

  const nowButton = documentRef.querySelector("#now-button");
  const actionGroup = nowButton?.parentElement;
  if (!actionGroup) return null;

  const button = documentRef.createElement("button");
  button.id = "inverse-time-search-button";
  button.className = "control-button";
  button.type = "button";
  button.textContent = "找時間";
  button.title = "以年、月、日、時柱條件反向搜尋真正成立的時間";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "inverse-time-search-panel");
  actionGroup.insertBefore(button, nowButton);

  const panel = createPanel(documentRef);
  instrument.insertAdjacentElement("afterend", panel);

  const closePanel = ({ focus = false } = {}) => {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  };

  const open = () => {
    const willOpen = panel.hidden;
    if (!willOpen) {
      closePanel();
      return;
    }
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    setConstraintsToCurrent(panel, instrument);
    panel.querySelector("[data-inverse-status]").textContent = "目前四柱已鎖定；可把任一柱改成「任意」或其他干支。";
  };

  button.addEventListener("click", open);
  panel.querySelector(".inverse-search-close")?.addEventListener("click", () => closePanel({ focus:true }));
  panel.querySelector("[data-inverse-current]")?.addEventListener("click", () => {
    setConstraintsToCurrent(panel, instrument);
    panel.querySelector("[data-inverse-status]").textContent = "已鎖定目前四柱。";
  });
  panel.querySelector("[data-inverse-clear]")?.addEventListener("click", () => {
    clearConstraints(panel);
    panel.querySelector("[data-inverse-status]").textContent = "先鎖定至少一柱。";
    panel.querySelector("[data-inverse-results]").replaceChildren();
  });
  panel.querySelector("[data-inverse-run]")?.addEventListener("click", () => {
    const status = panel.querySelector("[data-inverse-status]");
    const rangeId = panel.querySelector("[data-inverse-range]")?.value ?? "year";
    const range = SEARCH_RANGES[rangeId] ?? SEARCH_RANGES.year;

    try {
      const selectedMs = selectedInstant(instrument);
      const context = currentTimeContext(instrument);
      status.textContent = "搜尋中…";
      const result = searchInversePillarIntervals({
        constraints:constraintsFromPanel(panel),
        startMs:selectedMs - range.spanMs,
        endMs:selectedMs + range.spanMs,
        timeContext:context,
        maxResults:48
      });
      renderResults(panel, result, context, documentRef, (instantMs, resultContext) => {
        let liveContext;
        try {
          liveContext = currentTimeContext(instrument);
        } catch {
          status.textContent = "目前時間基準無效，請重新設定後搜尋。";
          return;
        }
        if (!sameTimeContext(liveContext, resultContext)) {
          status.textContent = "時間基準已變更，請重新搜尋。";
          return;
        }
        instrument.dispatchEvent(new CustomEvent(SELECTED_INSTANT_COMMAND, {
          bubbles:true,
          detail:{ instantMs, source:"inverse-time-search" }
        }));
        closePanel();
      });
    } catch (error) {
      const message = error?.message ?? String(error);
      status.textContent = /requires at least one constrained pillar/.test(message)
        ? "至少鎖定一柱，才能反向搜尋。"
        : `搜尋失敗：${message}`;
    }
  });

  documentRef.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    closePanel({ focus:true });
  });

  instrument.dataset.inverseTimeSearch = "available";
  return Object.freeze({ button, panel });
}

export { SEARCH_RANGES };
