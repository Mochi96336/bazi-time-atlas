import { sexagenaryReferenceByName } from "./ganzhi-inspector-model.js";

export const DEFAULT_LEGACY_SEXAGENARY_REFERENCE = "甲子";

export function resolveLegacySexagenaryReference(requestedGanZhi) {
  return sexagenaryReferenceByName(requestedGanZhi)
    ?? sexagenaryReferenceByName(DEFAULT_LEGACY_SEXAGENARY_REFERENCE);
}
