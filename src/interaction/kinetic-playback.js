export const DAY_MS = 86_400_000;

export const KINETIC_SCALE_CONFIG = Object.freeze({
  day: Object.freeze({
    label: "48 小時",
    spanDays: 1,
    sliderStep: 1 / 144,
    playDaysPerSecond: .25,
    edgeLabel: "1 日"
  }),
  year: Object.freeze({
    label: "一年",
    spanDays: 183,
    sliderStep: .25,
    playDaysPerSecond: 6,
    edgeLabel: "約半年"
  }),
  cycle: Object.freeze({
    label: "60 年",
    spanDays: 365.2422 * 30,
    sliderStep: 1,
    playDaysPerSecond: 365.2422,
    edgeLabel: "約 30 年"
  })
});

export function kineticScaleConfig(scale) {
  const config = KINETIC_SCALE_CONFIG[scale];
  if (!config) throw new RangeError(`Unknown kinetic scale: ${scale}`);
  return config;
}

export function sliderStateForScale({ scale, selectedMs, anchorMs }) {
  const config = kineticScaleConfig(scale);
  return {
    min: -config.spanDays,
    max: config.spanDays,
    step: config.sliderStep,
    value: (selectedMs - anchorMs) / DAY_MS,
    label: config.label,
    leftLabel: `−${config.edgeLabel}`,
    rightLabel: `+${config.edgeLabel}`
  };
}

export function advanceKineticPlayback({
  scale,
  selectedMs,
  anchorMs,
  previousTimestamp,
  timestamp
}) {
  const config = kineticScaleConfig(scale);
  const currentOffsetDays = (selectedMs - anchorMs) / DAY_MS;
  if (previousTimestamp === null) {
    return {
      selectedMs,
      offsetDays: currentOffsetDays,
      elapsedSeconds: 0,
      reachedEnd: currentOffsetDays >= config.spanDays
    };
  }

  const elapsedSeconds = Math.min((timestamp - previousTimestamp) / 1000, .1);
  const advancedMs = selectedMs + elapsedSeconds * config.playDaysPerSecond * DAY_MS;
  const offsetDays = (advancedMs - anchorMs) / DAY_MS;
  if (offsetDays >= config.spanDays) {
    return {
      selectedMs: anchorMs + config.spanDays * DAY_MS,
      offsetDays: config.spanDays,
      elapsedSeconds,
      reachedEnd: true
    };
  }

  return {
    selectedMs: advancedMs,
    offsetDays,
    elapsedSeconds,
    reachedEnd: false
  };
}
