export function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export function shortestAngleDelta(nextAngle, previousAngle) {
  let delta = normalizeDegrees(nextAngle) - normalizeDegrees(previousAngle);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export function clockwiseSpan(startDegrees, endDegrees) {
  let start = startDegrees;
  let end = endDegrees;
  while (end <= start) end += 360;
  return end - start;
}

export function pointAt(center, radius, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  };
}

export function angleAt(center, point) {
  return Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI;
}

export function annularSectorPath(center, innerRadius, outerRadius, startDegrees, endDegrees) {
  const span = clockwiseSpan(startDegrees, endDegrees);
  const end = startDegrees + span;
  const largeArc = span > 180 ? 1 : 0;
  const p1 = pointAt(center, outerRadius, startDegrees);
  const p2 = pointAt(center, outerRadius, end);
  const p3 = pointAt(center, innerRadius, end);
  const p4 = pointAt(center, innerRadius, startDegrees);
  return [
    `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
    `L ${p3.x.toFixed(3)} ${p3.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x.toFixed(3)} ${p4.y.toFixed(3)}`,
    "Z"
  ].join(" ");
}

export function arcPath(center, radius, startDegrees, endDegrees) {
  const span = clockwiseSpan(startDegrees, endDegrees);
  const end = startDegrees + span;
  const p1 = pointAt(center, radius, startDegrees);
  const p2 = pointAt(center, radius, end);
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`;
}

export function fanSectorPath(center, radius, startDegrees, endDegrees) {
  const span = clockwiseSpan(startDegrees, endDegrees);
  const end = startDegrees + span;
  const p1 = pointAt(center, radius, startDegrees);
  const p2 = pointAt(center, radius, end);
  return [
    `M ${center.x.toFixed(3)} ${center.y.toFixed(3)}`,
    `L ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`,
    `A ${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${span > 180 ? 1 : 0} 1 ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`,
    "Z"
  ].join(" ");
}

export function rotationTransform(angleDegrees, center) {
  return `rotate(${angleDegrees.toFixed(4)} ${center.x} ${center.y})`;
}
