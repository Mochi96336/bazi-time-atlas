export const SELECTED_INSTANT_COMMAND = "atlas:set-selected-instant";

export function selectedInstantFromCommandDetail(detail) {
  const instantMs = detail?.instantMs;
  return typeof instantMs === "number" && Number.isFinite(instantMs) ? instantMs : null;
}
