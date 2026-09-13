import { currentRecurrenceDayHourProof } from "./recurrence/day-hour-proof-chain.js";

const instrument = document.querySelector("#recurrence-instrument");
const determinacyPanel = document.querySelector("#four-pillar-determinacy");
let proofPanel = null;

const STATUS_LABELS = Object.freeze({
  satisfied:"已有",
  "missing-deep-time-model":"缺深時間模型",
  "missing-model":"缺模型",
  blocked:"前置阻塞",
  "unbound-convention":"尚未綁定",
  conditional:"條件式",
  "not-required":"不需要"
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

function refresh() {
  const panel = ensurePanel();
  if (!panel || !instrument) return;
  const deltaYears = Number(instrument.dataset.deltaYears);
  const astronomyValidity = instrument.dataset.astronomyValidity;
  if (!Number.isInteger(deltaYears) || !astronomyValidity) {
    panel.dataset.ready = "false";
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
    attributeFilter:["data-delta-years", "data-astronomy-validity"]
  });
  scheduleRefresh();
}
