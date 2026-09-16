import { JulianDay } from "../../vendor/tyme4ts-1.5.2.mjs";
import { equationOfTime } from "../astronomy/equation-of-time.js";
import { fixedZoneTargetClock } from "./fixed-zone-target-clock.js";
import { geographicLongitudeBinding } from "./geographic-longitude-binding.js";

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_LONGITUDE_DEGREE = 4;
const SECONDS_PER_DAY = 86400;
const TIMELINE_ALIGNMENT_TOLERANCE_SECONDS = 0.01;

function solarTimeFields(time) {
  return Object.freeze({
    year:time.getYear(),
    month:time.getMonth(),
    day:time.getDay(),
    hour:time.getHour(),
    minute:time.getMinute(),
    second:time.getSecond()
  });
}

function clockAtJulianDay(julianDay) {
  return solarTimeFields(JulianDay.fromJulianDay(julianDay).getSolarTime());
}

/**
 * Project an explicit proleptic-Gregorian fixed-zone-from-UT1 local clock to
 * local mean and local apparent solar point estimates.
 *
 * This is recurrence-specific plumbing. It deliberately does not call the
 * Birth/civil-time `localApparentSolarTime()` adapter because that adapter's
 * offset is a resolved UTC/civil offset, while this input is explicitly a
 * fixed offset from UT1 with no future UTC/DST/political-timezone claim.
 *
 * The production EoT engine currently accepts an offset-labelled local clock
 * and exposes its reconstructed timeline as `utcJulianDay`. Here that field is
 * used only as a numerical timeline coordinate. We require it to agree with
 * the independently typed `fixedZoneTargetClock()` UT1 Julian day before any
 * solar projection is returned; otherwise the adapter fails closed.
 */
export function fixedZoneUt1ApparentSolarPointEstimate(
  localClock,
  longitudeDegrees,
  localOffsetHoursFromUt1,
  { deltaTSeconds } = {}
) {
  const target = fixedZoneTargetClock(localClock, localOffsetHoursFromUt1);
  const longitude = geographicLongitudeBinding(longitudeDegrees);
  if (!longitude.bound) {
    throw new RangeError("longitudeDegrees must be a bound geographic longitude");
  }

  const equation = equationOfTime(
    target.localClock,
    localOffsetHoursFromUt1,
    { deltaTSeconds }
  );
  const equationTimelineJulianDay = equation.utcJulianDay;
  const timelineAlignmentSeconds = Math.abs(
    equationTimelineJulianDay - target.ut1JulianDay
  ) * SECONDS_PER_DAY;
  if (timelineAlignmentSeconds > TIMELINE_ALIGNMENT_TOLERANCE_SECONDS) {
    throw new RangeError(
      `Equation-of-Time timeline does not align with typed UT1 target: ${timelineAlignmentSeconds} s`
    );
  }

  const longitudeCorrectionMinutes = longitude.longitudeDegrees
    * MINUTES_PER_LONGITUDE_DEGREE
    - localOffsetHoursFromUt1 * 60;
  const meanSolarJulianDay = target.ut1JulianDay + longitude.longitudeDegrees / 360;
  const apparentSolarJulianDay = meanSolarJulianDay + equation.minutes / MINUTES_PER_DAY;

  return Object.freeze({
    method:"fixed-zone-from-ut1-local-apparent-solar-point-estimate",
    inputClockSemantics:"proleptic-gregorian-fixed-zone-from-ut1",
    localClock:target.localClock,
    targetInstant:target.targetInstant,
    localOffsetHoursFromUt1,
    longitudeDegrees:longitude.longitudeDegrees,
    localJulianDay:target.localJulianDay,
    ut1JulianDay:target.ut1JulianDay,
    equationTimelineJulianDay,
    timelineAlignmentSeconds,
    timelineAlignmentToleranceSeconds:TIMELINE_ALIGNMENT_TOLERANCE_SECONDS,
    meanSolarJulianDay,
    apparentSolarJulianDay,
    meanSolarClock:clockAtJulianDay(meanSolarJulianDay),
    apparentSolarClock:clockAtJulianDay(apparentSolarJulianDay),
    longitudeCorrectionMinutes,
    equationOfTimeMinutes:equation.minutes,
    totalCorrectionMinutes:longitudeCorrectionMinutes + equation.minutes,
    equationOfTimeMethod:equation.method,
    equation:Object.freeze({ ...equation }),
    prolepticGregorian:true,
    futureUtcPolicyResolved:false,
    civilTimezonePolicyResolved:false,
    deterministicMembership:false,
    recurrenceAuthorityGranted:false
  });
}

export const FIXED_ZONE_UT1_APPARENT_SOLAR_CONTRACT = Object.freeze({
  id:"recurrence-fixed-zone-ut1-apparent-solar-point-estimate-v1",
  inputClockSemantics:"proleptic-gregorian-fixed-zone-from-ut1",
  inputTimeScale:"UT1",
  longitudeSignConvention:"east-positive-degrees",
  meanSolarProjection:"UT1+longitude/360",
  apparentSolarProjection:"local-mean-solar+equation-of-time",
  equationTimelineMustMatchTypedUt1:true,
  equationTimelineAlignmentToleranceSeconds:TIMELINE_ALIGNMENT_TOLERANCE_SECONDS,
  equationEngineUtcFieldUsedAsNumericalCoordinateOnly:true,
  futureUtcPolicyResolved:false,
  civilTimezonePolicyResolved:false,
  grantsDeterministicMembership:false,
  grantsRecurrenceAuthority:false
});
