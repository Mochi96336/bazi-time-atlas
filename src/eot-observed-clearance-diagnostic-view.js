import { DAY_HOUR_TIME_BASIS } from "./calendar/day-hour-time-basis.js";
import { recurrenceState } from "./recurrence/gregorian-cycle.js";
import { year4006FixedZoneEotObservedBoundaryClearance } from "./recurrence/fixed-zone-eot-observed-boundary-clearance.js";

const instrument = document.querySelector("#recurrence-instrument");
let diagnosticPanel = null;
let controlsRoot = null;

function parseBaseDate() {
  const match = /^(\d+)-(\d{2})-(\d{2})$/.exec(instrument?.dataset?.baseDate ?? "");
  return match ? { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]) } : null;
}

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? "");
  if (!match) throw new RangeError("target time must be HH:MM or HH:MM:SS");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError("target time outside clock range");
  return { hour, minute, second };
}

function formatClock(clock) {
  const year = String(clock.year).padStart(4, "0");
  const month = String(clock.month).padStart(2, "0");
  const day = String(clock.day).padStart(2, "0");
  const hour = String(clock.hour).padStart(2, "0");
  const minute = String(clock.minute).padStart(2, "0");
  const second = String(clock.second).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function seconds(value) {
  return Number(value).toFixed(3);
}

function ensurePanel() {
  const root = document.querySelector("#target-instant-controls");
  if (!root) return null;
  if (diagnosticPanel?.isConnected && controlsRoot === root) return diagnosticPanel;

  controlsRoot = root;
  const panel = document.createElement("section");
  panel.id = "eot-observed-clearance-diagnostic";
  panel.className = "eot-observed-clearance-diagnostic";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="eot-clearance-head">
      <div>
        <span>Observed EoT boundary clearance · diagnostic only</span>
        <strong>4006 實證邊界餘裕</strong>
      </div>
      <b id="eot-clearance-status">—</b>
    </div>
    <div class="eot-clearance-facts">
      <span><em>LAST point</em><strong id="eot-clearance-last">—</strong></span>
      <span><em>Hour margin</em><strong id="eot-clearance-hour-margin">—</strong></span>
      <span><em>Day margin</em><strong id="eot-clearance-day-margin">—</strong></span>
      <span><em>Observed envelope</em><strong id="eot-clearance-envelope">—</strong></span>
      <span><em>Remaining</em><strong id="eot-clearance-remaining">—</strong></span>
    </div>
    <p id="eot-clearance-note">—</p>
  `;
  root.querySelector(".target-instant-fields")?.insertAdjacentElement("afterend", panel);
  if (root.dataset.eotClearanceDiagnosticBound !== "true") {
    root.addEventListener("change", scheduleRefresh);
    root.dataset.eotClearanceDiagnosticBound = "true";
  }
  diagnosticPanel = panel;
  return panel;
}

function setText(id, value) {
  const node = diagnosticPanel?.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function clearNumericDataset(panel) {
  for (const name of [
    "apparentSolarClock",
    "observedEnvelopeSeconds",
    "hourBranchMarginSeconds",
    "dayBoundaryMarginSeconds",
    "governingMarginSeconds",
    "remainingObservedMarginSeconds",
    "clearsObservedEnvelope",
    "evidenceId"
  ]) delete panel.dataset[name];
}

function renderNotApplicable(panel, targetYear, clockBasis) {
  panel.hidden = true;
  panel.dataset.available = "false";
  panel.dataset.status = "not-applicable";
  panel.dataset.targetYear = Number.isInteger(targetYear) ? String(targetYear) : "unknown";
  panel.dataset.clockBasis = clockBasis || "unbound";
  panel.dataset.deterministicMembership = "false";
  panel.dataset.recurrenceAuthorityGranted = "false";
  clearNumericDataset(panel);
}

function renderUnavailable(panel, targetYear, reason) {
  panel.hidden = false;
  panel.dataset.available = "false";
  panel.dataset.status = "unavailable";
  panel.dataset.targetYear = String(targetYear);
  panel.dataset.reason = reason;
  panel.dataset.deterministicMembership = "false";
  panel.dataset.recurrenceAuthorityGranted = "false";
  panel.dataset.continuousUpperBound = "false";
  clearNumericDataset(panel);
  setText("eot-clearance-status", "條件未完整");
  for (const id of [
    "eot-clearance-last",
    "eot-clearance-hour-margin",
    "eot-clearance-day-margin",
    "eot-clearance-envelope",
    "eot-clearance-remaining"
  ]) setText(id, "—");
  setText("eot-clearance-note", `此診斷只在 4006、fixed-zone-from-UT1、local apparent solar、日界與經度都明示時成立。目前：${reason}。`);
}

function renderResult(panel, result) {
  panel.hidden = false;
  panel.dataset.available = "true";
  panel.dataset.status = result.status;
  panel.dataset.reason = result.reason;
  panel.dataset.targetYear = String(result.targetYear);
  panel.dataset.clockBasis = DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR;
  panel.dataset.apparentSolarClock = formatClock(result.apparentSolarClock);
  panel.dataset.observedEnvelopeSeconds = String(result.observedEnvelopeSeconds);
  panel.dataset.hourBranchMarginSeconds = String(result.hourBranchMarginSeconds);
  panel.dataset.dayBoundaryMarginSeconds = String(result.dayBoundaryMarginSeconds);
  panel.dataset.governingMarginSeconds = String(result.governingMarginSeconds);
  panel.dataset.remainingObservedMarginSeconds = String(result.remainingObservedMarginSeconds);
  panel.dataset.clearsObservedEnvelope = String(result.clearsObservedEnvelope);
  panel.dataset.evidenceId = result.evidenceId;
  panel.dataset.empiricalGridOnly = String(result.empiricalGridOnly);
  panel.dataset.continuousUpperBound = String(result.continuousUpperBound);
  panel.dataset.deterministicMembership = String(result.deterministicMembership);
  panel.dataset.recurrenceAuthorityGranted = String(result.recurrenceAuthorityGranted);

  setText(
    "eot-clearance-status",
    result.clearsObservedEnvelope ? "observed envelope 未觸界" : "observed envelope 觸及邊界"
  );
  setText("eot-clearance-last", formatClock(result.apparentSolarClock));
  setText("eot-clearance-hour-margin", `${seconds(result.hourBranchMarginSeconds)} s`);
  setText("eot-clearance-day-margin", `${seconds(result.dayBoundaryMarginSeconds)} s`);
  setText("eot-clearance-envelope", `±${seconds(result.observedEnvelopeSeconds)} s`);
  setText("eot-clearance-remaining", `${seconds(result.remainingObservedMarginSeconds)} s`);
  setText(
    "eot-clearance-note",
    `Swiss 5 分鐘網格 observed envelope；只覆蓋 production EoT residual，不是 continuous upper bound。deterministicMembership=false · recurrenceAuthority=false。`
  );
}

function refresh() {
  const panel = ensurePanel();
  if (!panel || !instrument || !controlsRoot) return;

  const baseDate = parseBaseDate();
  const deltaYears = Number(instrument.dataset.deltaYears);
  if (!baseDate || !Number.isInteger(deltaYears)) {
    renderNotApplicable(panel, null, null);
    return;
  }

  const state = recurrenceState(baseDate, deltaYears);
  const targetYear = state.targetDate?.year;
  const clockBasis = controlsRoot.querySelector("#clock-basis-convention")?.value ?? "";
  if (targetYear !== 4006 || clockBasis !== DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR) {
    renderNotApplicable(panel, targetYear, clockBasis);
    return;
  }

  if (controlsRoot.querySelector("#target-instant-enabled")?.checked !== true) {
    renderUnavailable(panel, targetYear, "target clock 未啟用");
    return;
  }
  if (!state.targetValid) {
    renderUnavailable(panel, targetYear, "target Gregorian date 無效");
    return;
  }

  const dayBoundary = controlsRoot.querySelector("#day-boundary-convention")?.value ?? "";
  if (!dayBoundary) {
    renderUnavailable(panel, targetYear, "Day boundary 未綁定");
    return;
  }

  const rawLongitude = controlsRoot.querySelector("#longitude-degrees")?.value?.trim() ?? "";
  if (!rawLongitude || controlsRoot.dataset.longitudeValid === "false") {
    renderUnavailable(panel, targetYear, "longitude 未綁定或無效");
    return;
  }

  try {
    const time = parseTime(controlsRoot.querySelector("#target-instant-time")?.value ?? "");
    const offset = Number(controlsRoot.querySelector("#target-instant-offset")?.value);
    const longitudeDegrees = Number(rawLongitude);
    const result = year4006FixedZoneEotObservedBoundaryClearance(
      { ...state.targetDate, ...time },
      longitudeDegrees,
      offset,
      { dayBoundary }
    );
    renderResult(panel, result);
  } catch (error) {
    renderUnavailable(panel, targetYear, error.message);
  }
}

let queued = false;
function scheduleRefresh() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    refresh();
  });
}

if (instrument) {
  new MutationObserver(scheduleRefresh).observe(instrument, {
    attributes:true,
    attributeFilter:["data-base-date", "data-delta-years", "data-astronomy-validity"]
  });
  scheduleRefresh();
}
