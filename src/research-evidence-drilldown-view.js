const researchEvidence = document.querySelector("#research-evidence");
const RESEARCH_CONVENTION_QUERY_KEYS = Object.freeze([
  "targetClock",
  "targetTime",
  "ut1Offset",
  "dayBoundary",
  "clockBasis",
  "lon"
]);

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

function hashTargets(panel) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const target = document.getElementById(id);
  return Boolean(target && (target === panel || panel.contains(target)));
}

function revealHash(details, panel) {
  if (!details || !panel || !hashTargets(panel)) return;
  details.open = true;
  requestAnimationFrame(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block:"start" });
  });
}

function hasResearchConventionQuery() {
  const params = new URLSearchParams(location.search);
  return RESEARCH_CONVENTION_QUERY_KEYS.some(key => params.has(key));
}

function ensureSupportDetails(panel, { id, label, metaId, openForConventionQuery = false }) {
  if (!panel) return null;
  let details = panel.closest(`#${id}`);
  if (!details) {
    details = document.createElement("details");
    details.id = id;
    details.className = "research-evidence-support";
    details.dataset.researchSupport = id;
    panel.insertAdjacentElement("beforebegin", details);
    details.append(drilldownSummary(label, metaId), panel);
  }
  if (openForConventionQuery && hasResearchConventionQuery()) details.open = true;
  revealHash(details, panel);
  return details;
}

function ensureProofSupport() {
  const panel = document.querySelector("#day-hour-proof-chain");
  if (!panel) return null;
  const details = ensureSupportDetails(panel, {
    id:"proof-chain-support-details",
    label:"日／時柱證明",
    metaId:"proof-chain-support-meta",
    openForConventionQuery:true
  });
  const blocker = panel.querySelector("#proof-chain-first-blocker")?.textContent?.trim();
  const day = panel.querySelector("#proof-chain-day-status")?.textContent?.trim();
  const hour = panel.querySelector("#proof-chain-hour-status")?.textContent?.trim();
  const meta = day === "已解析" && hour === "已解析"
    ? "日柱與時柱皆已解析"
    : blocker && blocker !== "—"
      ? `第一阻塞 · ${blocker}`
      : "展開研究約定與證據";
  setTextIfChanged(details?.querySelector("#proof-chain-support-meta"), meta);
  return details;
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

function ensureEpochAuditSupport() {
  const panel = document.querySelector("#seasonal-epoch-source-audit");
  if (!panel) return null;
  const details = ensureSupportDetails(panel, {
    id:"epoch-audit-support-details",
    label:"天文來源能力",
    metaId:"epoch-audit-support-meta"
  });
  const target = panel.querySelector("#epoch-audit-target")?.textContent?.trim();
  setTextIfChanged(
    details?.querySelector("#epoch-audit-support-meta"),
    target && target !== "—" ? target : "展開來源能力"
  );
  return details;
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
    ensureProofSupport();
    ensureProofDrilldown();
    ensureEpochAuditSupport();
    ensureEpochAuditDrilldown();
  });
}

if (researchEvidence) {
  ensureStyles();
  new MutationObserver(syncDrilldowns).observe(researchEvidence, { childList:true, subtree:true });
  window.addEventListener("hashchange", syncDrilldowns);
  syncDrilldowns();
}
