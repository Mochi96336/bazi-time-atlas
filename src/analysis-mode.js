import { installAtlasSolarTimeAnalysis } from "./atlas-solar-time-analysis.js";
import { installAtlasVisibleTenGods } from "./atlas-visible-ten-gods.js";

const instrument = document.querySelector("#kinetic-instrument");
const openControl = document.querySelector("#analysis-toggle");
const closeControl = document.querySelector("#analysis-close");

function installAnalysisFirstScreenStyles() {
  if (document.querySelector("link[data-analysis-first-screen]")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./analysis-first-screen.css";
  stylesheet.dataset.analysisFirstScreen = "1";
  document.head.append(stylesheet);
}

function installSolarTimeStyles() {
  if (document.querySelector("link[data-atlas-solar-time-analysis]")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./atlas-solar-time-analysis.css";
  stylesheet.dataset.atlasSolarTimeAnalysis = "1";
  document.head.append(stylesheet);
}

function installAnalysisFirstScreenPolishStyles() {
  if (document.querySelector("link[data-analysis-first-screen-polish]")) return;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./analysis-first-screen-polish.css";
  stylesheet.dataset.analysisFirstScreenPolish = "1";
  document.head.append(stylesheet);
}

function activate(control, handler) {
  if (!control) return;
  control.addEventListener("click", handler);
  control.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler();
  });
}

function resetAnalysisLenses() {
  const compare = document.querySelector("#compare-rings-button");
  if (compare?.getAttribute("aria-pressed") === "true") compare.click();

  const classification = document.querySelector("#classification-overlay-button");
  if (classification?.getAttribute("aria-pressed") === "true") classification.click();

  const reference = document.querySelector("#reference-frame-select");
  if (reference && reference.value !== "world") {
    reference.value = "world";
    reference.dispatchEvent(new Event("change", { bubbles:true }));
  }

  document.querySelectorAll(".ring-legend-row[data-ring-toggle][aria-pressed=\"false\"]")
    .forEach(row => row.click());
}

function setAnalysisOpen(open, { reset = false } = {}) {
  if (!instrument || !openControl || !closeControl) return;
  if (!open && reset) resetAnalysisLenses();
  instrument.dataset.analysisOpen = String(Boolean(open));
  openControl.setAttribute("aria-expanded", String(Boolean(open)));
  openControl.hidden = Boolean(open);
  closeControl.hidden = !open;
}

installAnalysisFirstScreenStyles();
installSolarTimeStyles();
installAtlasSolarTimeAnalysis(instrument);
installAtlasVisibleTenGods(instrument);
// atlas-visible-ten-gods installs its own stylesheet dynamically. Install the
// final desktop polish afterwards so it can flatten that panel without changing
// the component's data/lifecycle ownership or compact/mobile CSS.
installAnalysisFirstScreenPolishStyles();
activate(openControl, () => setAnalysisOpen(true));
activate(closeControl, () => setAnalysisOpen(false, { reset:true }));

instrument?.addEventListener("atlas-analysis-request", () => setAnalysisOpen(true));

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && instrument?.dataset.analysisOpen === "true") {
    setAnalysisOpen(false, { reset:true });
    openControl?.focus();
  }
});

const params = new URLSearchParams(location.search);
setAnalysisOpen(params.get("analysis") === "1" || params.get("classification") === "1");
