import { currentRecurrenceDayHourProof } from "./recurrence/day-hour-proof-chain.js";
import { seasonalEpochSourceAudit } from "./recurrence/seasonal-epoch-source-audit.js";

const instrument = document.querySelector("#recurrence-instrument");
const determinacyPanel = document.querySelector("#four-pillar-determinacy");
let proofPanel = null;
let epochAuditPanel = null;

const STATUS_LABELS = Object.freeze({
  satisfied:"已有",
  "missing-deep-time-model":"缺深時間模型",
  "missing-model":"缺模型",
  blocked:"前置阻塞",
  "unbound-convention":"尚未綁定",
  conditional:"條件式",
  "not-required":"不需要"
});

const AUDIT_STATUS_LABELS = Object.freeze({
  "identity-bypass":"同一狀態 · 不需跨 epoch",
  resolved:"已有可用 absolute-epoch source",
  "qualified-source-not-integrated":"有合格 source coverage · app 尚未整合",
  "absolute-phase-coverage-gap":"absolute-phase coverage gap"
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
        <p>這裡不增加任何遠未來假設，只把目前模型的輸出接成一條可滿足的依賴鏈。綠色代表 repo 已有；「缺深時間模型」是物理／時間尺度缺口；「尚未綁定」則是既有八字計算能力尚未在回歸頁選定 convention。</p>
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
        <h2>覆蓋到那一年，不代表能給出那一年的絕對節氣時刻。</h2>
        <p>這裡分開檢查年份 coverage、absolute orbital phase、連續動力時間 epoch 與 repo 整合狀態。長期軌道／insolation 參數可以描述季節幾何，但只有含絕對相位的 ephemeris 才能把春分／節氣放回時間軸。</p>
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
    earthRotationBridge:"TT↔UT / ΔT",
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
  return year >= 0 ? String(year) : `${Math.abs(year)} BCE*`;
}

function renderEpochSource(item) {
  const article = document.createElement("article");
  article.className = "epoch-audit-source";
  article.dataset.epochSource = item.id;
  article.dataset.coversTarget = String(item.coversTarget);
  article.dataset.absoluteEpochCapable = String(item.absoluteEpochCapable);
  article.dataset.implementedForEpoch = String(item.implementedForEpoch);
  article.dataset.qualifiedCoverage = String(item.qualifiedCoverage);
  article.dataset.reason = item.reason;

  const coverage = `${formatYear(item.coverage.minYear)} → ${formatYear(item.coverage.maxYear)}`;
  const verdict = item.usableNow
    ? "可直接使用"
    : item.qualifiedCoverage
      ? "absolute phase ✓ · 尚未整合"
      : item.coversTarget
        ? "coverage ✓ · 缺 absolute phase"
        : "超出 coverage";

  article.innerHTML = `
    <header><div><span>${item.authority}</span><strong>${item.label}</strong></div><b>${verdict}</b></header>
    <div class="epoch-audit-facts">
      <span><em>Coverage</em><strong>${coverage}</strong></span>
      <span><em>Absolute phase</em><strong>${item.absoluteEpochCapable ? "yes" : "no"}</strong></span>
      <span><em>In app</em><strong>${item.implementedForEpoch ? "yes" : "no"}</strong></span>
    </div>
    <p>${item.note}</p>
  `;
  return article;
}

function renderEpochAudit(baseYear, targetYear) {
  const panel = ensureEpochAuditPanel();
  if (!panel || !instrument) return;
  const audit = seasonalEpochSourceAudit({ baseYear, targetYear });
  panel.querySelector("#epoch-audit-sources")?.replaceChildren(...audit.evaluations.map(renderEpochSource));
  setText("epoch-audit-target", `${targetYear} · ${AUDIT_STATUS_LABELS[audit.status] ?? audit.status}`);
  setText("epoch-audit-verdict", audit.identity
    ? "Δ=0 不需要跨 epoch source。"
    : audit.status === "qualified-source-not-integrated"
      ? `JPL DE441 涵蓋目標年；目前 blocker 是工程整合，不是 coverage。`
      : audit.status === "absolute-phase-coverage-gap"
        ? `現有 registry 沒有同時涵蓋 ${targetYear} 且提供 absolute phase 的 source。`
        : "absolute seasonal epoch source 已可用。"
  );
  const gap = audit.nearestAbsoluteBoundary;
  setText("epoch-audit-footnote", gap && !audit.identity
    ? `最近的 absolute ephemeris 邊界：${gap.sourceId} → ${formatYear(gap.boundaryYear)}；距目標 ${gap.gapYears.toLocaleString("en-US")} 年。長期 shape/parameter coverage 不會被當成 absolute timestamp coverage。`
    : "source coverage 與 absolute-epoch capability 分開記錄。"
  );

  panel.dataset.ready = "true";
  panel.dataset.baseYear = String(baseYear);
  panel.dataset.targetYear = String(targetYear);
  panel.dataset.auditStatus = audit.status;
  panel.dataset.blocker = audit.blocker ?? "none";
  panel.dataset.qualifiedSourceCount = String(audit.qualifiedSourceIds.length);
  panel.dataset.usableSourceCount = String(audit.usableSourceIds.length);
  panel.dataset.nearestAbsoluteBoundaryYear = gap ? String(gap.boundaryYear) : "none";
  panel.dataset.nearestAbsoluteGapYears = gap ? String(gap.gapYears) : "none";

  const de441 = audit.evaluations.find(item => item.id === "jpl-de441");
  instrument.dataset.seasonalEpochAuditStatus = audit.status;
  instrument.dataset.seasonalEpochAuditTargetYear = String(targetYear);
  instrument.dataset.seasonalEpochDe441Covered = String(de441?.coversTarget ?? false);
  instrument.dataset.seasonalEpochQualifiedSourceCount = String(audit.qualifiedSourceIds.length);
  instrument.dataset.seasonalEpochNearestAbsoluteGapYears = gap ? String(gap.gapYears) : "none";
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
  const proof = currentRecurrenceDayHourProof({
    identity,
    astronomyWithinRange:astronomyValidity === "within-range"
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
  panel.dataset.dayResolved = String(proof.day.resolved);
  panel.dataset.hourResolved = String(proof.hour.resolved);
  panel.dataset.stageCount = String(proof.stages.length);

  instrument.dataset.dayHourProofFirstHardBlocker = proof.firstHardBlocker ?? "none";
  instrument.dataset.dayHourProofDayResolved = String(proof.day.resolved);
  instrument.dataset.dayHourProofHourResolved = String(proof.hour.resolved);
  instrument.dataset.dayHourProofStageCount = String(proof.stages.length);

  renderEpochAudit(baseYear, baseYear + deltaYears);
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
