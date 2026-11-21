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

// Vertical framing owns radial composition. Horizontal framing follows the
// actual rendered SVG aspect ratio so the camera does not introduce a second,
// hidden crop merely because desktop and portrait containers have different
// shapes. With the deeper ring envelope, all breakpoints can share roughly the
// same radial depth while reserving different top headroom for their HUD.
export const CAMERA_FRAME_BY_MODE = Object.freeze({
  desktop: Object.freeze({ heightRatio:.72, topMargin:80 }),
  compact: Object.freeze({ heightRatio:.72, topMargin:90 }),
  mobile: Object.freeze({ heightRatio:.72, topMargin:100 })
});

export function cameraModeForWidth(viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) throw new RangeError("viewportWidth must be positive and finite");
  if (viewportWidth <= CAMERA_BREAKPOINTS.mobileMax) return "mobile";
  if (viewportWidth <= CAMERA_BREAKPOINTS.compactMax) return "compact";
  return "desktop";
}

export function radialInstrumentViewBox({ center, outerRadius, viewportAspect, frame }) {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new TypeError("center must contain finite x/y coordinates");
  }
  if (!Number.isFinite(outerRadius) || outerRadius <= 0) throw new RangeError("outerRadius must be positive and finite");
  if (!Number.isFinite(viewportAspect) || viewportAspect <= 0) throw new RangeError("viewportAspect must be positive and finite");
  if (!frame || !Number.isFinite(frame.heightRatio) || frame.heightRatio <= 0 || !Number.isFinite(frame.topMargin)) {
    throw new TypeError("frame must contain a positive heightRatio and finite topMargin");
  }

  const height = outerRadius * frame.heightRatio;
  const width = height * viewportAspect;
  return Object.freeze({
    x: center.x - width / 2,
    y: center.y - outerRadius - frame.topMargin,
    width,
    height
  });
}

export function responsiveInstrumentCamera({
  center,
  outerRadius,
  viewportWidth,
  viewportAspect = DEFAULT_VIEWPORT.width / DEFAULT_VIEWPORT.height
}) {
  const mode = cameraModeForWidth(viewportWidth);
  const frame = CAMERA_FRAME_BY_MODE[mode];
  const viewBox = radialInstrumentViewBox({ center, outerRadius, viewportAspect, frame });
  const originGap = center.y - (viewBox.y + viewBox.height);
  const originGapRatio = originGap / outerRadius;
  const zoom = DEFAULT_VIEWPORT.height / viewBox.height;

  return Object.freeze({
    mode,
    zoom,
    topMargin:frame.topMargin,
    originGap,
    originGapRatio,
    viewportAspect,
    viewBox
  });
}

export function viewBoxString(viewBox) {
  return `${viewBox.x.toFixed(3)} ${viewBox.y.toFixed(3)} ${viewBox.width.toFixed(3)} ${viewBox.height.toFixed(3)}`;
}
