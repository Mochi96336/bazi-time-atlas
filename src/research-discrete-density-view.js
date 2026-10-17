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

function hashTargetsPhaseFan(details, instrument) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const target = document.getElementById(id);
  return Boolean(target && (target === details || target === instrument || instrument.contains(target)));
}

function revealPhaseFanHash(details, instrument) {
  if (!details || !instrument || !hashTargetsPhaseFan(details, instrument)) return;
  details.open = true;
  requestAnimationFrame(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block:"start" });
  });
}

function ensurePhaseFanDrilldown() {
  const instrument = researchDiscrete?.querySelector("#recurrence-instrument");
  if (!instrument) return null;

  let details = instrument.closest("#discrete-phase-fan-details");
  if (!details) {
    details = document.createElement("details");
    details.id = "discrete-phase-fan-details";
    details.className = "research-discrete-drilldown research-phase-fan-drilldown";
    details.dataset.researchDrilldown = "discrete-phase-fan";

    const summary = document.createElement("summary");
    summary.innerHTML = "<span>離散相位扇</span><strong>公曆結構 · 60 年序 · 60 日序的距 0 位置</strong>";

    instrument.insertAdjacentElement("beforebegin", details);
    details.append(summary, instrument);
  }

  revealPhaseFanHash(details, instrument);
  return details;
}

function hashTargetsCycle(details, cycle) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return false;
  const target = document.getElementById(id);
  return Boolean(target && (target === details || target === cycle || cycle.contains(target)));
}

function revealCycleHash(details, cycle) {
  if (!details || !cycle || !hashTargetsCycle(details, cycle)) return;
  details.open = true;
  requestAnimationFrame(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block:"start" });
  });
}

function bindSexagenaryLookup(details) {
  const lookup = researchDiscrete?.querySelector(".research-cycle-inline-lookup");
  if (!details || !lookup || lookup.dataset.disclosureBound === "1") return;
  lookup.dataset.disclosureBound = "1";
  lookup.addEventListener("click", event => {
    event.preventDefault();
    details.open = true;
    const nextHash = `#${details.id}`;
    if (location.hash !== nextHash) history.pushState(null, "", nextHash);
    requestAnimationFrame(() => details.scrollIntoView({ block:"start" }));
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
    summary.innerHTML = "<span>六十干支圖</span><strong>10 天干 × 12 地支 → 60 配對</strong>";

    cycle.insertAdjacentElement("beforebegin", details);
    details.append(summary, cycle);
  }

  // Keep the large 60-pair diagram as supporting evidence after the
  // explorer. The reading spine is now:
  // derivation thesis → date/year verification → optional phase fan → Δ explorer
  // → optional 60-pair source.
  const derivation = researchDiscrete?.querySelector(".discrete-derivation");
  const transition = researchDiscrete?.querySelector(".discrete-to-astronomy");
  if (transition && details.previousElementSibling !== transition) {
    transition.insertAdjacentElement("afterend", details);
  } else if (!transition && derivation && details.previousElementSibling !== derivation) {
    derivation.insertAdjacentElement("afterend", details);
  }

  bindSexagenaryLookup(details);
  revealCycleHash(details, cycle);
  return details;
}

function syncDiscretePresentation() {
  if (!researchDiscrete) return;
  removeDuplicateScopeNote();
  consolidateGlobalPeriod();
  ensurePhaseFanDrilldown();
  ensureSexagenaryDrilldown();
}

if (researchDiscrete) {
  ensureStyles();
  const candidates = researchDiscrete.querySelector("#candidate-buttons");
  if (candidates) new MutationObserver(syncDiscretePresentation).observe(candidates, { childList:true });
  window.addEventListener("hashchange", () => {
    const instrument = researchDiscrete.querySelector("#recurrence-instrument");
    const phaseDetails = instrument?.closest("#discrete-phase-fan-details");
    revealPhaseFanHash(phaseDetails, instrument);
    const cycle = researchDiscrete.querySelector("#research-sexagenary-cycle");
    const details = cycle?.closest("#discrete-sexagenary-details");
    revealCycleHash(details, cycle);
  });
  syncDiscretePresentation();
}