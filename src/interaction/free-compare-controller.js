import { resetManualOffset } from "../wheel/ring-state.js";

export const FREE_COMPARE_OFFSET_EPSILON = 0.001;

const DEFAULT_RING_LABELS = Object.freeze({
  hour: "時",
  day: "日",
  solar: "節氣",
  month: "月",
  year: "年"
});

export function detachedCompareRings({ rings, ringStates, epsilon = FREE_COMPARE_OFFSET_EPSILON }) {
  return rings.filter(ring => Math.abs(ringStates[ring.id]?.manualOffset ?? 0) > epsilon);
}

export function freeCompareViewState({
  compareMode,
  rings,
  ringStates,
  ringLabels = DEFAULT_RING_LABELS,
  epsilon = FREE_COMPARE_OFFSET_EPSILON
}) {
  const detached = detachedCompareRings({ rings, ringStates, epsilon });
  const detachedIds = detached.map(ring => ring.id);
  const offsetLabel = value => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}°`;
  const statusText = !compareMode
    ? ""
    : detached.length
      ? `時間固定 · ${detached.map(ring => `${ringLabels[ring.id] ?? ring.id} ${offsetLabel(ringStates[ring.id].manualOffset)}`).join(" · ")}`
      : "時間固定 · 拖動任一圓環";

  return {
    compareMode:Boolean(compareMode),
    buttonLabel:compareMode ? "比較中" : "比較",
    buttonPressed:String(Boolean(compareMode)),
    resetHidden:detached.length === 0,
    scrubMode:compareMode ? "free-compare" : "linked-time",
    detachedIds,
    statusHidden:!compareMode,
    statusText
  };
}

export function createFreeCompareController({
  instrument,
  controlGroup,
  insertBefore,
  rings,
  ringStates,
  dragController,
  renderAllRingPoses,
  stopPlayback,
  documentRef = document
}) {
  if (!instrument || !controlGroup || !insertBefore || !dragController) return null;

  const compareButton = documentRef.createElement("button");
  compareButton.id = "compare-rings-button";
  compareButton.type = "button";
  compareButton.className = "control-button";
  compareButton.textContent = "比較";
  compareButton.setAttribute("aria-pressed", "false");
  compareButton.title = "自由比較：時間固定；每一層可獨立拖動，只改視覺偏移";
  controlGroup.prepend(compareButton);

  const resetRingsButton = documentRef.createElement("button");
  resetRingsButton.id = "reset-rings-button";
  resetRingsButton.type = "button";
  resetRingsButton.className = "control-button";
  resetRingsButton.textContent = "歸位";
  resetRingsButton.hidden = true;
  controlGroup.insertBefore(resetRingsButton, insertBefore);

  const compareStatus = documentRef.createElement("div");
  compareStatus.id = "ring-compare-status";
  compareStatus.hidden = true;
  instrument.appendChild(compareStatus);

  function update() {
    const view = freeCompareViewState({
      compareMode:dragController.compareMode,
      rings,
      ringStates
    });
    compareButton.setAttribute("aria-pressed", view.buttonPressed);
    compareButton.textContent = view.buttonLabel;
    resetRingsButton.hidden = view.resetHidden;
    instrument.dataset.compareMode = String(view.compareMode);
    instrument.dataset.scrubMode = view.scrubMode;
    instrument.dataset.detachedRings = view.detachedIds.join(",");
    compareStatus.hidden = view.statusHidden;
    compareStatus.textContent = view.statusText;
    return view;
  }

  function resetAllOffsets() {
    rings.forEach(ring => resetManualOffset(ringStates[ring.id]));
    if (ringStates.zodiac) resetManualOffset(ringStates.zodiac);
    renderAllRingPoses();
    update();
  }

  function setMode(enabled) {
    if (!enabled) resetAllOffsets();
    else stopPlayback();
    dragController.setCompareMode(enabled);
    update();
  }

  compareButton.addEventListener("click", () => setMode(!dragController.compareMode));
  resetRingsButton.addEventListener("click", resetAllOffsets);
  update();

  return Object.freeze({
    update,
    setMode,
    resetAllOffsets,
    get compareMode() { return dragController.compareMode; }
  });
}
