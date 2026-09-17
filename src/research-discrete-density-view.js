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

function consolidateGlobalPeriod() {
  const dock = researchDiscrete?.querySelector(".delta-dock");
  const preset = researchDiscrete?.querySelector('#candidate-buttons button[data-delta-years="24000"]');
  const duplicate = dock?.querySelector(".global-period");
  if (!dock || !preset) return;

  preset.textContent = "全域 24,000";
  preset.setAttribute("aria-label", "三層全域閉合 24,000 年");
  preset.dataset.researchGlobalPeriodPreset = "1";
  duplicate?.remove();
  dock.classList.add("research-delta-consolidated");
}

function ensureClosureDrilldown() {
  const grid = researchDiscrete?.querySelector(".closure-grid");
  if (!grid) return null;

  let details = grid.closest("#discrete-closure-details");
  const local = researchDiscrete.querySelector(".research-local-recurrence-rail") ?? grid.querySelector(".local-card");
  if (!local) return details;

  if (!local.classList.contains("research-local-recurrence-rail")) {
    local.classList.add("research-local-recurrence-rail");
    const label = local.querySelector("span");
    const note = local.querySelector("small");
    if (label) label.textContent = "局部年＋日首次重遇";
    if (note) note.hidden = true;
  }

  if (!details) {
    details = document.createElement("details");
    details.id = "discrete-closure-details";
    details.className = "research-discrete-drilldown research-closure-drilldown";
    details.dataset.researchDrilldown = "discrete-closure";

    const summary = document.createElement("summary");
    summary.innerHTML = `<span>閉合狀態</span><strong>公曆 / 年序 / 日序</strong>`;

    grid.insertAdjacentElement("beforebegin", local);
    grid.insertAdjacentElement("beforebegin", details);
    details.append(summary, grid);
  }

  return details;
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
  consolidateGlobalPeriod();
  ensureClosureDrilldown();
  const details = ensureMilestoneDrilldown();
  syncMilestoneMeta(details);
}

if (researchDiscrete) {
  ensureStyles();
  const rows = researchDiscrete.querySelector("#milestone-rows");
  if (rows) new MutationObserver(syncDiscretePresentation).observe(rows, { childList:true });
  syncDiscretePresentation();
}
