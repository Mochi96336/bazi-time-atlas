import {
  DATE_ONLY_TARGET_INSTANT,
  TARGET_INSTANT_BASIS,
  targetInstantBinding
} from "./target-instant-binding.js";

function assertDataset(dataset) {
  if (!dataset || typeof dataset !== "object") {
    throw new TypeError("dataset must be an object");
  }
}

export function publishSelectedTargetInstant(dataset, targetInstant = null) {
  assertDataset(dataset);
  const binding = targetInstantBinding(targetInstant);
  dataset.selectedTargetInstantBasis = binding.basis;
  dataset.selectedTargetInstantBound = String(binding.bound);

  if (binding.bound) {
    dataset.selectedTargetInstantJulianDay = String(binding.julianDay);
  } else {
    delete dataset.selectedTargetInstantJulianDay;
  }

  if (binding.localOffsetHoursFromUt1 === null) {
    delete dataset.selectedTargetInstantLocalOffsetHoursFromUt1;
  } else {
    dataset.selectedTargetInstantLocalOffsetHoursFromUt1 = String(binding.localOffsetHoursFromUt1);
  }

  return binding;
}

export function readSelectedTargetInstant(dataset) {
  assertDataset(dataset);
  const basis = dataset.selectedTargetInstantBasis;
  const bound = dataset.selectedTargetInstantBound === "true";

  if (!basis || !bound || basis === TARGET_INSTANT_BASIS.DATE_ONLY) {
    return DATE_ONLY_TARGET_INSTANT;
  }

  const julianDay = Number(dataset.selectedTargetInstantJulianDay);
  const spec = { basis, julianDay };
  if (basis === TARGET_INSTANT_BASIS.FIXED_ZONE_FROM_UT1) {
    spec.localOffsetHoursFromUt1 = Number(dataset.selectedTargetInstantLocalOffsetHoursFromUt1);
  }
  return targetInstantBinding(spec);
}

export const SELECTED_TARGET_INSTANT_INSTRUMENT_CONTRACT = Object.freeze({
  id:"recurrence-selected-target-instant-instrument-v1",
  owner:"day-hour-proof-chain",
  consumer:"research-year-strip",
  datasetFields:Object.freeze([
    "selectedTargetInstantBasis",
    "selectedTargetInstantBound",
    "selectedTargetInstantJulianDay",
    "selectedTargetInstantLocalOffsetHoursFromUt1"
  ]),
  dateOnlyFailsClosed:true
});
