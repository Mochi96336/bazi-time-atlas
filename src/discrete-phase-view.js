import {
  discretePhaseWindows,
  exactNextBoundaryGroups,
  phaseAngleWithinTooth
} from "./wheel/discrete-phase.js";
import { WHEEL_CENTER, ringModel } from "./wheel/ring-model.js";
import { arcPath, pointAt } from "./wheel/polar-geometry.js";

const RING_IDS = Object.freeze(["hour", "year", "month", "day"]);
const PHASE_INSET_DEGREES = 0.45;
const GATE_INSET_DEGREES = 0.22;

const instrument = document.querySelector("#kinetic-instrument");
const svg = document.querySelector("#kinetic-wheel");
let scheduled = false;
let initializationObserver = null;

function phaseNodes(id) {
  const group = document.querySelector(`#${id}-track`);
  return {
    group,
    path: group?.querySelector(`.state-phase-progress[data-phase-ring="${id}"]`) ?? null,
    bead: group?.querySelector(`.state-phase-bead[data-phase-ring="${id}"]`) ?? null,
    gate: group?.querySelector(`.state-boundary-gate[data-boundary-ring="${id}"]`) ?? null,
    halo: group?.querySelector(`.state-boundary-shared-halo[data-boundary-ring="${id}"]`) ?? null,
    active: group?.querySelector(".cycle-sector.is-active") ?? null
  };
}

function phaseSlotsReady() {
  return RING_IDS.every(id => {
    const { group, path, bead, gate, halo, active } = phaseNodes(id);
    return Boolean(group && path && bead && gate && halo && active);
  });
}

function activeIndex(id) {
  const index = Number(phaseNodes(id).active?.dataset.cycleIndex);
  return Number.isInteger(index) ? index : null;
}

function clearBoundaryGate(id) {
  const { group, gate, halo } = phaseNodes(id);
  if (gate) {
    gate.setAttribute("visibility", "hidden");
    gate.dataset.boundaryShared = "false";
    gate.classList.remove("is-shared");
  }
  if (halo) halo.setAttribute("visibility", "hidden");
  if (!group) return;
  delete group.dataset.nextBoundaryMs;
  delete group.dataset.nextBoundaryShared;
  delete group.dataset.nextBoundarySharedWith;
}

function clearPhase(id) {
  const { group, path, bead } = phaseNodes(id);
  path?.removeAttribute("d");
  if (path) path.dataset.phaseVisible = "false";
  if (bead) {
    bead.dataset.phaseVisible = "false";
    bead.setAttribute("visibility", "hidden");
  }
  clearBoundaryGate(id);
  if (!group) return;
  delete group.dataset.phaseProgress;
  delete group.dataset.phaseStartMs;
  delete group.dataset.phaseEndMs;
  delete group.dataset.phaseSource;
  delete group.dataset.phaseBoundaryKind;
}

function renderBoundaryGate(id, activeIndexValue, phase, sharedWith) {
  if (!phase || !Number.isInteger(activeIndexValue)) {
    clearBoundaryGate(id);
    return;
  }
  const { group, gate, halo } = phaseNodes(id);
  if (!group || !gate || !halo) return;

  const model = ringModel(id);
  const angle = (activeIndexValue + 1) * 6 - GATE_INSET_DEGREES;
  const start = pointAt(WHEEL_CENTER, model.innerRadius + 1.5, angle);
  const end = pointAt(WHEEL_CENTER, model.innerRadius + 10.5, angle);
  const center = pointAt(WHEEL_CENTER, model.innerRadius + 6, angle);
  const peers = Array.isArray(sharedWith) ? sharedWith : [];
  const shared = peers.length > 0;

  gate.setAttribute("x1", start.x);
  gate.setAttribute("y1", start.y);
  gate.setAttribute("x2", end.x);
  gate.setAttribute("y2", end.y);
  gate.removeAttribute("visibility");
  gate.dataset.boundaryShared = String(shared);
  gate.classList.toggle("is-shared", shared);

  halo.setAttribute("cx", center.x);
  halo.setAttribute("cy", center.y);
  if (shared) halo.removeAttribute("visibility");
  else halo.setAttribute("visibility", "hidden");

  group.dataset.nextBoundaryMs = String(Math.round(phase.endMs));
  group.dataset.nextBoundaryShared = String(shared);
  group.dataset.nextBoundarySharedWith = peers.join(",");
}

function renderPhase(id, activeIndexValue, phase, sharedWith = []) {
  if (!phase || !Number.isInteger(activeIndexValue)) {
    clearPhase(id);
    return;
  }
  const { group, path, bead } = phaseNodes(id);
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
  renderBoundaryGate(id, activeIndexValue, phase, sharedWith);
}

function sharedPeersByRing(groups) {
  const peers = new Map(RING_IDS.map(id => [id, []]));
  for (const group of groups) {
    if (!group.shared) continue;
    for (const id of group.ringIds) {
      peers.set(id, group.ringIds.filter(peer => peer !== id));
    }
  }
  return peers;
}

function finishInitialization() {
  initializationObserver?.disconnect();
  initializationObserver = null;
  if (instrument) instrument.dataset.discretePhaseInit = "ready";
}

function refresh() {
  scheduled = false;
  if (!instrument || !svg) return;
  const instantMs = Number(instrument.dataset.selectedInstantMs);
  if (!Number.isFinite(instantMs) || !phaseSlotsReady()) {
    instrument.dataset.discretePhaseInit = "waiting-slots";
    return;
  }

  const phases = { ...discretePhaseWindows(instantMs) };
  // Legacy annual links can override the displayed month branch/longitude without
  // representing a complete physical instant. Do not attach a real-time month
  // progress bar or future boundary gate to that projected month identity.
  if (instrument.dataset.projectionMode === "legacy-longitude") phases.month = null;

  const boundaryGroups = exactNextBoundaryGroups(phases);
  const sharedGroups = boundaryGroups.filter(group => group.shared);
  const peers = sharedPeersByRing(boundaryGroups);
  for (const id of RING_IDS) renderPhase(id, activeIndex(id), phases[id], peers.get(id));

  instrument.dataset.discretePhaseMode = "true-boundaries";
  instrument.dataset.discretePhaseRings = RING_IDS.filter(id => phases[id]).join(",");
  instrument.dataset.exactSharedBoundaryCount = String(sharedGroups.length);
  instrument.dataset.exactSharedBoundaryGroups = sharedGroups
    .map(group => `${group.ringIds.join("+")}@${Math.round(group.instantMs)}`)
    .join(";");
  finishInitialization();
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

  // The view can be evaluated before the wheel renderer has appended all SVG
  // slots or marked the first active sectors. Watch only that bootstrap phase;
  // once all four discrete overlays render successfully, normal Selected Instant
  // mutations are the sole update clock and this observer is disconnected.
  initializationObserver = new MutationObserver(scheduleRefresh);
  initializationObserver.observe(svg, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class"]
  });

  instrument.dataset.discretePhaseInit = "waiting-slots";
  scheduleRefresh();
}
