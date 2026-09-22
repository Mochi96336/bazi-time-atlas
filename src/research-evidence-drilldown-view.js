const researchEvidence = document.querySelector("#research-evidence");

function ensureStyles() {
  if (document.querySelector("link[data-research-evidence-drilldown-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./research-evidence-drilldown.css";
  link.dataset.researchEvidenceDrilldownStyles = "1";
  document.head.appendChild(link);
}

function setTextIfChanged(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function drilldownSummary(label, metaId) {
  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${label}</span><strong id="${metaId}">—</strong>`;
  return summary;
}

function ensureProofDrilldown() {
  const panel = document.querySelector("#day-hour-proof-chain");
  const stages = panel?.querySelector("#proof-chain-stages");
  if (!panel || !stages) return;

  let details = panel.querySelector("#proof-chain-evidence-details");
  if (!details) {
    details = document.createElement("details");
    details.id = "proof-chain-evidence-details";
    details.className = "research-evidence-drilldown proof-chain-drilldown";
    details.dataset.researchDrilldown = "proof-chain";
    details.append(drilldownSummary("完整證明鏈", "proof-chain-drilldown-meta"), stages);
    panel.append(details);
  }

  const count = stages.querySelectorAll(".proof-chain-stage").length;
  setTextIfChanged(details.querySelector("#proof-chain-drilldown-meta"), `${count || 11} 層 · 展開看逐層證據`);
}

function ensureEpochAuditDrilldown() {
  const panel = document.querySelector("#seasonal-epoch-source-audit");
  const sources = panel?.querySelector("#epoch-audit-sources");
  const foot = panel?.querySelector("#epoch-audit-footnote");
  if (!panel || !sources || !foot) return;

  let details = panel.querySelector("#epoch-audit-evidence-details");
  if (!details) {
    details = document.createElement("details");
    details.id = "epoch-audit-evidence-details";
    details.className = "research-evidence-drilldown epoch-audit-drilldown";
    details.dataset.researchDrilldown = "epoch-audit";
    details.append(drilldownSummary("來源能力稽核", "epoch-audit-drilldown-meta"), sources, foot);
    panel.append(details);
  }

  const count = sources.querySelectorAll(".epoch-audit-source").length;
  setTextIfChanged(
    details.querySelector("#epoch-audit-drilldown-meta"),
    `${count} 個來源 · 展開看能力邊界`
  );
}

let queued = false;
function syncDrilldowns() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    ensureProofDrilldown();
    ensureEpochAuditDrilldown();
  });
}

if (researchEvidence) {
  ensureStyles();
  new MutationObserver(syncDrilldowns).observe(researchEvidence, { childList:true, subtree:true });
  syncDrilldowns();
}
