import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  writeAtlasTimeContextSearch
} from "../wheel/atlas-time-context.js";

const LEGACY_PROJECTION_KEYS = Object.freeze(["lambda", "month", "yearStem"]);

function mutableUrl(currentHref) {
  try {
    return new URL(currentHref);
  } catch {
    return null;
  }
}

export function selectedInstantUrl(
  currentHref,
  instantMs,
  timeContext = DEFAULT_ATLAS_TIME_CONTEXT
) {
  if (!Number.isFinite(instantMs)) return null;
  const instant = new Date(instantMs);
  if (!Number.isFinite(instant.getTime())) return null;
  const url = mutableUrl(currentHref);
  if (!url) return null;

  try {
    url.searchParams.set("instant", instant.toISOString());
    for (const key of LEGACY_PROJECTION_KEYS) url.searchParams.delete(key);
    writeAtlasTimeContextSearch(url.searchParams, timeContext);
  } catch {
    return null;
  }
  return url.href;
}

export function clearLegacyProjectionUrl(currentHref) {
  const url = mutableUrl(currentHref);
  if (!url) return null;
  for (const key of LEGACY_PROJECTION_KEYS) url.searchParams.delete(key);
  return url.href;
}
