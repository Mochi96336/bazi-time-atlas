const instrument = document.querySelector("#kinetic-instrument");
const openControl = document.querySelector("#analysis-toggle");
const closeControl = document.querySelector("#analysis-close");

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

activate(openControl, () => setAnalysisOpen(true));
activate(closeControl, () => setAnalysisOpen(false, { reset:true }));

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && instrument?.dataset.analysisOpen === "true") {
    setAnalysisOpen(false, { reset:true });
    openControl?.focus();
  }
});

const params = new URLSearchParams(location.search);
setAnalysisOpen(params.get("analysis") === "1");
