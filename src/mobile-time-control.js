import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  formatAtlasUtcOffset,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";
import {
  formatMobileAtlasInput,
  parseMobileAtlasInput
} from "./mobile-time-value.js";

const instrument = document.querySelector("#kinetic-instrument");
const dock = document.querySelector("#mobile-time-dock");
const input = document.querySelector("#mobile-instant-input");
const inputLabel = document.querySelector(".mobile-time-field > span");
const applyButton = document.querySelector("#mobile-time-apply");
const status = document.querySelector("#mobile-time-status");
const mobileQuery = window.matchMedia("(max-width: 480px)");

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

function setStatus(message, state = "idle") {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function syncContextCopy(context) {
  const offsetLabel = formatAtlasUtcOffset(context.utcOffsetHours);
  if (inputLabel) inputLabel.textContent = `選定時間，${offsetLabel}，秒級`;
  input?.setAttribute("aria-label", `選定時間，${offsetLabel}，秒級`);
  if (!status || status.dataset.state === "idle") setStatus(`${offsetLabel} · 秒級`, "idle");
  dock?.setAttribute("data-utc-offset-hours", String(context.utcOffsetHours));
  dock?.setAttribute("data-day-boundary", context.dayBoundary);
}

function syncFromInstrument() {
  if (!instrument || !input) return;
  const context = currentTimeContext();
  syncContextCopy(context);
  if (document.activeElement === input) return;

  const selectedMs = Number(instrument.dataset.selectedInstantMs);
  const value = formatMobileAtlasInput(selectedMs, context);
  if (value) input.value = value;
  dock?.setAttribute("data-selected-instant-ms", Number.isFinite(selectedMs) ? String(selectedMs) : "");
}

function applyExactTime() {
  if (!mobileQuery.matches || !input || !instrument) return;
  const context = currentTimeContext();
  const instantMs = parseMobileAtlasInput(input.value, context);
  if (instantMs === null) {
    input.setAttribute("aria-invalid", "true");
    setStatus("時間格式無效", "error");
    return;
  }
  input.removeAttribute("aria-invalid");

  setStatus("套用中…", "pending");
  instrument.dispatchEvent(new CustomEvent(SELECTED_INSTANT_COMMAND, {
    detail:{ instantMs, source:"mobile-exact" }
  }));

  if (Number(instrument.dataset.selectedInstantMs) !== Math.round(instantMs)) {
    setStatus("無法套用時間", "error");
    return;
  }

  syncFromInstrument();
  setStatus(`已套用 · ${formatAtlasUtcOffset(context.utcOffsetHours)}`, "success");
}

applyButton?.addEventListener("click", applyExactTime);
input?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyExactTime();
});
input?.addEventListener("input", () => {
  input.removeAttribute("aria-invalid");
  const context = currentTimeContext();
  setStatus(`${formatAtlasUtcOffset(context.utcOffsetHours)} · 秒級`, "idle");
});

if (instrument) {
  new MutationObserver(syncFromInstrument).observe(instrument, {
    attributes:true,
    attributeFilter:["data-selected-instant-ms", "data-utc-offset-hours", "data-day-boundary"]
  });
}

syncFromInstrument();
