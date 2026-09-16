const instrument = document.querySelector("#kinetic-instrument");
const buttons = [...document.querySelectorAll(".scale-button[data-scale]")];

const TIME_WINDOW_EXPLANATION = "聯動拖曳範圍、播放節奏與閱讀重點；不改變圓盤幾何或各層實際相位。";
const TIME_WINDOW_COPY = Object.freeze({
  day: Object.freeze({ label:"48 小時", range:"前後各 1 日" }),
  year: Object.freeze({ label:"一年", range:"前後約半年" }),
  cycle: Object.freeze({ label:"60 年", range:"前後約 30 年" })
});

const SCALE_EMPHASIS = Object.freeze({
  day: Object.freeze({
    focus: Object.freeze(["hour", "day"]),
    context: Object.freeze(["solar"]),
    ambient: Object.freeze(["month", "year"]),
    label: "時 / 日"
  }),
  year: Object.freeze({
    focus: Object.freeze(["solar", "month"]),
    context: Object.freeze(["year"]),
    ambient: Object.freeze(["hour", "day"]),
    label: "年度座標 / 月"
  }),
  cycle: Object.freeze({
    focus: Object.freeze(["year"]),
    context: Object.freeze(["month", "solar"]),
    ambient: Object.freeze(["day", "hour"]),
    label: "年"
  })
});

function installTimeWindowSemantics() {
  if (!instrument || !buttons.length) return false;
  const group = buttons[0].closest('[role="group"]') ?? buttons[0].parentElement;
  if (group) {
    group.setAttribute("aria-label", "觀察時間窗");
    group.setAttribute("title", TIME_WINDOW_EXPLANATION);
    group.dataset.timeWindowGroup = "true";
  }
  const statusLabel = document.querySelector(".timeline-status span");
  if (statusLabel) statusLabel.textContent = "觀察時間窗";

  for (const button of buttons) {
    const copy = TIME_WINDOW_COPY[button.dataset.scale];
    if (!copy) continue;
    button.setAttribute("aria-label", `${copy.label}觀察時間窗；${copy.range}；${TIME_WINDOW_EXPLANATION}`);
    button.title = `${copy.range}。${TIME_WINDOW_EXPLANATION}`;
  }

  instrument.dataset.timeWindowEffects = "slider-range,playback-tempo,reading-emphasis";
  instrument.dataset.timeWindowGeometry = "unchanged";
  instrument.dataset.timeWindowPhase = "unchanged";
  return true;
}

function applyScaleEmphasis(scale) {
  if (!instrument || !SCALE_EMPHASIS[scale]) return false;
  const emphasis = SCALE_EMPHASIS[scale];
  instrument.dataset.scaleWindow = scale;
  instrument.dataset.scaleFocusRings = emphasis.focus.join(",");
  instrument.dataset.scaleContextRings = emphasis.context.join(",");
  instrument.dataset.scaleAmbientRings = emphasis.ambient.join(",");
  instrument.dataset.scaleFocusLabel = emphasis.label;

  for (const button of buttons) {
    const active = button.dataset.scale === scale;
    button.dataset.scaleFocusActive = String(active);
    button.setAttribute("aria-current", active ? "true" : "false");
  }
  return true;
}

function initialScale() {
  return buttons.find(button => button.classList.contains("active"))?.dataset.scale
    ?? buttons[0]?.dataset.scale
    ?? "year";
}

if (instrument && buttons.length) {
  installTimeWindowSemantics();
  applyScaleEmphasis(initialScale());
  for (const button of buttons) {
    button.addEventListener("click", () => applyScaleEmphasis(button.dataset.scale));
  }
}

export { SCALE_EMPHASIS, TIME_WINDOW_COPY, TIME_WINDOW_EXPLANATION, applyScaleEmphasis, installTimeWindowSemantics };
