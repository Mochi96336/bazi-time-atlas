// Rotating SVG <text> is the dominant per-frame cost of a wheel drag on phones:
// a ring pose change makes Blink re-record and re-rasterise every glyph run in
// the rotated group, although the close mobile camera shows only a few labels
// per ring. Labels whose rotated anchor lies outside the camera (plus a margin
// wider than any glyph run) are marked data-offscreen, which CSS maps to
// display:none. This is presentation only: the nodes, their data attributes
// and the separate `visibility` read-head shadowing are untouched.

export const OFFSCREEN_ATTRIBUTE = "data-offscreen";

export function createLabelCuller({ svg, center, marginRatio = .15, minMargin = 80 }) {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    throw new TypeError("center must contain finite x/y coordinates");
  }
  const tracks = new Map();

  function register(ringId, node, x, y) {
    if (!node || !Number.isFinite(x) || !Number.isFinite(y)) return;
    let labels = tracks.get(ringId);
    if (!labels) tracks.set(ringId, labels = []);
    labels.push({ node, dx:x - center.x, dy:y - center.y, offscreen:false });
  }

  // `renderedRotations` maps ring id → the same degrees written to that ring's
  // `rotate(deg cx cy)` transform, so the anchor follows SVG's rotation matrix.
  function update(renderedRotations, viewBox = svg?.viewBox?.baseVal) {
    if (!viewBox || !(viewBox.width > 0) || !(viewBox.height > 0)) return 0;
    const margin = Math.max(minMargin, Math.max(viewBox.width, viewBox.height) * marginRatio);
    const left = viewBox.x - margin;
    const right = viewBox.x + viewBox.width + margin;
    const top = viewBox.y - margin;
    const bottom = viewBox.y + viewBox.height + margin;
    let hidden = 0;

    for (const [ringId, labels] of tracks) {
      const degrees = renderedRotations?.get(ringId);
      if (!Number.isFinite(degrees)) continue;
      const radians = degrees * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      for (const label of labels) {
        const x = center.x + label.dx * cos - label.dy * sin;
        const y = center.y + label.dx * sin + label.dy * cos;
        const offscreen = x < left || x > right || y < top || y > bottom;
        if (offscreen) hidden += 1;
        if (offscreen === label.offscreen) continue;
        label.offscreen = offscreen;
        if (offscreen) label.node.setAttribute(OFFSCREEN_ATTRIBUTE, "");
        else label.node.removeAttribute(OFFSCREEN_ATTRIBUTE);
      }
    }
    return hidden;
  }

  return Object.freeze({ register, update });
}
