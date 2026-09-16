import {
  formatMobileAtlasInput,
  mobileExactInstantUrl,
  parseMobileAtlasInput
} from "./mobile-time-value.js";

const instrument = document.querySelector("#kinetic-instrument");
const dock = document.querySelector("#mobile-time-dock");
const input = document.querySelector("#mobile-instant-input");
const desktopInput = document.querySelector("#instant-input");
const applyButton = document.querySelector("#mobile-time-apply");
const status = document.querySelector("#mobile-time-status");
const mobileQuery = window.matchMedia("(max-width: 480px)");

if (desktopInput) {
  desktopInput.step = "1";
  desktopInput.setAttribute("aria-label", "選定時間，UTC+8，秒級");
  desktopInput.dataset.precision = "second";
}

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
  if (!mobileQuery.matches || !input) return;
  const instantMs = parseMobileAtlasInput(input.value);
  if (instantMs === null) {
    input.setAttribute("aria-invalid", "true");
    setStatus("時間格式無效", "error");
    return;
  }
  input.removeAttribute("aria-invalid");
  const href = mobileExactInstantUrl(location.href, instantMs);
  if (!href) {
    setStatus("無法套用時間", "error");
    return;
  }
  setStatus("套用中…", "pending");
  location.assign(href);
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
