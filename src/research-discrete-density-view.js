// Review 2026-11-21: the discrete tools (fan, year strip, derivation, 60-pair
// wheel) live in the lab after the three reading steps.
const researchDiscrete = document.querySelector("#research-lab") ?? document.querySelector("#research-discrete");

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
  requestAnimationFrame(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block:"start" });
  });
}

// The compact proof is a view of recurrence-view's existing phase data
// attributes. It never recomputes a cycle or creates a second delta owner.
function updatePhaseFanPreview(details, instrument) {
  const selected = instrument.dataset.deltaYears;
  if (selected === undefined) return;
  const targetValid = instrument.dataset.targetDate !== "invalid";
  const inputs = [
    ["gregorian", instrument.dataset.gregorianPhaseSigned],
    ["year", instrument.dataset.yearSequencePhaseSigned],
    ["day", instrument.dataset.dayPhaseSigned]
  ];
  // A user-selected milestone may momentarily emphasize the resulting zero
  // values. The instrument remains the only authority for signed phases.
  // Do not replay the effect for continuous slider/playback updates.
  const arrival = instrument.dataset.phaseArrival === selected &&
    selected !== details.dataset.phasePreviewLastDelta &&
    Number(selected) > 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const arrived = [];
  let zeroCount = 0;
  for (const [key, raw] of inputs) {
    const element = details.querySelector(`[data-phase-preview="${key}"]`);
    if (!element) continue;
    const available = raw !== undefined && raw !== "invalid";
    const zero = available && Number(raw) === 0;
    if (zero) zeroCount++;
    element.dataset.phaseState = !available ? "unknown" : zero ? "zero" : "shifted";
    const value = element.querySelector("em");
    if (value) value.textContent = !available ? "—" : Number(raw) > 0 ? `+${raw}` : String(raw).replace("-", "−");
    const state = element.querySelector(".phase-fan-phase-state");
    if (state) state.textContent = !available ? "尚無資料" : zero
      ? (Number(selected) === 0 ? "基準零位" : "回到零位")
      : "尚未歸零";
    if (arrival && zero) {
      arrived.push(key);
      if (!reduceMotion && value?.animate) {
        value.animate([
          {opacity:.62,filter:"brightness(1)"},
          {opacity:1,filter:"brightness(1.35)",offset:.32},
          {opacity:1,filter:"brightness(1)"}
        ], {duration:390,easing:"ease-out"});
      }
    }
  }
  details.dataset.phasePreviewLastDelta = selected;
  details.dataset.phasePreviewArrival = arrived.join(",");
  let proofStatus;
  let proofText;
  if (Number(selected) === 0) {
    proofStatus = "identity";
    proofText = "基準 · 非重遇";
  } else if (!targetValid) {
    proofStatus = "unresolved";
    proofText = "目標日期不存在";
  } else if (zeroCount === 3) {
    proofStatus = "candidate";
    proofText = "離散候選 · 待驗節界";
  } else {
    proofStatus = "partial";
    proofText = `${zeroCount}/3 序位歸零`;
  }
  details.dataset.phasePreviewStatus = proofStatus;
  const context = details.querySelector("#phase-fan-preview-context");
  if (context) context.textContent = proofText;
}

function bindPhaseFanPreview(details, instrument) {
  if (details.dataset.phasePreviewBound === "true") return;
  details.dataset.phasePreviewBound = "true";
  const observer = new MutationObserver(() => updatePhaseFanPreview(details, instrument));
  observer.observe(instrument, {
    attributes:true,
    attributeFilter:[
      "data-delta-years",
      "data-target-date",
      "data-gregorian-phase-signed",
      "data-year-sequence-phase-signed",
      "data-day-phase-signed"
    ]
  });
  updatePhaseFanPreview(details, instrument);
}

// The 3-cycle instrument is primary Research 01 evidence, never a disclosure.
// Preserve the historical anchor id for existing deep links.
function ensurePhaseFanPanel() {
  const instrument = researchDiscrete?.querySelector("#recurrence-instrument");
  if (!instrument) return null;

  let panel = instrument.closest("#discrete-phase-fan-details");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "discrete-phase-fan-details";
    panel.className = "research-phase-fan-panel";
    panel.dataset.researchPrimaryFigure = "discrete-phase-fan";
    panel.setAttribute("aria-labelledby", "phase-fan-title");

    const header = document.createElement("header");
    header.innerHTML = `<div class="phase-fan-preview-heading">
        <h3 id="phase-fan-title" class="phase-fan-preview-title">離散相位扇</h3>
        <small id="phase-fan-preview-context">等候相位</small>
      </div>
      <div class="phase-fan-preview" role="group" aria-label="由外到內的三個週期與相位偏移">
        <span data-phase-preview="gregorian"><span class="phase-fan-track">外圈 · 公曆 400 年</span><em>—</em><small class="phase-fan-phase-state">—</small></span>
        <span data-phase-preview="year"><span class="phase-fan-track">中圈 · 年序 60 年</span><em>—</em><small class="phase-fan-phase-state">—</small></span>
        <span data-phase-preview="day"><span class="phase-fan-track">內圈 · 日序 60 日</span><em>—</em><small class="phase-fan-phase-state">—</small></span>
      </div>`;

    instrument.insertAdjacentElement("beforebegin", panel);
    panel.append(header, instrument);
  }

  bindPhaseFanPreview(panel, instrument);
  revealPhaseFanHash(panel, instrument);
  return panel;
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
  // derivation thesis → date/year verification → visible primary phase fan → Δ explorer
  // → optional 60-pair source.
  // Review 2026-11-21: in the lab the wheel follows the cycle fan whose rings
  // carry the same 60 names, ahead of the researcher tools.
  const labFan = researchDiscrete?.querySelector("#research-lab-fan");
  const derivation = researchDiscrete?.querySelector(".discrete-derivation");
  const transition = researchDiscrete?.querySelector(".discrete-to-astronomy");
  if (labFan) {
    if (details.previousElementSibling !== labFan) labFan.insertAdjacentElement("afterend", details);
  } else if (transition && details.previousElementSibling !== transition) {
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
  ensurePhaseFanPanel();
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