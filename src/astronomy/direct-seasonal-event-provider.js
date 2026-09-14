import { JulianDay, ShouXingUtil, SolarTime } from "../../vendor/tyme4ts-1.5.2.mjs";
import {
  SEASONAL_EPOCH_PROVIDER_ROLES,
  defineSeasonalEpochProvider
} from "../recurrence/seasonal-epoch-provider.js";

const TWO_PI = Math.PI * 2;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const TROPICAL_YEAR_DAYS = 365.2422;

export const TYME_SHOUXING_DIRECT_PROVIDER = defineSeasonalEpochProvider({
  id:"tyme4ts-1.5.2-shouxing-direct",
  role:SEASONAL_EPOCH_PROVIDER_ROLES.DIRECT_EVENT,
  label:"Tyme 1.5.2 · ShouXing direct seasonal event",
  authority:"vendored tyme4ts 1.5.2 / ShouXing astronomical calendar core",
  sourceUrl:"https://github.com/6tail/tyme4ts",
  modelFamily:"shouxing",
  coverage:{ mode:"absolute-year", minYear:1900, maxYear:2100 },
  capabilities:{
    relativeSeasonGeometry:true,
    absoluteStateVector:false,
    continuousDynamicalTime:true,
    directSeasonalEpoch:true
  },
  implementation:"bundled-direct-event-proof",
  timeScale:"TT",
  note:"Proof-of-pipeline provider. It directly inverts the pinned ShouXing apparent solar-longitude model onto TT inside a deliberately conservative 1900–2100 validation window. It is not DE441, does not expose Earth/Sun state vectors, and does not by itself supply TT↔UT, civil-time or Day/Hour proof."
});

function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function shortestAngularError(actualDegrees, expectedDegrees) {
  const delta = normalizeDegrees(actualDegrees - expectedDegrees);
  return Math.min(delta, 360 - delta);
}

function validateRequest(year, longitudeDegrees) {
  if (!Number.isInteger(year)) throw new RangeError("year must be an integer");
  const { minYear, maxYear } = TYME_SHOUXING_DIRECT_PROVIDER.coverage;
  if (year < minYear || year > maxYear) {
    throw new RangeError(`year must be within validated direct-provider coverage ${minYear}..${maxYear}`);
  }
  assertFinite("longitudeDegrees", longitudeDegrees);
}

function roughCrossingJulianDay(year, longitudeDegrees) {
  const marchEquinoxGuess = SolarTime.fromYmdHms(year, 3, 20, 12, 0, 0)
    .getJulianDay()
    .getDay();
  let tropicalYearFraction = normalizeDegrees(longitudeDegrees) / 360;

  // Match the pinned Tyme SolarTerm year catalogue: its cycle starts at the
  // previous December's 270° winter solstice, then 285°..345° fall in
  // January..March of `year`. This is a catalogue-year selector only; the
  // returned physical epoch remains TT and carries no civil-time semantics.
  if (normalizeDegrees(longitudeDegrees) >= 270) tropicalYearFraction -= 1;
  return marchEquinoxGuess + tropicalYearFraction * TROPICAL_YEAR_DAYS;
}

/**
 * Solve one apparent geocentric solar-longitude crossing directly on TT.
 *
 * `year` follows the pinned Tyme SolarTerm catalogue convention used elsewhere
 * in the app: 270° is the previous December's winter solstice, while
 * 285°..345° are January..March of `year`. The returned epoch stays on TT; no
 * UTC, timezone, day-boundary or BaZi Day/Hour claim is made here.
 */
export function solveSolarLongitude({ year, longitudeDegrees }) {
  validateRequest(year, longitudeDegrees);
  const targetLongitudeDegrees = normalizeDegrees(longitudeDegrees);
  const targetBaseRadians = targetLongitudeDegrees * DEG_TO_RAD;
  const roughJulianDay = roughCrossingJulianDay(year, targetLongitudeDegrees);
  const roughTtCenturies = (roughJulianDay - JulianDay.J2000) / 36525;
  const roughUnwrappedLongitude = ShouXingUtil.saLon(roughTtCenturies, -1);
  const turns = Math.round((roughUnwrappedLongitude - targetBaseRadians) / TWO_PI);
  const targetUnwrappedRadians = targetBaseRadians + turns * TWO_PI;
  const ttCenturiesFromJ2000 = ShouXingUtil.saLonT(targetUnwrappedRadians);
  const ttDaysFromJ2000 = ttCenturiesFromJ2000 * 36525;
  const ttJulianDay = JulianDay.J2000 + ttDaysFromJ2000;
  const solvedLongitudeDegrees = normalizeDegrees(
    ShouXingUtil.saLon(ttCenturiesFromJ2000, -1) * RAD_TO_DEG
  );

  return Object.freeze({
    providerId:TYME_SHOUXING_DIRECT_PROVIDER.id,
    providerRole:TYME_SHOUXING_DIRECT_PROVIDER.role,
    timeScale:"TT",
    yearBasis:"tyme-solar-term-catalogue",
    year,
    targetLongitudeDegrees,
    targetUnwrappedRadians,
    ttCenturiesFromJ2000,
    ttDaysFromJ2000,
    ttJulianDay,
    solvedLongitudeDegrees,
    residualDegrees:shortestAngularError(solvedLongitudeDegrees, targetLongitudeDegrees)
  });
}
