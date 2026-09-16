export const RING_VISIBILITY_EVENT = "atlas-ring-visibility-change";

export function ringIsVisible(svg, ringId) {
  const hidden = (svg?.dataset?.hiddenRings ?? "").split(",").filter(Boolean);
  return !hidden.includes(ringId);
}
