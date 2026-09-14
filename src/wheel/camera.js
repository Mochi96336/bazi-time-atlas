export const DEFAULT_VIEWPORT = Object.freeze({
  x: 0,
  y: 0,
  width: 1200,
  height: 760
});

export const CAMERA_TOP_MARGIN = 120;
export const CAMERA_BREAKPOINTS = Object.freeze({
  mobileMax: 480,
  compactMax: 820
});
export const CAMERA_ZOOM = Object.freeze({
  desktop: 1,
  compact: 1.32,
  mobile: 3
});

// The world geometry stays identical at every breakpoint. Only the camera
// changes. A phone is much taller relative to its width than the desktop SVG;
// using the desktop headroom with a merely horizontal crop leaves the fan
// floating in the middle of the instrument. Keep enough mobile world-space
// headroom for the cursor note and instrument metadata while bringing the
// outer Year shell closer to the top of the portrait composition.
export const CAMERA_TOP_MARGIN_BY_MODE = Object.freeze({
  desktop: CAMERA_TOP_MARGIN,
  compact: CAMERA_TOP_MARGIN,
  mobile: 150
});

export function instrumentViewBox({ center, outerRadius, viewport = DEFAULT_VIEWPORT, topMargin = CAMERA_TOP_MARGIN }) {
  return Object.freeze({
    x: viewport.x,
    y: center.y - outerRadius - topMargin,
    width: viewport.width,
    height: viewport.height
  });
}

export function cameraModeForWidth(viewportWidth) {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) throw new RangeError("viewportWidth must be positive and finite");
  if (viewportWidth <= CAMERA_BREAKPOINTS.mobileMax) return "mobile";
  if (viewportWidth <= CAMERA_BREAKPOINTS.compactMax) return "compact";
  return "desktop";
}

export function horizontallyZoomedViewBox(viewBox, zoom) {
  if (!Number.isFinite(zoom) || zoom <= 0) throw new RangeError("zoom must be positive and finite");
  const width = viewBox.width / zoom;
  return Object.freeze({
    x: viewBox.x + (viewBox.width - width) / 2,
    y: viewBox.y,
    width,
    height: viewBox.height
  });
}

export function responsiveInstrumentCamera({
  center,
  outerRadius,
  viewportWidth,
  viewport = DEFAULT_VIEWPORT,
  topMargin = null
}) {
  const mode = cameraModeForWidth(viewportWidth);
  const zoom = CAMERA_ZOOM[mode];
  const resolvedTopMargin = topMargin ?? CAMERA_TOP_MARGIN_BY_MODE[mode];
  const baseViewBox = instrumentViewBox({ center, outerRadius, viewport, topMargin:resolvedTopMargin });
  const viewBox = horizontallyZoomedViewBox(baseViewBox, zoom);
  return Object.freeze({ mode, zoom, topMargin:resolvedTopMargin, viewBox });
}

export function viewBoxString(viewBox) {
  return `${viewBox.x.toFixed(3)} ${viewBox.y.toFixed(3)} ${viewBox.width.toFixed(3)} ${viewBox.height.toFixed(3)}`;
}
