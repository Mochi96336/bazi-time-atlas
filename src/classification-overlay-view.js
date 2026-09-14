import {
  FIVE_ELEMENTS,
  ZODIAC_ELEMENTS,
  ZODIAC_MODALITIES,
  cycleClassification,
  pillarClassification,
  zodiacClassification
} from "./classification-model.js";

const PRIMARY_PILLARS = [
  ["hour", "時"],
  ["day", "日"],
  ["month", "月"],
  ["year", "年"]
];

const instrument = document.querySelector("#kinetic-instrument");
const wheel = document.querySelector("#kinetic-wheel");
const button = document.querySelector("#classification-overlay-button");
const legend = document.querySelector("#classification-overlay-legend");
const baziCurrent = document.querySelector("#classification-bazi-current");
const zodiacCurrent = document.querySelector("#classification-zodiac-current");

function annotateCycleSectors() {
  let annotated = 0;
  for (const [id] of PRIMARY_PILLARS) {
    for (const node of wheel?.querySelectorAll(`#${id}-track .cycle-sector[data-cycle-index]`) ?? []) {
      const index = Number(node.dataset.cycleIndex);
      if (!Number.isInteger(index)) continue;
      const classification = cycleClassification(index);
      node.dataset.stemElement = classification.stemElement;
      node.dataset.stemYinYang = classification.stemYinYang;
      node.dataset.branchElement = classification.branchElement;
      node.dataset.branchYinYang = classification.branchYinYang;
      annotated += 1;
    }
  }
  return annotated;
}

function annotateZodiacSectors() {
  let annotated = 0;
  for (const node of wheel?.querySelectorAll("#zodiac-track .zodiac-sector[data-zodiac-index]") ?? []) {
    const index = Number(node.dataset.zodiacIndex);
    if (!Number.isInteger(index)) continue;
    const classification = zodiacClassification(index);
    node.dataset.zodiacElement = classification.element;
    node.dataset.zodiacModality = classification.modality;
    annotated += 1;
  }
  return annotated;
}

function updateCurrentReadout() {
  if (!instrument) return;
  const pillarSummary = PRIMARY_PILLARS.map(([id, label]) => {
    const name = instrument.dataset[`${id}Pillar`] ?? "";
    const classification = pillarClassification(name);
    return classification
      ? `${label} ${classification.stemElement}/${classification.branchElement}`
      : `${label} —`;
  });
  if (baziCurrent) baziCurrent.textContent = pillarSummary.join(" · ");

  const zodiac = zodiacClassification(instrument.dataset.zodiac ?? "");
  if (zodiacCurrent) {
    zodiacCurrent.textContent = zodiac
      ? `${zodiac.name} · ${zodiac.element} · ${zodiac.modality}`
      : "—";
  }
}

function applyOverlay(enabled) {
  if (!instrument || !button || !legend) return;
  instrument.dataset.classificationOverlay = enabled ? "on" : "off";
  button.setAttribute("aria-pressed", String(enabled));
  button.classList.toggle("active", enabled);
  legend.hidden = !enabled;
  updateCurrentReadout();
}

function installKeys() {
  if (!legend) return;
  legend.querySelector("[data-five-elements]")?.replaceChildren(...FIVE_ELEMENTS.map(element => {
    const chip = document.createElement("i");
    chip.dataset.fiveElement = element;
    chip.textContent = element;
    return chip;
  }));
  legend.querySelector("[data-zodiac-elements]")?.replaceChildren(...ZODIAC_ELEMENTS.map(element => {
    const chip = document.createElement("i");
    chip.dataset.zodiacElementKey = element;
    chip.textContent = element;
    return chip;
  }));
  legend.querySelector("[data-zodiac-modalities]")?.replaceChildren(...ZODIAC_MODALITIES.map(modality => {
    const chip = document.createElement("i");
    chip.dataset.zodiacModalityKey = modality;
    chip.textContent = modality;
    return chip;
  }));
}

function initialize() {
  if (!instrument || !wheel || !button || !legend) return;
  const cycleCount = annotateCycleSectors();
  const zodiacCount = annotateZodiacSectors();
  instrument.dataset.classificationCycleSectors = String(cycleCount);
  instrument.dataset.classificationZodiacSectors = String(zodiacCount);
  installKeys();
  applyOverlay(false);

  button.addEventListener("click", () => {
    applyOverlay(button.getAttribute("aria-pressed") !== "true");
  });

  const observer = new MutationObserver(updateCurrentReadout);
  observer.observe(instrument, {
    attributes: true,
    attributeFilter: [
      "data-selected-instant-ms",
      "data-hour-pillar",
      "data-day-pillar",
      "data-month-pillar",
      "data-year-pillar",
      "data-zodiac"
    ]
  });
}

initialize();
