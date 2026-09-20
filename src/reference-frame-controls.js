import {
  REFERENCE_RING_IDS,
  referenceAnchorForOffset,
  validReferenceRing
} from "./wheel/reference-frame.js";

const RING_LABELS = Object.freeze({
  hour:"時",
  year:"年",
  month:"月",
  day:"日",
  solar:"太陽"
});
const REFERENCE_FRAME_EVENT = "atlas-reference-frame-change";

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const legend = document.querySelector(".ring-legend");
let select = null;

function effectiveRotation(id) {
  const track = svg?.querySelector(`#${id}-track`);
  if (!track) return null;
  const model = Number(track.dataset.modelRotation);
  const manual = Number(track.dataset.manualOffset);
  if (!Number.isFinite(model) || !Number.isFinite(manual)) return null;
  return model + manual;
}

function currentFrameOffset() {
  const value = Number(svg?.dataset.referenceFrameOffsetDegrees);
  return Number.isFinite(value) ? value : 0;
}

function syncLegend(referenceId) {
  document.querySelectorAll(".ring-legend-row[data-ring-toggle]").forEach(row => {
    row.dataset.referenceActive = String(Boolean(referenceId && row.dataset.ringToggle === referenceId));
  });
}

function setReferenceFrame(requestedId) {
  if (!svg || !instrument) return false;
  const referenceId = validReferenceRing(requestedId) ? requestedId : null;
  const currentId = validReferenceRing(svg.dataset.referenceRing) ? svg.dataset.referenceRing : null;
  if (referenceId === currentId) return true;

  if (referenceId) {
    const worldRotation = effectiveRotation(referenceId);
    const anchorRotation = referenceAnchorForOffset(worldRotation, currentFrameOffset());
    if (!Number.isFinite(anchorRotation)) return false;
    svg.dataset.referenceRing = referenceId;
    svg.dataset.referenceAnchorRotation = anchorRotation.toFixed(6);
    instrument.dataset.referenceFrame = referenceId;
  } else {
    delete svg.dataset.referenceRing;
    delete svg.dataset.referenceAnchorRotation;
    instrument.dataset.referenceFrame = "world";
  }

  if (select) select.value = referenceId ?? "world";
  syncLegend(referenceId);
  svg.dispatchEvent(new CustomEvent(REFERENCE_FRAME_EVENT, {
    detail:{ referenceId:referenceId ?? "world" }
  }));
  return true;
}

function installControl() {
  if (!svg || !instrument || !legend) return;
  const control = document.createElement("label");
  control.className = "reference-frame-control";
  control.htmlFor = "reference-frame-select";

  const caption = document.createElement("span");
  caption.textContent = "固定視角";

  select = document.createElement("select");
  select.id = "reference-frame-select";
  select.setAttribute("aria-label", "固定哪一圈作為觀看基準");
  select.title = "固定一圈作為觀看基準，其他圓環會顯示相對移動；不會改變目前時間";

  const world = document.createElement("option");
  world.value = "world";
  world.textContent = "不固定";
  select.appendChild(world);

  REFERENCE_RING_IDS.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = RING_LABELS[id];
    select.appendChild(option);
  });

  control.append(caption, select);
  legend.prepend(control);
  instrument.dataset.referenceFrame = "world";
  syncLegend(null);

  select.addEventListener("change", () => {
    if (!setReferenceFrame(select.value)) select.value = svg.dataset.referenceRing ?? "world";
  });
}

installControl();

export { setReferenceFrame };
