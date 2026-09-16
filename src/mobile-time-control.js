import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";
import {
  formatMobileAtlasInput,
  parseMobileAtlasInput
} from "./mobile-time-value.js";

const instrument = document.querySelector("#kinetic-instrument");
const dock = document.querySelector("#mobile-time-dock");
const input = document.querySelector("#mobile-instant-input");
const applyButton = document.querySelector("#mobile-time-apply");
const status = document.querySelector("#mobile-time-status");
const mobileQuery = window.matchMedia("(max-width: 480px)");

function syncFromInstrument() {
  if (!instrument || !input || document.activeElement === input) return;
  const selectedMs = Number(instrument.dataset.selectedInstantMs);
  const value = formatMobileAtlasInput(selectedMs);
  if (value) input.value = value;
  dock?.setAttribute("data-selected-instant-ms", Number.isFinite(selectedMs) ? String(selectedMs) : "");
}

function setStatus(message, state = "idle") {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function applyExactTime() {
  if (!mobileQuery.matches || !input || !instrument) return;
  const instantMs = parseMobileAtlasInput(input.value);
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
  setStatus("已套用 · UTC+08:00", "success");
}

applyButton?.addEventListener("click", applyExactTime);
input?.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  applyExactTime();
});
input?.addEventListener("input", () => {
  input.removeAttribute("aria-invalid");
  setStatus("UTC+08:00 · 秒級", "idle");
});

if (instrument) {
  new MutationObserver(syncFromInstrument).observe(instrument, {
    attributes:true,
    attributeFilter:["data-selected-instant-ms"]
  });
}

syncFromInstrument();
