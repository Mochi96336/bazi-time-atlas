import {
  RESEARCH_TIME_SELECTION_EVENT,
  researchDiscreteDateState,
  researchSeasonalTimeState
} from "./research/research-time-state.js";

const root = document.querySelector("#research-time-state");
const instrument = document.querySelector("#recurrence-instrument");
const discreteSection = document.querySelector("#research-discrete");
const astronomySection = document.querySelector("#research-astronomy");
const evidenceSection = document.querySelector("#research-evidence");
const seasonalRoot = document.querySelector("#seasonal-drift-evidence");

if (root) {
  const PILLARS = ["year","month","day","hour"];
  let activeOwner = null;
  let viewportSyncQueued = false;
  const labels = Object.freeze({
    year:"年",
    month:"月",
    day:"日",
    hour:"時"
  });

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function parseDate(value) {
    const match = /^(\d{1,8})-(\d{2})-(\d{2})$/.exec(value ?? "");
    if (!match) return null;
    return {
      year:Number(match[1]),
      month:Number(match[2]),
      day:Number(match[3])
    };
  }

  function pad(value) {
    return String(value).padStart(2,"0");
  }

  function formatDate(date) {
    return date ? `${date.year}/${pad(date.month)}/${pad(date.day)}` : "—";
  }

  function formatClock(clock) {
    if (!clock) return "—";
    const second = Number.isFinite(clock.second) ? Math.floor(clock.second) : 0;
    return `${clock.year}/${pad(clock.month)}/${pad(clock.day)} ${pad(clock.hour)}:${pad(clock.minute)}:${pad(second)}`;
  }

  function statusLabel(status) {
    if (status === "resolved") return "已解析";
    if (status === "research-resolved") return "研究可判";
    if (status === "sequence-only") return "序列";
    return "未定";
  }

  function renderPillars(side, state) {
    for (const key of PILLARS) {
      const pillar = state?.pillars?.[key] ?? null;
      const node = document.querySelector(`[data-research-time-side="${side}"] [data-research-time-pillar="${key}"]`);
      if (!node) continue;
      node.dataset.status = pillar?.status ?? "unresolved";
      const value = node.querySelector("strong");
      const meta = node.querySelector("small");
      if (value) value.textContent = pillar?.name ?? "—";
      if (meta) meta.textContent = statusLabel(pillar?.status ?? "unresolved");
      node.title = pillar?.reason ?? "";
    }
  }

  function renderDiscrete(state) {
    root.dataset.owner = "discrete";
    setText("research-time-kicker","01 · 日期／離散序列");
    setText("research-time-title",`基準 ${formatDate(state.selection.baseDate)} · Δ ${state.comparison.deltaYears.toLocaleString("en-US")} 年`);
    setText("research-time-base-coordinate",`${formatDate(state.selection.baseDate)} · 日內時刻未綁定`);
    setText("research-time-target-coordinate",state.selection.targetDate
      ? `${formatDate(state.selection.targetDate)} · 日內時刻未綁定`
      : "比較日期不存在");
    setText("research-time-basis","日期層只顯示可由離散序列確定的部分；月柱與時柱不猜。");
    renderPillars("base",state.base);
    renderPillars("target",state.target);
    root.dataset.ready = "true";
  }

  function renderSeasonal(state) {
    root.dataset.owner = "seasonal";
    const term = state.selection.termName
      ? `${state.selection.termName} · ${state.selection.longitudeDegrees}°`
      : `${state.selection.longitudeDegrees}° · ${state.selection.baziMonthBranch}月區段`;
    setText("research-time-kicker","02 · 太陽黃經／八字節界");
    setText("research-time-title",term);
    setText(
      "research-time-base-coordinate",
      `${formatClock(state.base.coordinate.localClock)} · UTC+08:00`
    );
    const targetUncertainty = Number.isFinite(state.target.coordinate.uncertaintyDays)
      ? ` · UT1 ±約 ${state.target.coordinate.uncertaintyDays.toFixed(1)} d (1σ)`
      : "";
    setText(
      "research-time-target-coordinate",
      `26026 crossing · TT${targetUncertainty}`
    );
    setText(
      "research-time-basis",
      `同一太陽黃經；26026 相對 24,000 Gregorian years 提前 ${Math.abs(state.comparison.driftDays).toFixed(3)} 天。年／月可由節界判定，日／時不以深時間點估計冒充確定值。`
    );
    renderPillars("base",state.base);
    renderPillars("target",state.target);
    root.dataset.ready = "true";
  }

  function renderSelection(detail) {
    if (!detail || typeof detail !== "object") return false;
    try {
      if (detail.owner === "seasonal") {
        renderSeasonal(researchSeasonalTimeState(detail.longitudeDegrees));
        activeOwner = "seasonal";
        return true;
      }
      if (detail.owner === "discrete") {
        const baseDate = detail.baseDate ?? parseDate(instrument?.dataset.baseDate);
        const deltaYears = Number.isInteger(detail.deltaYears)
          ? detail.deltaYears
          : Number(instrument?.dataset.deltaYears);
        if (!baseDate || !Number.isInteger(deltaYears)) return false;
        renderDiscrete(researchDiscreteDateState(baseDate,deltaYears));
        activeOwner = "discrete";
        return true;
      }
    } catch (error) {
      root.dataset.ready = "error";
      setText("research-time-basis",`時間狀態無法解析：${error.message}`);
    }
    return false;
  }

  document.addEventListener(RESEARCH_TIME_SELECTION_EVENT, event => {
    renderSelection(event.detail);
  });

  function discreteSelectionFromDom() {
    const baseDate = parseDate(instrument?.dataset.baseDate);
    const deltaYears = Number(instrument?.dataset.deltaYears);
    return baseDate && Number.isInteger(deltaYears)
      ? { owner:"discrete", baseDate, deltaYears }
      : null;
  }

  function seasonalSelectionFromDom() {
    const longitudeDegrees = Number(seasonalRoot?.dataset.selectedLongitude);
    return Number.isFinite(longitudeDegrees)
      ? { owner:"seasonal", longitudeDegrees, source:"viewport" }
      : null;
  }

  function ownerAtReadingLine() {
    const readingY = Math.min(window.innerHeight * 0.30, 240);
    const contains = section => {
      if (!section) return false;
      const rect = section.getBoundingClientRect();
      return rect.top <= readingY && rect.bottom > readingY;
    };
    if (contains(astronomySection) || contains(evidenceSection)) return "seasonal";
    if (contains(discreteSection)) return "discrete";
    return activeOwner ?? "discrete";
  }

  function syncOwnerFromViewport() {
    viewportSyncQueued = false;
    syncStickyPresentation();
    const owner = ownerAtReadingLine();
    if (owner === activeOwner) return;
    const selection = owner === "seasonal"
      ? seasonalSelectionFromDom()
      : discreteSelectionFromDom();
    if (selection) renderSelection(selection);
  }

  function syncStickyPresentation() {
    const top = Number.parseFloat(getComputedStyle(root).top) || 0;
    const rect = root.getBoundingClientRect();
    root.dataset.stuck = String(window.scrollY > 0 && rect.top <= top + 1);
  }

  function queueViewportSync() {
    if (viewportSyncQueued) return;
    viewportSyncQueued = true;
    requestAnimationFrame(syncOwnerFromViewport);
  }

  const initialSelection = discreteSelectionFromDom();
  if (initialSelection) renderSelection(initialSelection);
  root.dataset.stuck = "false";
  queueViewportSync();
  window.addEventListener("scroll",queueViewportSync,{ passive:true });
  window.addEventListener("resize",queueViewportSync);
}