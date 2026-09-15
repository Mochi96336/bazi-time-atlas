import { deepTimeEarthRotationEstimateSupportsYear } from "./astronomy/deep-time-earth-rotation.js";
import { DAY_BOUNDARY, DAY_BOUNDARY_VALUES } from "./calendar/day-boundary.js";
import { currentRecurrenceDayHourProof } from "./recurrence/day-hour-proof-chain.js";
import { fixedZoneTargetClock } from "./recurrence/fixed-zone-target-clock.js";
import { recurrenceState } from "./recurrence/gregorian-cycle.js";
import { seasonalEpochSourceAudit } from "./recurrence/seasonal-epoch-source-audit.js";

const instrument = document.querySelector("#recurrence-instrument");
const determinacyPanel = document.querySelector("#four-pillar-determinacy");
let proofPanel = null;
let epochAuditPanel = null;
let targetClockControls = null;

const TARGET_CLOCK_MODE = "fixed-zone";
const DEFAULT_TARGET_TIME = "12:00:00";
const DEFAULT_UT1_OFFSET_HOURS = 8;

const STATUS_LABELS = Object.freeze({
  satisfied:"已有",
  "uncertain-estimate":"有估計 · 不確定",
  "missing-deep-time-model":"缺深時間模型",
  "missing-model":"缺模型",
  blocked:"前置阻塞",
  "unbound-convention":"尚未綁定",
  conditional:"條件式",
  "not-required":"不需要"
});

