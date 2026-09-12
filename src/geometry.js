export function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

export function clockwiseSpan(start, end) {
  const s = normalizeAngle(start);
  const e = normalizeAngle(end);
  const span = (e - s + 360) % 360;
  return span === 0 ? 360 : span;
}

export function midpointAngle(start, end) {
  return normalizeAngle(normalizeAngle(start) + clockwiseSpan(start, end) / 2);
}

export function containsAngle(start, end, angle) {
  const s = normalizeAngle(start);
  const a = normalizeAngle(angle);
  return ((a - s + 360) % 360) < clockwiseSpan(start, end);
}

export function polar(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export function annularSectorPath(cx, cy, innerRadius, outerRadius, start, end) {
  const span = clockwiseSpan(start, end);
  const actualEnd = normalizeAngle(start) + span;
  const p1 = polar(cx, cy, outerRadius, start);
  const p2 = polar(cx, cy, outerRadius, actualEnd);
  const p3 = polar(cx, cy, innerRadius, actualEnd);
  const p4 = polar(cx, cy, innerRadius, start);
  const largeArc = span > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
}
