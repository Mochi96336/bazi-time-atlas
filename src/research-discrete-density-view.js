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
  preset.setAttribute("aria-label", "三個離散相位同時歸零 24,000 年");
  preset.dataset.researchGlobalPeriodPreset = "1";
  duplicate?.remove();
  dock.classList.add("research-delta-consolidated");
}

function hashTargetsCycle(cycle) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const target = document.getElementById(id);
  return Boolean(target && (target === cycle || cycle.contains(target)));
}

function revealCycleHash(details, cycle) {
  if (!details || !cycle || !hashTargetsCycle(cycle)) return;
  details.open = true;
  requestAnimationFrame(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block:"start" });
  });
}

function ensureSexagenaryDrilldown() {
  const cycle = researchDiscrete?.querySelector("#research-sexagenary-cycle");
  if (!cycle) return null;

  let details = cycle.closest("#discrete-sexagenary-details");
  if (!details) {
    details = document.createElement("details");
    details.id = "discrete-sexagenary-details";
    details.className = "research-discrete-drilldown research-sexagenary-drilldown";
    details.dataset.researchDrilldown = "discrete-sexagenary";

    const summary = document.createElement("summary");
    summary.innerHTML = "<span>60 日序來源</span><strong>10 天干 / 12 地支 → 60 配對</strong>";

    cycle.insertAdjacentElement("beforebegin", details);
    details.append(summary, cycle);
  }

  revealCycleHash(details, cycle);
  return details;
}

function syncDiscretePresentation() {
  if (!researchDiscrete) return;
  removeDuplicateScopeNote();
  consolidateGlobalPeriod();
  ensureSexagenaryDrilldown();
}

if (researchDiscrete) {
  ensureStyles();
  const candidates = researchDiscrete.querySelector("#candidate-buttons");
  if (candidates) new MutationObserver(syncDiscretePresentation).observe(candidates, { childList:true });
  window.addEventListener("hashchange", () => {
    const cycle = researchDiscrete.querySelector("#research-sexagenary-cycle");
    const details = cycle?.closest("#discrete-sexagenary-details");
    revealCycleHash(details, cycle);
  });
  syncDiscretePresentation();
}
