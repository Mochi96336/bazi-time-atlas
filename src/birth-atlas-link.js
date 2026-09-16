import { selectedInstantUrl } from "./interaction/selected-instant-url.js";
import {
  atlasInputValueFromFields,
  instantFromAtlasLocalInput
} from "./wheel/atlas-display-model.js";
import { normalizeAtlasTimeContext } from "./wheel/atlas-time-context.js";

const INSPECTABLE_PILLARS = new Set(["year", "month", "day", "hour"]);

function atlasRootFromBirthHref(birthHref) {
  try {
    return new URL("./", birthHref).href;
  } catch {
    return null;
  }
}

export function birthAtlasLink({
  birthHref,
  input,
  utcOffsetHours,
  dayBoundary,
  inspect = null
}) {
  const atlasRoot = atlasRootFromBirthHref(birthHref);
  if (!atlasRoot) return null;
  if (inspect !== null && !INSPECTABLE_PILLARS.has(inspect)) {
    throw new RangeError(`unsupported Atlas pillar inspector: ${inspect}`);
  }

  const timeContext = normalizeAtlasTimeContext({ utcOffsetHours, dayBoundary });
  const localValue = atlasInputValueFromFields(input);
  const instantMs = instantFromAtlasLocalInput(localValue, timeContext);
  const target = selectedInstantUrl(atlasRoot, instantMs, timeContext);
  if (!target) return null;

  const url = new URL(target);
  if (inspect === null) url.searchParams.delete("inspect");
  else url.searchParams.set("inspect", inspect);
  return url.href;
}
