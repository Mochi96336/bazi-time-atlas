import { discretePhaseWindows } from "./wheel/discrete-phase.js";

const DISCRETE_PHASE_EVENT = "atlas-discrete-phase-update";
const RING_IDS = Object.freeze(["hour", "year", "month", "day"]);

const instrument = document.querySelector("#kinetic-instrument");
const svg = document.querySelector("#kinetic-wheel");
let scheduled = false;

function activeIndex(id) {
  const active = document.querySelector(`#${id}-track .cycle-sector.is-active`);
  const index = Number(active?.dataset.cycleIndex);
  return Number.isInteger(index) ? index : null;
}

function refresh() {
  scheduled = false;
  if (!instrument || !svg) return;
  const instantMs = Number(instrument.dataset.selectedInstantMs);
  if (!Number.isFinite(instantMs)) return;

  const phases = { ...discretePhaseWindows(instantMs) };
  // Legacy annual links can override the displayed month branch/longitude without
  // representing a complete physical instant. Do not attach a real-time month
  // progress bar to that projected month identity.
  if (instrument.dataset.projectionMode === "legacy-longitude") phases.month = null;

  const activeIndices = Object.fromEntries(RING_IDS.map(id => [id, activeIndex(id)]));
  if (Object.values(activeIndices).some(index => !Number.isInteger(index))) return;

  svg.dispatchEvent(new CustomEvent(DISCRETE_PHASE_EVENT, {
    detail:{ phases, activeIndices }
  }));

  instrument.dataset.discretePhaseMode = "true-boundaries";
  instrument.dataset.discretePhaseRings = RING_IDS.filter(id => phases[id]).join(",");
}

function scheduleRefresh() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(refresh);
}

if (instrument && svg) {
  new MutationObserver(scheduleRefresh).observe(instrument, {
    attributes:true,
    attributeFilter:["data-selected-instant-ms", "data-projection-mode"]
  });
  scheduleRefresh();
  requestAnimationFrame(scheduleRefresh);
}
