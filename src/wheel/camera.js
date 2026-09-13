export const DEFAULT_VIEWPORT = Object.freeze({
  x: 0,
  y: 0,
  width: 1200,
  height: 760
});

export const CAMERA_TOP_MARGIN = 120;

export function instrumentViewBox({ center, outerRadius, viewport = DEFAULT_VIEWPORT, topMargin = CAMERA_TOP_MARGIN }) {
  return Object.freeze({
    x: viewport.x,
    y: center.y - outerRadius - topMargin,
    width: viewport.width,
    height: viewport.height
  });
}

export function viewBoxString(viewBox) {
  return `${viewBox.x.toFixed(3)} ${viewBox.y.toFixed(3)} ${viewBox.width.toFixed(3)} ${viewBox.height.toFixed(3)}`;
}
