import "./ring-visibility-controls.js";
import "./discrete-phase-view.js";
import "./kinetic-fan-guard.js";
import {
  jieBoundaryContext,
  solarTermEventsBetween,
  solarTermNamedEventsBetween
} from "./astronomy/solar-term-boundaries.js";
import { civilFieldsFromInstant } from "./wheel/atlas-display-model.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  formatAtlasUtcOffset,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const instrument = document.querySelector("#kinetic-instrument");
const slider = document.querySelector("#time-slider");
const boundaryRail = document.querySelector("#boundary-rail");
const previousReadout = document.querySelector("#previous-jie-readout");
const nextReadout = document.querySelector("#next-jie-readout");
const boundaryMode = document.querySelector("#boundary-mode-readout");

let railSignature = null;
let railEvents = [];
let railNodes = [];

function selectedInstantMs() {
  const value = Number(instrument?.dataset.selectedInstantMs);
  return Number.isFinite(value) ? value : null;
}

function currentTimeContext() {
  if (!instrument) return DEFAULT_ATLAS_TIME_CONTEXT;
  const rawUtc = instrument.dataset.utcOffsetHours;
  const rawBoundary = instrument.dataset.dayBoundary;
  if (rawUtc === undefined && rawBoundary === undefined) return DEFAULT_ATLAS_TIME_CONTEXT;

  try {
    return normalizeAtlasTimeContext({
      utcOffsetHours: rawUtc === undefined ? DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours : Number(rawUtc),
      dayBoundary: rawBoundary ?? DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
    });
  } catch {
    return DEFAULT_ATLAS_TIME_CONTEXT;
  }
}

function formatCompact(event, timeContext) {
  if (!event) return "—";
  const fields = civilFieldsFromInstant(event.instantMs, timeContext);
  const pad = value => String(value).padStart(2, "0");
  return `${event.name} · ${pad(fields.month)}/${pad(fields.day)} ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
}

function formatBoundaryTitle(event, timeContext) {
  const fields = civilFieldsFromInstant(event.instantMs, timeContext);
  const pad = value => String(value).padStart(2, "0");
  const offset = formatAtlasUtcOffset(timeContext.utcOffsetHours);
  return `${event.name} · ${fields.year}-${pad(fields.month)}-${pad(fields.day)} ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)} · ${offset}`;
}

function activeScale() {
  return document.querySelector("[data-scale].active")?.dataset.scale ?? "year";
}

function railWindow(selectedMs) {
  const valueDays = Number(slider.value);
  const minDays = Number(slider.min);
  const maxDays = Number(slider.max);
  if (![valueDays, minDays, maxDays].every(Number.isFinite)) return null;
  const anchorMs = selectedMs - valueDays * DAY_MS;
  return {
    anchorMs,
    startMs: anchorMs + minDays * DAY_MS,
    endMs: anchorMs + maxDays * DAY_MS,
    minDays,
    maxDays
  };
}

function renderRail(selectedMs, timeContext) {
  if (!boundaryRail || !slider) return;
  const window = railWindow(selectedMs);
  if (!window) return;
  const scale = activeScale();
  const signature = `${scale}|${Math.round(window.anchorMs / 1000)}|${window.minDays}|${window.maxDays}|${timeContext.utcOffsetHours}`;
  if (signature === railSignature) return;
  railSignature = signature;

  railEvents = scale === "cycle"
    ? solarTermNamedEventsBetween(window.startMs, window.endMs, ["立春"])
    : solarTermEventsBetween(window.startMs, window.endMs).filter(event => event.kind === "jie");

  boundaryRail.replaceChildren();
  railNodes = railEvents.map(event => {
    const marker = document.createElement("span");
    const position = (event.instantMs - window.startMs) / (window.endMs - window.startMs);
    marker.className = `boundary-marker${event.name === "立春" ? " li-chun" : ""}`;
    marker.style.left = `${Math.max(0, Math.min(1, position)) * 100}%`;
    marker.dataset.boundaryName = event.name;
    marker.dataset.boundaryInstant = new Date(event.instantMs).toISOString();
    marker.title = formatBoundaryTitle(event, timeContext);
    if (scale === "year") {
      const label = document.createElement("i");
      label.textContent = event.name;
      marker.appendChild(label);
    }
    boundaryRail.appendChild(marker);
    return marker;
  });

  if (boundaryMode) {
    boundaryMode.textContent = scale === "cycle"
      ? "60 年尺度：只標立春換年"
      : `精確「節」界 · ${formatAtlasUtcOffset(timeContext.utcOffsetHours)}`;
  }
}

function updateNearMarker(selectedMs) {
  railNodes.forEach((node, index) => {
    const event = railEvents[index];
    node.classList.toggle("is-near", Math.abs(event.instantMs - selectedMs) <= 6 * HOUR_MS);
    node.classList.toggle("is-past", event.instantMs <= selectedMs);
  });
}

function updateBoundaryContext(selectedMs, timeContext) {
  const context = jieBoundaryContext(selectedMs);
  if (previousReadout) previousReadout.textContent = formatCompact(context.previous, timeContext);
  if (nextReadout) nextReadout.textContent = formatCompact(context.next, timeContext);

  if (context.previous) {
    instrument.dataset.previousJie = context.previous.name;
    instrument.dataset.previousJieInstant = new Date(context.previous.instantMs).toISOString();
  }
  if (context.next) {
    instrument.dataset.nextJie = context.next.name;
    instrument.dataset.nextJieInstant = new Date(context.next.instantMs).toISOString();
  }
}

function refresh() {
  const selectedMs = selectedInstantMs();
  if (!Number.isFinite(selectedMs)) return;
  const timeContext = currentTimeContext();
  renderRail(selectedMs, timeContext);
  updateNearMarker(selectedMs);
  updateBoundaryContext(selectedMs, timeContext);
}

if (instrument && slider && boundaryRail) {
  new MutationObserver(refresh).observe(instrument, {
    attributes:true,
    attributeFilter:["data-selected-instant-ms", "data-utc-offset-hours", "data-day-boundary"]
  });
  slider.addEventListener("input", refresh);
  document.querySelectorAll("[data-scale]").forEach(button => button.addEventListener("click", () => queueMicrotask(refresh)));
  refresh();
}
