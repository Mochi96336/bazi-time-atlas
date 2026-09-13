import "./ring-visibility-controls.js";
import "./discrete-phase-view.js";
import "./kinetic-fan-guard.js";
import {
  formatSolarTermEvent,
  jieBoundaryContext,
  solarTermEventsBetween,
  solarTermNamedEventsBetween
} from "./astronomy/solar-term-boundaries.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const UTC_OFFSET_HOURS = 8;

const instrument = document.querySelector("#kinetic-instrument");
const instantReadout = document.querySelector("#instant-readout");
const slider = document.querySelector("#time-slider");
const boundaryRail = document.querySelector("#boundary-rail");
const previousReadout = document.querySelector("#previous-jie-readout");
const nextReadout = document.querySelector("#next-jie-readout");
const boundaryMode = document.querySelector("#boundary-mode-readout");

let railSignature = null;
let railEvents = [];
let railNodes = [];

function instantFromReadout() {
  const text = instantReadout?.textContent ?? "";
  const match = /(-?\d{1,6})-(\d{2})-(\d{2}) · (\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(Number(hour), Number(minute), Number(second), 0);
  return date.getTime() - UTC_OFFSET_HOURS * HOUR_MS;
}

function formatCompact(event) {
  if (!event) return "—";
  const fields = event.referenceFields;
  const pad = value => String(value).padStart(2, "0");
  return `${event.name} · ${pad(fields.month)}/${pad(fields.day)} ${pad(fields.hour)}:${pad(fields.minute)}:${pad(fields.second)}`;
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

function renderRail(selectedMs) {
  if (!boundaryRail || !slider) return;
  const window = railWindow(selectedMs);
  if (!window) return;
  const scale = activeScale();
  const signature = `${scale}|${Math.round(window.anchorMs / 1000)}|${window.minDays}|${window.maxDays}`;
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
    marker.title = `${formatSolarTermEvent(event)} · UTC+08:00`;
    if (scale === "year") {
      const label = document.createElement("i");
      label.textContent = event.name;
      marker.appendChild(label);
    }
    boundaryRail.appendChild(marker);
    return marker;
  });

  boundaryMode.textContent = scale === "cycle"
    ? "60 年尺度：只標立春換年"
    : "精確「節」界 · UTC+08:00";
}

function updateNearMarker(selectedMs) {
  railNodes.forEach((node, index) => {
    const event = railEvents[index];
    node.classList.toggle("is-near", Math.abs(event.instantMs - selectedMs) <= 6 * HOUR_MS);
    node.classList.toggle("is-past", event.instantMs <= selectedMs);
  });
}

function updateBoundaryContext(selectedMs) {
  const context = jieBoundaryContext(selectedMs);
  previousReadout.textContent = formatCompact(context.previous);
  nextReadout.textContent = formatCompact(context.next);

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
  const selectedMs = instantFromReadout();
  if (!Number.isFinite(selectedMs)) return;
  renderRail(selectedMs);
  updateNearMarker(selectedMs);
  updateBoundaryContext(selectedMs);
}

if (instantReadout && slider && boundaryRail) {
  new MutationObserver(refresh).observe(instantReadout, { childList: true, characterData: true, subtree: true });
  slider.addEventListener("input", refresh);
  document.querySelectorAll("[data-scale]").forEach(button => button.addEventListener("click", () => queueMicrotask(refresh)));
  refresh();
}
