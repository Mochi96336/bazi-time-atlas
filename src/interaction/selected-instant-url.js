const LEGACY_PROJECTION_KEYS = Object.freeze(["lambda", "month", "yearStem"]);

function mutableUrl(currentHref) {
  try {
    return new URL(currentHref);
  } catch {
    return null;
  }
}

export function selectedInstantUrl(currentHref, instantMs) {
  if (!Number.isFinite(instantMs)) return null;
  const url = mutableUrl(currentHref);
  if (!url) return null;
  url.searchParams.set("instant", new Date(instantMs).toISOString());
  for (const key of LEGACY_PROJECTION_KEYS) url.searchParams.delete(key);
  return url.href;
}

export function clearLegacyProjectionUrl(currentHref) {
  const url = mutableUrl(currentHref);
  if (!url) return null;
  for (const key of LEGACY_PROJECTION_KEYS) url.searchParams.delete(key);
  return url.href;
}