const AUDIT_STATUS_LABELS = Object.freeze({
  "identity-bypass":"同一狀態 · 不需跨 epoch",
  resolved:"已有 seasonal TT anchors runtime",
  "qualified-direct-event-provider-not-integrated":"direct seasonal event 有 · 尚未整合",
  "qualified-ephemeris-basis-not-integrated":"absolute state coverage 有 · solver 尚未整合",
  "state-adapter-runtime-coverage-undeclared":"state adapter 已註冊 · runtime coverage 未宣告",
  "state-adapter-runtime-coverage-gap":"state adapter runtime coverage gap",
  "deep-time-seasonal-epoch-solver-incomplete":"absolute state 有 · seasonal solver 未完成",
  "absolute-state-coverage-gap":"absolute-state ephemeris coverage gap"
});

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function ensureTargetClockStyles() {
  if (document.querySelector("link[data-target-clock-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./recurrence-target-clock.css";
  link.dataset.targetClockStyles = "1";
  document.head.appendChild(link);
}

function normalizedTargetTime(value) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? "");
  if (!match) throw new RangeError("target time must be HH:MM or HH:MM:SS");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError("target time is outside the civil clock range");
  return Object.freeze({
    hour,
    minute,
    second,
    text:`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
  });
}

function parseBaseDate() {
  const match = /^(\d+)-(\d{2})-(\d{2})$/.exec(instrument?.dataset?.baseDate ?? "");
  return match ? { year:Number(match[1]), month:Number(match[2]), day:Number(match[3]) } : null;
}

function targetClockPreset() {
  const params = new URLSearchParams(location.search);
  const enabled = params.get("targetClock") === TARGET_CLOCK_MODE;
  const rawTime = params.get("targetTime") ?? DEFAULT_TARGET_TIME;
  const rawOffset = params.get("ut1Offset") ?? String(DEFAULT_UT1_OFFSET_HOURS);
  const rawDayBoundary = params.get("dayBoundary") ?? "";
  const dayBoundaryValid = rawDayBoundary === "" || DAY_BOUNDARY_VALUES.includes(rawDayBoundary);
  return Object.freeze({ enabled, rawTime, rawOffset, rawDayBoundary, dayBoundaryValid });
}

function syncTargetClockQuery() {
  if (!targetClockControls) return;
  const url = new URL(location.href);
  const enabled = targetClockControls.enabled.checked;
  if (enabled) {
    url.searchParams.set("targetClock", TARGET_CLOCK_MODE);
    url.searchParams.set("targetTime", targetClockControls.time.value || DEFAULT_TARGET_TIME);
    url.searchParams.set("ut1Offset", targetClockControls.offset.value || String(DEFAULT_UT1_OFFSET_HOURS));
  } else {
    url.searchParams.delete("targetClock");
    url.searchParams.delete("targetTime");
    url.searchParams.delete("ut1Offset");
  }
  const dayBoundary = targetClockControls.dayBoundary.value;
  if (DAY_BOUNDARY_VALUES.includes(dayBoundary)) {
    url.searchParams.set("dayBoundary", dayBoundary);
  } else {
    url.searchParams.delete("dayBoundary");
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function setTargetClockEnabledState() {
  if (!targetClockControls) return;
  const enabled = targetClockControls.enabled.checked;
  targetClockControls.root.dataset.enabled = String(enabled);
  targetClockControls.time.disabled = !enabled;
  targetClockControls.offset.disabled = !enabled;
}

function ensureTargetClockControls(panel) {
  if (targetClockControls?.root?.isConnected) return targetClockControls;
  ensureTargetClockStyles();
  const preset = targetClockPreset();
  const root = document.createElement("div");
  root.id = "target-instant-controls";
  root.className = "target-instant-controls";
  root.innerHTML = `
    <div class="target-instant-control-head">
      <div>
        <span>Target / Day boundary · research conventions</span>
        <strong>日內時刻與日界預設都不綁定</strong>
      </div>
      <label class="target-instant-toggle"><input id="target-instant-enabled" type="checkbox"> <span>fixed-zone-from-UT1</span></label>
    </div>
    <div class="target-instant-fields">
      <label>Target local clock<input id="target-instant-time" type="time" step="1" value="${DEFAULT_TARGET_TIME}"></label>
      <label>Fixed offset from UT1<input id="target-instant-offset" type="number" min="-14" max="14" step="0.25" value="${DEFAULT_UT1_OFFSET_HOURS}"></label>
      <label>Day boundary<select id="day-boundary-convention">
        <option value="">Not selected</option>
        <option value="${DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY}">子初 23:00 → 次日</option>
        <option value="${DAY_BOUNDARY.CIVIL_MIDNIGHT}">民用午夜 00:00</option>
      </select></label>
      <output id="target-instant-status" aria-live="polite">date-only · 未建立日內 target instant</output>
    </div>
    <p>fixed-zone-from-UT1 是 proleptic Gregorian + 固定 UT1 offset 的研究座標，不是西元遠未來 UTC、DST 或政治時區預測。Day boundary 也必須獨立明示採用既有 Birth canonical rule；兩者都不會自動選定 Day / Hour local clock basis。</p>
  `;
  panel.querySelector(".proof-chain-head")?.insertAdjacentElement("afterend", root);

  const enabled = root.querySelector("#target-instant-enabled");
  const time = root.querySelector("#target-instant-time");
  const offset = root.querySelector("#target-instant-offset");
  const dayBoundary = root.querySelector("#day-boundary-convention");
  const status = root.querySelector("#target-instant-status");
  enabled.checked = preset.enabled;
  time.value = preset.rawTime;
  offset.value = preset.rawOffset;
  dayBoundary.value = preset.dayBoundaryValid ? preset.rawDayBoundary : "";
  root.dataset.dayBoundaryValid = String(preset.dayBoundaryValid);
  root.dataset.dayBoundary = dayBoundary.value || "unbound";
  targetClockControls = { root, enabled, time, offset, dayBoundary, status };
  setTargetClockEnabledState();

  enabled.addEventListener("change", () => {
    setTargetClockEnabledState();
    syncTargetClockQuery();
    scheduleRefresh();
  });
  for (const input of [time, offset]) {
    input.addEventListener("change", () => {
      syncTargetClockQuery();
      scheduleRefresh();
    });
  }
  dayBoundary.addEventListener("change", () => {
    root.dataset.dayBoundaryValid = "true";
    root.dataset.dayBoundary = dayBoundary.value || "unbound";
    syncTargetClockQuery();
    scheduleRefresh();
  });
  return targetClockControls;
}

function selectedDayBoundary() {
  const value = targetClockControls?.dayBoundary.value ?? "";
  return DAY_BOUNDARY_VALUES.includes(value) ? value : null;
}

function targetInstantForCurrentState(deltaYears) {
  const controls = targetClockControls;
  if (!controls?.enabled.checked) {
    if (controls) {
      controls.root.dataset.valid = "true";
      controls.root.dataset.basis = "date-only";
      controls.status.textContent = "date-only · 未建立日內 target instant";
    }
    return null;
  }

  try {
    const baseDate = parseBaseDate();
    if (!baseDate) throw new RangeError("base date unavailable");
    const state = recurrenceState(baseDate, deltaYears);
    if (!state.targetValid) throw new RangeError("target Gregorian date does not exist");
    const time = normalizedTargetTime(controls.time.value);
    const offset = Number(controls.offset.value);
    const projection = fixedZoneTargetClock({ ...state.targetDate, ...time }, offset);
    controls.root.dataset.valid = "true";
    controls.root.dataset.basis = projection.targetInstant.basis;
    controls.root.dataset.ut1JulianDay = String(projection.ut1JulianDay);
    controls.root.dataset.localOffsetHoursFromUt1 = String(offset);
    controls.status.textContent = `${state.targetDate.year}-${String(state.targetDate.month).padStart(2, "0")}-${String(state.targetDate.day).padStart(2, "0")} ${time.text} · UT1 JD ${projection.ut1JulianDay.toFixed(6)} · offset ${offset >= 0 ? "+" : ""}${offset} h`;
    return projection.targetInstant;
  } catch (error) {
    controls.root.dataset.valid = "false";
    controls.root.dataset.basis = "date-only";
    delete controls.root.dataset.ut1JulianDay;
    controls.status.textContent = `無效 · ${error.message}`;
    return null;
  }
}

function ensurePanel() {
  if (proofPanel?.isConnected) return proofPanel;
  if (!determinacyPanel) return null;

  const panel = document.createElement("section");
  panel.id = "day-hour-proof-chain";
  panel.className = "proof-chain-panel";
  panel.setAttribute("aria-label", "日柱與時柱從相對節氣到絕對地方時的證明鏈");
  panel.innerHTML = `
    <div class="proof-chain-head">
      <div>
        <div class="eyebrow">Day / Hour resolution proof chain</div>
        <h2>要把日柱、時柱解鎖，真正缺的是哪一層？</h2>
        <p>這裡把 seasonal TT anchors、target instant reference basis、Earth rotation，以及 Day / Hour 的 local clock convention 分開。4006 有節氣 anchors，不代表 recurrence 已經有可投影的 TT / UT1 target instant。</p>
      </div>
      <div class="proof-chain-blocker">
        <span>First hard blocker</span>
        <strong id="proof-chain-first-blocker">—</strong>
        <small id="proof-chain-resolution-summary">—</small>
      </div>
    </div>
    <div id="proof-chain-stages" class="proof-chain-stages"></div>
    <div class="proof-chain-foot">
      <div><span>Day proof</span><strong id="proof-chain-day-status">—</strong><small id="proof-chain-day-blockers">—</small></div>
      <div><span>Hour proof</span><strong id="proof-chain-hour-status">—</strong><small id="proof-chain-hour-blockers">—</small></div>
    </div>
  `;
  determinacyPanel.insertAdjacentElement("afterend", panel);
  proofPanel = panel;
  ensureTargetClockControls(panel);
  return panel;
}

function ensureEpochAuditPanel() {
  const proof = ensurePanel();
  if (epochAuditPanel?.isConnected) return epochAuditPanel;
  if (!proof) return null;
  const panel = document.createElement("section");
  panel.id = "seasonal-epoch-source-audit";
  panel.className = "epoch-audit-panel";
  panel.setAttribute("aria-label", "絕對季節 epoch 的天文資料來源能力稽核");
  panel.innerHTML = `
    <div class="epoch-audit-head">
      <div>
        <div class="eyebrow">Absolute seasonal epoch · source audit</div>
        <h2>有 seasonal crossings，不代表 target instant 已綁定。</h2>
        <p>這裡只稽核 source/provider 能否提供 absolute seasonal anchors。direct-event runtime 的 canonical crossings 與 recurrence 的 typed target-instant reference basis 是不同能力；後者必須由 target-instant contract 明示，不從 anchors 推定。</p>
      </div>
      <div class="epoch-audit-summary">
        <span>Target / verdict</span>
        <strong id="epoch-audit-target">—</strong>
        <small id="epoch-audit-verdict">—</small>
      </div>
    </div>
    <div id="epoch-audit-sources" class="epoch-audit-sources"></div>
    <div class="epoch-audit-foot" id="epoch-audit-footnote">—</div>
  `;
  proof.insertAdjacentElement("afterend", panel);
  epochAuditPanel = panel;
  return panel;
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

function readableBlocker(name) {
  const labels = {
    relativeTermGeometry:"相對節氣幾何",
    absoluteSeasonalEpoch:"絕對 seasonal anchors",
    targetInstantBound:"target instant reference basis",
    earthRotationBridge:"TT↔UT1 / ΔT",
    localZoneBound:"地方鐘面／zone convention",
    dayBoundaryBound:"日界規則",
    sexagenaryDayArithmetic:"干支日序算術",
    resolvedDayPillar:"已解析日柱",
    clockBasisBound:"local clock basis",
    longitudeBound:"經度",
    equationOfTimeModel:"Equation of Time",
    hourBranchRule:"時支規則",
    fiveRatsRule:"五鼠遁"
  };
  return labels[name] ?? name;
}

function renderStage(stage) {
  const item = document.createElement("article");
  item.className = "proof-chain-stage";
  item.dataset.proofStage = stage.id;
  item.dataset.status = stage.status;
  item.dataset.kind = stage.kind;
  item.innerHTML = `
    <div><span>${stage.label}</span><strong>${statusLabel(stage.status)}</strong></div>
    <p>${stage.detail}</p>
  `;
  return item;
}

function formatYear(year) {
  return year >= 0 ? String(year) : `${Math.abs(year)} BCE`;
}

function renderEpochSource(item) {
  const article = document.createElement("article");
  article.className = "epoch-audit-source";
  article.dataset.epochSource = item.id;
  article.dataset.coversTarget = String(item.coversTarget);
  article.dataset.ephemerisBasisCapable = String(item.ephemerisBasisCapable);
  article.dataset.directSeasonalEpoch = String(item.directSeasonalEpoch);
  article.dataset.implementedAsBasis = String(item.implementedAsBasis);
  article.dataset.implementedDirectProvider = String(item.implementedDirectProvider);
  article.dataset.qualifiedCoverage = String(item.qualifiedCoverage);
  article.dataset.reason = item.reason;

  const coverage = `${formatYear(item.coverage.minYear)} → ${formatYear(item.coverage.maxYear)}`;
  const inApp = item.implementedAsBasis || item.implementedDirectProvider;
  const verdict = item.usableNow
    ? "anchors runtime 可用"
    : item.qualifiedCoverage && item.directSeasonalEpoch
      ? "direct event ✓ · 尚未整合"
      : item.qualifiedCoverage
        ? "absolute state ✓ · solver 尚未整合"
        : item.coversTarget
          ? "coverage ✓ · 無 absolute epoch"
          : "超出 coverage";

  article.innerHTML = `
    <header><div><span>${item.authority}</span><strong>${item.label}</strong></div><b>${verdict}</b></header>
    <div class="epoch-audit-facts">
      <span><em>Coverage</em><strong>${coverage}</strong></span>
      <span><em>Absolute state</em><strong>${item.ephemerisBasisCapable ? "yes" : "no"}</strong></span>
      <span><em>Direct event</em><strong>${item.directSeasonalEpoch ? "yes" : "no"}</strong></span>
      <span><em>In app</em><strong>${inApp ? "yes" : "no"}</strong></span>
    </div>
    <p>${item.note}</p>
  `;
  return article;
}

function renderEpochAudit(baseYear, targetYear, audit) {
  const panel = ensureEpochAuditPanel();
  if (!panel || !instrument) return;
  panel.querySelector("#epoch-audit-sources")?.replaceChildren(...audit.evaluations.map(renderEpochSource));
  setText("epoch-audit-target", `${targetYear} · ${AUDIT_STATUS_LABELS[audit.status] ?? audit.status}`);
  setText("epoch-audit-verdict", audit.identity
    ? "Δ=0 不需要跨 epoch source。"
    : audit.status === "resolved"
      ? `已由 ${audit.usableSourceIds.join(" · ")} 提供可呼叫的 seasonal TT anchors；這不會自動綁定 recurrence target instant。`
      : audit.status === "qualified-ephemeris-basis-not-integrated"
        ? "DE441 涵蓋目標年的 absolute Earth/Sun state；仍須整合 source adapter、黃經-of-date transform 與 crossing root solve。"
        : audit.status === "absolute-state-coverage-gap"
          ? `現有 registry 沒有同時涵蓋 ${targetYear} 且提供 absolute state 或 direct seasonal event 的 source。`
          : "absolute seasonal epoch pipeline 尚未滿足完整 runtime contract。"
  );
  const gap = audit.nearestEphemerisBoundary;
  setText("epoch-audit-footnote", audit.status === "resolved"
    ? `Production runtime coverage 只認 provider 自己宣告的年份；目前 usable anchors：${audit.usableSourceIds.join(" · ")}。target instant 仍須獨立使用 typed TT / UT1 / fixed-zone-from-UT1 contract。`
    : gap && !audit.identity
      ? `最近的 absolute seasonal-epoch source 邊界：${gap.sourceId} → ${formatYear(gap.boundaryYear)}；距目標 ${gap.gapYears.toLocaleString("en-US")} 年。長期 shape/parameter coverage 不會被當成 absolute state 或 timestamp coverage。`
      : "source coverage、absolute-state capability、direct-event runtime 與 seasonal-epoch solver 分開記錄。"
  );

  panel.dataset.ready = "true";
  panel.dataset.baseYear = String(baseYear);
  panel.dataset.targetYear = String(targetYear);
  panel.dataset.auditStatus = audit.status;
  panel.dataset.blocker = audit.blocker ?? "none";
  panel.dataset.qualifiedSourceCount = String(audit.qualifiedSourceIds.length);
  panel.dataset.usableSourceCount = String(audit.usableSourceIds.length);
  panel.dataset.seasonalEpochSolverRequired = String(audit.seasonalEpochSolverRequired);
  panel.dataset.nearestEphemerisBoundaryYear = gap ? String(gap.boundaryYear) : "none";
  panel.dataset.nearestEphemerisGapYears = gap ? String(gap.gapYears) : "none";

  const de441 = audit.evaluations.find(item => item.id === "jpl-de441");
  instrument.dataset.seasonalEpochAuditStatus = audit.status;
  instrument.dataset.seasonalEpochAuditTargetYear = String(targetYear);
  instrument.dataset.seasonalEpochDe441Covered = String(de441?.coversTarget ?? false);
  instrument.dataset.seasonalEpochDe441BasisCapable = String(de441?.ephemerisBasisCapable ?? false);
  instrument.dataset.seasonalEpochQualifiedSourceCount = String(audit.qualifiedSourceIds.length);
  instrument.dataset.seasonalEpochUsableSourceCount = String(audit.usableSourceIds.length);
  instrument.dataset.seasonalEpochSolverRequired = String(audit.seasonalEpochSolverRequired);
  instrument.dataset.seasonalEpochNearestEphemerisGapYears = gap ? String(gap.gapYears) : "none";
}

function parseBaseYear() {
  return parseBaseDate()?.year ?? null;
}

function refresh() {
  const panel = ensurePanel();
  if (!panel || !instrument) return;
  const deltaYears = Number(instrument.dataset.deltaYears);
  const astronomyValidity = instrument.dataset.astronomyValidity;
  const baseYear = parseBaseYear();
  if (!Number.isInteger(deltaYears) || !astronomyValidity || !Number.isInteger(baseYear)) {
    panel.dataset.ready = "false";
    if (epochAuditPanel) epochAuditPanel.dataset.ready = "false";
    return;
  }

  const identity = deltaYears === 0;
  const targetYear = baseYear + deltaYears;
  const audit = seasonalEpochSourceAudit({ baseYear, targetYear });
  const targetInstant = targetInstantForCurrentState(deltaYears);
  const dayBoundary = selectedDayBoundary();
  const earthRotationEstimateAvailable = audit.absoluteSeasonalEpochAvailable
    && deepTimeEarthRotationEstimateSupportsYear(targetYear);
  const proof = currentRecurrenceDayHourProof({
    identity,
    astronomyWithinRange:astronomyValidity === "within-range",
    absoluteSeasonalEpoch:audit.absoluteSeasonalEpochAvailable,
    targetInstant,
    dayBoundary,
    earthRotationEstimateAvailable
  });
  const stages = panel.querySelector("#proof-chain-stages");
  stages?.replaceChildren(...proof.stages.map(renderStage));

  const firstBlockerStage = proof.stages.find(stage => stage.id === proof.firstHardBlocker);
  setText(
    "proof-chain-first-blocker",
    identity ? "Δ=0 · identity bypass" : firstBlockerStage?.label ?? "none"
  );
  setText(
    "proof-chain-resolution-summary",
    identity
      ? "同一狀態不需要跨時代的絕對時間投影。"
      : proof.firstHardBlocker === "absolute-seasonal-epoch"
        ? "先把春分／節氣放回絕對均勻時間軸，取得目標年的 absolute seasonal anchors；它們只證明 seasonal events，不會替 recurrence 綁定 target instant。"
        : proof.firstHardBlocker === "target-instant"
          ? "seasonal anchors 與 target instant 是不同能力；目前 recurrence 仍是 date-only，必須明示 TT / UT1 / fixed-zone-from-UT1 reference basis；此頁可用上方 fixed-zone-from-UT1 research convention 綁定。"
          : proof.firstHardBlocker === "earth-rotation-bridge" && firstBlockerStage?.status === "uncertain-estimate"
            ? "TT target 已明示後，TT→UT1 雖有 ΔT 外推與統計 uncertainty，仍不是 deterministic Earth rotation。"
            : proof.firstHardBlocker === "earth-rotation-bridge"
              ? "target instant reference basis 已成立；下一個硬缺口是 TT↔UT1 / ΔT 的深時間地球自轉橋。"
              : proof.firstHardBlocker === "civil-zone"
                ? "target instant 已有明示 fixed-zone-from-UT1 座標；下一層仍需另外選定 Day/Hour 要採用的 civil/local-zone convention，不能把 research fixed offset 冒充未來政治時區。"
                : proof.firstHardBlocker === "day-boundary"
                  ? "地方鐘面已成立；下一層要明示日界 convention：子初 23:00 起次日或民用午夜 00:00。Birth 的預設不會被 recurrence 暗中繼承。"
                  : proof.firstHardBlocker === "clock-basis"
                    ? "日柱在明示的地方鐘面與日界 convention 下已可解析；時柱仍需明示 civil / local mean solar / local apparent solar clock basis。"
                    : "依賴鏈會從第一個未滿足的硬條件開始阻塞。"
  );
  setText("proof-chain-day-status", proof.day.resolved ? "resolved" : "blocked");
  setText(
    "proof-chain-day-blockers",
    proof.day.blockers.length ? proof.day.blockers.map(readableBlocker).join(" · ") : "無 blocker"
  );
  setText("proof-chain-hour-status", proof.hour.resolved ? "resolved" : "blocked");
  setText(
    "proof-chain-hour-blockers",
    proof.hour.blockers.length ? proof.hour.blockers.map(readableBlocker).join(" · ") : "無 blocker"
  );

  panel.dataset.ready = "true";
  panel.dataset.deltaYears = String(deltaYears);
  panel.dataset.identity = String(identity);
  panel.dataset.firstHardBlocker = proof.firstHardBlocker ?? "none";
  panel.dataset.targetInstantBasis = proof.targetInstantBasis;
  panel.dataset.targetInstantBound = String(proof.targetInstantBound);
  panel.dataset.targetClockEnabled = String(targetClockControls?.enabled.checked ?? false);
  panel.dataset.targetClockValid = targetClockControls?.root.dataset.valid ?? "true";
  panel.dataset.dayBoundary = proof.dayBoundary ?? "unbound";
  panel.dataset.dayBoundaryBound = String(proof.dayBoundaryBound);
  panel.dataset.dayBoundaryControlValid = targetClockControls?.root.dataset.dayBoundaryValid ?? "true";
  panel.dataset.earthRotationBridgeRequired = String(proof.earthRotationBridgeRequired);
  panel.dataset.earthRotationEstimateAvailable = String(proof.earthRotationEstimateAvailable);
  panel.dataset.dayResolved = String(proof.day.resolved);
  panel.dataset.hourResolved = String(proof.hour.resolved);
  panel.dataset.stageCount = String(proof.stages.length);

  if (targetClockControls) {
    targetClockControls.root.dataset.dayBoundary = proof.dayBoundary ?? "unbound";
  }

  instrument.dataset.dayHourProofFirstHardBlocker = proof.firstHardBlocker ?? "none";
  instrument.dataset.dayHourProofTargetInstantBasis = proof.targetInstantBasis;
  instrument.dataset.dayHourProofTargetInstantBound = String(proof.targetInstantBound);
  instrument.dataset.dayHourProofDayBoundary = proof.dayBoundary ?? "unbound";
  instrument.dataset.dayHourProofDayBoundaryBound = String(proof.dayBoundaryBound);
  instrument.dataset.dayHourProofEarthRotationBridgeRequired = String(proof.earthRotationBridgeRequired);
  instrument.dataset.dayHourProofEarthRotationEstimateAvailable = String(proof.earthRotationEstimateAvailable);
  instrument.dataset.dayHourProofDayResolved = String(proof.day.resolved);
  instrument.dataset.dayHourProofHourResolved = String(proof.hour.resolved);
  instrument.dataset.dayHourProofStageCount = String(proof.stages.length);

  renderEpochAudit(baseYear, targetYear, audit);
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

if (instrument && determinacyPanel) {
  new MutationObserver(scheduleRefresh).observe(instrument, {
    attributes:true,
    attributeFilter:["data-base-date", "data-delta-years", "data-astronomy-validity"]
  });
  scheduleRefresh();
}
