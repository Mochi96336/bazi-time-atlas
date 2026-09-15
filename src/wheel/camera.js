export const DEFAULT_VIEWPORT = Object.freeze({
  x: 0,
  y: 0,
  width: 1200,
  height: 760
});

export const CAMERA_BREAKPOINTS = Object.freeze({
  mobileMax: 480,
  compactMax: 820
});

// Camera framing is presentation-owned. Express each composition relative to
// the canonical outer radius so later ring-geometry work can change absolute
// world dimensions without returning to a frozen 1200x760 crop.
//
// `widthRatio` / `heightRatio` describe how much of the giant fan is visible.
// `topMargin` keeps the outer Year crown clear of the toolbar. The resulting
// bottom edge intentionally approaches the common radial origin: this restores
// the perceptual convergence that the old horizontal-only zoom cropped away.
export const CAMERA_FRAME_BY_MODE = Object.freeze({
  desktop: Object.freeze({ widthRatio:1.60, heightRatio:.74, topMargin:40 }),
  compact: Object.freeze({ widthRatio:1.12, heightRatio:.76, topMargin:30 }),
  mobile: Object.freeze({ widthRatio:.44, heightRatio:.81, topMargin:20 })
});

export function cameraModeForWidth(viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) throw new RangeError("viewportWidth must be positive and finite");
  if (viewportWidth <= CAMERA_BREAKPOINTS.mobileMax) return "mobile";
  if (viewportWidth <= CAMERA_BREAKPOINTS.compactMax) return "compact";
  return "desktop";
}

export function radialInstrumentViewBox({ center, outerRadius, frame }) {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new TypeError("center must contain finite x/y coordinates");
  }
  if (!Number.isFinite(outerRadius) || outerRadius <= 0) throw new RangeError("outerRadius must be positive and finite");
  if (!frame || !Number.isFinite(frame.widthRatio) || frame.widthRatio <= 0 ||
      !Number.isFinite(frame.heightRatio) || frame.heightRatio <= 0 ||
      !Number.isFinite(frame.topMargin)) {
    throw new TypeError("frame must contain positive width/height ratios and a finite topMargin");
  }

  const width = outerRadius * frame.widthRatio;
  const height = outerRadius * frame.heightRatio;
  return Object.freeze({
    x: center.x - width / 2,
    y: center.y - outerRadius - frame.topMargin,
    width,
    height
  });
}

export function responsiveInstrumentCamera({ center, outerRadius, viewportWidth }) {
  const mode = cameraModeForWidth(viewportWidth);
  const frame = CAMERA_FRAME_BY_MODE[mode];
  const viewBox = radialInstrumentViewBox({ center, outerRadius, frame });
  const originGap = center.y - (viewBox.y + viewBox.height);
  const originGapRatio = originGap / outerRadius;
  const zoom = DEFAULT_VIEWPORT.width / viewBox.width;

  return Object.freeze({
    mode,
    zoom,
    topMargin:frame.topMargin,
    originGap,
    originGapRatio,
    viewBox
  });
}

export function viewBoxString(viewBox) {
  return `${viewBox.x.toFixed(3)} ${viewBox.y.toFixed(3)} ${viewBox.width.toFixed(3)} ${viewBox.height.toFixed(3)}`;
}
