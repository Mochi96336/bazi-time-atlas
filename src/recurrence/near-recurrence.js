import { GLOBAL_GREGORIAN_YEAR_DAY_PERIOD } from "./gregorian-cycle.js";
import { BERGER_MODEL, solarTermShapeResiduals } from "./berger-orbit.js";

export const EXACT_DISCRETE_STEP_YEARS = GLOBAL_GREGORIAN_YEAR_DAY_PERIOD;

function assertBaseYear(baseYear) {
  if (!Number.isFinite(baseYear)) throw new RangeError("baseYear must be finite");
  const minYear = BERGER_MODEL.epochYear - BERGER_MODEL.validityYearsFromEpoch;
  const maxYear = BERGER_MODEL.epochYear + BERGER_MODEL.validityYearsFromEpoch;
  if (baseYear < minYear || baseYear > maxYear) {
    throw new RangeError("baseYear lies outside Berger model range");
  }
}

export function futureExactDiscreteAstronomyCandidates(baseYear) {
  assertBaseYear(baseYear);
  const maxTargetYear = BERGER_MODEL.epochYear + BERGER_MODEL.validityYearsFromEpoch;
  const maxMultiple = Math.floor((maxTargetYear - baseYear) / EXACT_DISCRETE_STEP_YEARS);
  const candidates = [];

  for (let multiple = 1; multiple <= maxMultiple; multiple += 1) {
    const deltaYears = multiple * EXACT_DISCRETE_STEP_YEARS;
    const targetYear = baseYear + deltaYears;
    const residual = solarTermShapeResiduals(baseYear, targetYear);
    candidates.push(Object.freeze({
      multiple,
      deltaYears,
      targetYear,
      maxAbsHours: residual.maxAbsHours,
      rmsHours: residual.rmsHours,
      minHours: residual.minHours,
      maxHours: residual.maxHours,
      eccentricity: residual.targetParameters.eccentricity,
      perihelionLongitudeDegrees: residual.targetParameters.perihelionLongitudeDegrees
    }));
  }

  return Object.freeze(candidates);
}

export function rankExactDiscreteAstronomyCandidates(baseYear) {
  const chronological = futureExactDiscreteAstronomyCandidates(baseYear);
  const ranked = [...chronological].sort((a, b) =>
    a.maxAbsHours - b.maxAbsHours ||
    a.rmsHours - b.rmsHours ||
    a.deltaYears - b.deltaYears
  );

  return Object.freeze({
    baseYear,
    stepYears: EXACT_DISCRETE_STEP_YEARS,
    model: BERGER_MODEL,
    candidateCount: chronological.length,
    chronological,
    ranked: Object.freeze(ranked),
    best: ranked[0] ?? null
  });
}
