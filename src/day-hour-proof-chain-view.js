import { deepTimeEarthRotationEstimateSupportsYear } from "./astronomy/deep-time-earth-rotation.js";
import { currentRecurrenceDayHourProof } from "./recurrence/day-hour-proof-chain.js";
import { seasonalEpochSourceAudit } from "./recurrence/seasonal-epoch-source-audit.js";

const instrument = document.querySelector("#recurrence-instrument");
const determinacyPanel = document.querySelector("#four-pillar-determinacy");
let proofPanel = null;
let epochAuditPanel = null;

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
  resolved:"已有可用 seasonal-epoch pipeline",
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
        <p>這裡不增加任何遠未來假設，只把目前模型的輸出接成一條可滿足的依賴鏈。綠色代表 repo 已有；「有估計 · 不確定」代表已有可執行外推但尚不足以唯一決定時間；「尚未綁定」則是既有八字計算能力尚未在回歸頁選定 convention。</p>
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
        <h2>覆蓋到那一年，不代表能直接給出那一年的節氣時刻。</h2>
        <p>這裡分開檢查年份 coverage、absolute Earth/Sun state、direct seasonal event、連續動力時間與 repo 整合狀態。只有真正可呼叫的 runtime provider 才會把 absolute seasonal epoch 標成可用。</p>
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
    absoluteSeasonalEpoch:"絕對季節 epoch",
    earthRotationBridge:"TT↔UT1 / ΔT",
    civilZoneBound:"民用時區",
    dayBoundaryBound:"日界規則",
    sexagenaryDayArithmetic:"干支日序算術",
    resolvedDayPillar:"已解析日柱",
    clockBasisBound:"時計 basis",
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
    ? "pipeline 可用"
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
      ? `已由 ${audit.usableSourceIds.join(" · ")} 提供可呼叫的 absolute seasonal epoch。`
      : audit.status === "qualified-ephemeris-basis-not-integrated"
        ? "DE441 涵蓋目標年的 absolute Earth/Sun state；仍須整合 source adapter、黃經-of-date transform 與 crossing root solve。"
        : audit.status === "absolute-state-coverage-gap"
          ? `現有 registry 沒有同時涵蓋 ${targetYear} 且提供 absolute state 或 direct seasonal event 的 source。`
          : "absolute seasonal epoch pipeline 尚未滿足完整 runtime contract。"
  );
  const gap = audit.nearestEphemerisBoundary;
  setText("epoch-audit-footnote", audit.status === "resolved"
    ? `Production runtime coverage 只認 provider 自己宣告的年份；目前 usable：${audit.usableSourceIds.join(" · ")}。`
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
  const value = instrument?.dataset?.baseDate ?? "";
  const match = /^(\d+)-/.exec(value);
  return match ? Number(match[1]) : null;
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
  const earthRotationEstimateAvailable = audit.absoluteSeasonalEpochAvailable
    && deepTimeEarthRotationEstimateSupportsYear(targetYear);
  const proof = currentRecurrenceDayHourProof({
    identity,
    astronomyWithinRange:astronomyValidity === "within-range",
    absoluteSeasonalEpoch:audit.absoluteSeasonalEpochAvailable,
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
        ? "先把春分／節氣放回絕對均勻時間軸，之後才有資格談民用日界。"
        : proof.firstHardBlocker === "earth-rotation-bridge" && firstBlockerStage?.status === "uncertain-estimate"
          ? "TT→UT1 已有 ΔT 外推與統計 uncertainty，但不是 deterministic Earth rotation；目前不能據此唯一決定日柱／時柱。"
          : proof.firstHardBlocker === "earth-rotation-bridge"
            ? "節氣已有絕對 TT；下一個硬缺口是 TT↔UT1 / ΔT 的深時間地球自轉橋。"
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
  panel.dataset.earthRotationEstimateAvailable = String(proof.earthRotationEstimateAvailable);
  panel.dataset.dayResolved = String(proof.day.resolved);
  panel.dataset.hourResolved = String(proof.hour.resolved);
  panel.dataset.stageCount = String(proof.stages.length);

  instrument.dataset.dayHourProofFirstHardBlocker = proof.firstHardBlocker ?? "none";
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
