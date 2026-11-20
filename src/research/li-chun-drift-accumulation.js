// Repair D5: Li Chun drift against the same proleptic-Gregorian date at the
// four epochs this repository has source-backed crossings for. The drift uses
// the definition of the 26026 timeline: (target TT crossing − base TT
// crossing) − Gregorian day count between the same calendar dates. Negative =
// the 立春 instant arrives earlier than the Gregorian date suggests.
import { DE441_10026_SEASONAL_CROSSING_EVIDENCE } from "../astronomy/de441-10026-seasonal-crossing-evidence.js";
import {
  SEASONAL_DRIFT_26026_RESEARCH,
  indexForLongitude
} from "./seasonal-drift-26026-research-data.js";

const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
// TT − UTC in 2026 = 32.184 s + 37 leap seconds.
const TT_MINUS_UTC_2026_MS = 69_184;
const LI_CHUN_LONGITUDE = 315;

// 2026 立春 = 2026-02-04 04:02:08 UTC+08:00 (Tyme, the Atlas/Research base).
export const BASE_LI_CHUN_2026_TT_JD =
  UNIX_EPOCH_JD + (Date.UTC(2026, 1, 3, 20, 2, 8) + TT_MINUS_UTC_2026_MS) / DAY_MS;

// DE441 / NASA-JPL Horizons validated 立春 crossing for catalogue year 4006
// (src/recurrence/direct-seasonal-provider-validation-evidence.js).
export const LI_CHUN_4006_TT_JD = 3184255.837325938;

export function gregorianDaysBetweenLiChunDates(baseYear, targetYear) {
  return (Date.UTC(targetYear, 1, 4) - Date.UTC(baseYear, 1, 4)) / DAY_MS;
}

export function liChunDriftDays(targetTtJulianDay, targetYear, baseYear = 2026, baseTtJulianDay = BASE_LI_CHUN_2026_TT_JD) {
  return targetTtJulianDay - baseTtJulianDay - gregorianDaysBetweenLiChunDates(baseYear, targetYear);
}

export function liChunDriftAccumulation() {
  return Object.freeze([
    Object.freeze({ deltaYears:0, year:2026, driftDays:0, source:"基準年" }),
    Object.freeze({ deltaYears:1980, year:4006, driftDays:liChunDriftDays(LI_CHUN_4006_TT_JD, 4006), source:"DE441" }),
    Object.freeze({
      deltaYears:8000,
      year:10026,
      driftDays:liChunDriftDays(DE441_10026_SEASONAL_CROSSING_EVIDENCE.liChun.ttJulianDay, 10026),
      source:"DE441"
    }),
    Object.freeze({
      deltaYears:24000,
      year:26026,
      driftDays:SEASONAL_DRIFT_26026_RESEARCH.driftDays[indexForLongitude(LI_CHUN_LONGITUDE)],
      source:"N-body 研究模型"
    })
  ]);
}
