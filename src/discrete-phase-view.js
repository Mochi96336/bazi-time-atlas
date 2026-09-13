import { discretePhaseWindows, phaseAngleWithinTooth } from "./wheel/discrete-phase.js";
import { WHEEL_CENTER, ringModel } from "./wheel/ring-model.js";
import { arcPath, pointAt } from "./wheel/polar-geometry.js";

const RING_IDS = Object.freeze(["hour", "year", "month", "day"]);
const PHASE_INSET_DEGREES = 0.45;

const instrument = document.querySelector("#kinetic-instrument");
const svg = document.querySelector("#kinetic-wheel");
let scheduled = false;

function activeIndex(id) {
  const active = document.querySelector(`#${id}-track .cycle-sector.is-active`);
  const index = Number(active?.dataset.cycleIndex);
  return Number.isInteger(index) ? index : null;
}

function clearPhase(id) {
  const group = document.querySelector(`#${id}-track`);
  const path = group?.querySelector(`.state-phase-progress[data-phase-ring="${id}"]`);
  const bead = group?.querySelector(`.state-phase-bead[data-phase-ring="${id}"]`);
  path?.removeAttribute("d");
  if (path) path.dataset.phaseVisible = "false";
  if (bead) {
    bead.dataset.phaseVisible = "false";
    bead.setAttribute("visibility", "hidden");
  }
  if (!group) return;
  delete group.dataset.phaseProgress;
  delete group.dataset.phaseStartMs;
  delete group.dataset.phaseEndMs;
  delete group.dataset.phaseSource;
  delete group.dataset.phaseBoundaryKind;
}

function renderPhase(id, activeIndexValue, phase) {
  if (!phase || !Number.isInteger(activeIndexValue)) {
    clearPhase(id);
    return;
  }
  const group = document.querySelector(`#${id}-track`);
  const path = group?.querySelector(`.state-phase-progress[data-phase-ring="${id}"]`);
  const bead = group?.querySelector(`.state-phase-bead[data-phase-ring="${id}"]`);
  if (!group || !path || !bead) return;

  const angle = phaseAngleWithinTooth(activeIndexValue, phase.progress, PHASE_INSET_DEGREES);
  if (!Number.isFinite(angle)) {
    clearPhase(id);
    return;
  }

  const model = ringModel(id);
  const radius = model.innerRadius + 6;
  const startAngle = activeIndexValue * 6 + PHASE_INSET_DEGREES;
  const point = pointAt(WHEEL_CENTER, radius, angle);
  bead.setAttribute("cx", point.x);
  bead.setAttribute("cy", point.y);
  bead.removeAttribute("visibility");
  bead.dataset.phaseVisible = "true";

  if (phase.progress > 0.002) {
    path.setAttribute("d", arcPath(WHEEL_CENTER, radius, startAngle, angle));
    path.dataset.phaseVisible = "true";
  } else {
    path.removeAttribute("d");
    path.dataset.phaseVisible = "false";
  }

  group.dataset.phaseProgress = phase.progress.toFixed(6);
  group.dataset.phaseStartMs = String(Math.round(phase.startMs));
  group.dataset.phaseEndMs = String(Math.round(phase.endMs));
  group.dataset.phaseSource = phase.source;
  group.dataset.phaseBoundaryKind = phase.boundaryKind;
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

  for (const id of RING_IDS) renderPhase(id, activeIndex(id), phases[id]);
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
