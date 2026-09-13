const instrument = document.querySelector("#kinetic-instrument");
const buttons = [...document.querySelectorAll(".scale-button[data-scale]")];

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
  applyScaleEmphasis(initialScale());
  for (const button of buttons) {
    button.addEventListener("click", () => applyScaleEmphasis(button.dataset.scale));
  }
}

export { SCALE_EMPHASIS, applyScaleEmphasis };
