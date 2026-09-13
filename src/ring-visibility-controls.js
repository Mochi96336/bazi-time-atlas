import "./reference-frame-controls.js";
import { RINGS } from "./wheel/ring-model.js";

const svg = document.querySelector("#kinetic-wheel");
const instrument = document.querySelector("#kinetic-instrument");
const legend = document.querySelector(".ring-legend");
const hiddenRings = new Set();
const rows = new Map();

function ringIds() {
  return RINGS.map(ring => ring.id);
}

function syncDiagnostics() {
  if (!svg || !instrument) return;
  const hidden = ringIds().filter(id => hiddenRings.has(id));
  const visible = ringIds().filter(id => !hiddenRings.has(id));
  svg.dataset.hiddenRings = hidden.join(",");
  instrument.dataset.hiddenRings = hidden.join(",");
  instrument.dataset.visibleRings = visible.join(",");
  instrument.dataset.visibleRingCount = String(visible.length);
}

function setRingVisible(id, visible) {
  if (!RINGS.some(ring => ring.id === id)) return;
  if (visible) hiddenRings.delete(id);
  else hiddenRings.add(id);

  const hidden = !visible;
  const track = svg?.querySelector(`#${id}-track`);
  const trace = svg?.querySelector(`[data-motion-ring="${id}"]`);
  if (track) track.dataset.layerHidden = String(hidden);
  if (trace) {
    trace.dataset.layerHidden = String(hidden);
    trace.classList.remove("is-visible");
  }

  const row = rows.get(id);
  if (row) {
    row.setAttribute("aria-pressed", String(visible));
    row.classList.toggle("is-hidden", hidden);
    const label = row.querySelector("span")?.textContent?.trim() || id;
    row.title = `${visible ? "隱藏" : "顯示"}${label}圓環`;
  }
  syncDiagnostics();
}

function toggleRing(id) {
  setRingVisible(id, hiddenRings.has(id));
}

function activateRow(event, id) {
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
  if (event.type === "keydown") event.preventDefault();
  toggleRing(id);
}

if (svg && instrument && legend) {
  legend.removeAttribute("aria-hidden");
  RINGS.forEach(ring => {
    const row = legend.querySelector(`.ring-${ring.id}`);
    if (!row) return;
    rows.set(ring.id, row);
    row.dataset.ringToggle = ring.id;
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute("aria-pressed", "true");
    row.addEventListener("click", event => activateRow(event, ring.id));
    row.addEventListener("keydown", event => activateRow(event, ring.id));
    setRingVisible(ring.id, true);
  });
  syncDiagnostics();
}
