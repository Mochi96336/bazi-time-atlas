const researchDiscrete = document.querySelector("#research-discrete");

function ensureStyles() {
  if (document.querySelector("link[data-research-discrete-density-styles]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "./research-discrete-density.css";
  link.dataset.researchDiscreteDensityStyles = "1";
  document.head.appendChild(link);
}

function removeDuplicateScopeNote() {
  document.querySelector(".recurrence-intro > .scope-note")?.remove();
}

function ensureMilestoneDrilldown() {
  const table = researchDiscrete?.querySelector(".milestone-table");
  if (!table) return null;

  let details = table.closest("#discrete-milestone-details");
  if (!details) {
    details = document.createElement("details");
    details.id = "discrete-milestone-details";
    details.className = "research-discrete-drilldown";
    details.dataset.researchDrilldown = "discrete-milestones";

    const summary = document.createElement("summary");
    summary.innerHTML = `<span>候選閉合明細</span><strong id="discrete-milestone-meta">典型候選 · 展開看 phase</strong>`;

    table.insertAdjacentElement("beforebegin", details);
    details.append(summary, table);
  }
  return details;
}

function syncMilestoneMeta(details) {
  const rows = details?.querySelectorAll("#milestone-rows > .milestone-row").length ?? 0;
  const meta = details?.querySelector("#discrete-milestone-meta");
  if (!meta) return;
  const next = `${rows || 6} candidates · 公曆 / 年序 / 日序`;
  if (meta.textContent !== next) meta.textContent = next;
}

function syncDiscretePresentation() {
  if (!researchDiscrete) return;
  removeDuplicateScopeNote();
  const details = ensureMilestoneDrilldown();
  syncMilestoneMeta(details);
}

if (researchDiscrete) {
  ensureStyles();
  const rows = researchDiscrete.querySelector("#milestone-rows");
  if (rows) new MutationObserver(syncDiscretePresentation).observe(rows, { childList:true });
  syncDiscretePresentation();
}
