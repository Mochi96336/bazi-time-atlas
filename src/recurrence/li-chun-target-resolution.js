import { JulianDay, ShouXingUtil } from "../../vendor/tyme4ts-1.5.2.mjs";
import {
  TYME_SHOUXING_DIRECT_PROVIDER,
  solveSolarLongitude
} from "../astronomy/direct-seasonal-event-provider.js";
import { targetInstantBinding } from "./target-instant-binding.js";

const LI_CHUN_LONGITUDE_DEGREES = 315;
const SECONDS_PER_DAY = 86_400;

function result(fields) {
  return Object.freeze(fields);
}

function targetTtJulianDay(binding) {
  if (binding.inputTimeScale === "TT") return binding.julianDay;
  if (binding.inputTimeScale !== "UT1") return null;
  const ut1DaysFromJ2000 = binding.julianDay - JulianDay.J2000;
  return binding.julianDay + ShouXingUtil.dtT(ut1DaysFromJ2000);
}

export function resolveLiChunYearSideFromTargetInstant({ year, targetInstant = null }) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");

  const binding = targetInstantBinding(targetInstant);
  if (!binding.bound) {
    return result({
      status:"target-instant-unbound",
      side:null,
      targetBasis:binding.basis,
      targetTtJulianDay:null,
      liChunTtJulianDay:null,
      deltaSeconds:null
    });
  }

  const { minYear, maxYear } = TYME_SHOUXING_DIRECT_PROVIDER.coverage;
  if (year < minYear || year > maxYear) {
    return result({
      status:"outside-validated-coverage",
      side:null,
      targetBasis:binding.basis,
      targetTtJulianDay:null,
      liChunTtJulianDay:null,
      deltaSeconds:null,
      minYear,
      maxYear
    });
  }

  const targetTt = targetTtJulianDay(binding);
  if (!Number.isFinite(targetTt)) {
    return result({
      status:"unsupported-target-time-scale",
      side:null,
      targetBasis:binding.basis,
      targetTtJulianDay:null,
      liChunTtJulianDay:null,
      deltaSeconds:null
    });
  }

  const liChun = solveSolarLongitude({
    year,
    longitudeDegrees:LI_CHUN_LONGITUDE_DEGREES
  });
  const deltaSeconds = (targetTt - liChun.ttJulianDay) * SECONDS_PER_DAY;

  return result({
    status:"resolved",
    side:deltaSeconds < 0 ? "before" : "after",
    targetBasis:binding.basis,
    targetTtJulianDay:targetTt,
    liChunTtJulianDay:liChun.ttJulianDay,
    deltaSeconds,
    providerId:liChun.providerId,
    bridgeModel:"tyme4ts-1.5.2-shouxing-delta-t"
  });
}

export const LI_CHUN_TARGET_RESOLUTION_CONTRACT = Object.freeze({
  id:"research-li-chun-target-resolution-v1",
  seasonalProviderId:TYME_SHOUXING_DIRECT_PROVIDER.id,
  seasonalTimeScale:"TT",
  targetTimeScales:Object.freeze(["TT", "UT1"]),
  liChunLongitudeDegrees:LI_CHUN_LONGITUDE_DEGREES,
  validatedCoverage:TYME_SHOUXING_DIRECT_PROVIDER.coverage,
  ut1ToTtBridge:"tyme4ts-1.5.2-shouxing-delta-t",
  outsideCoverageFailsClosed:true
});
