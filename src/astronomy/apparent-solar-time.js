import { JulianDay, SolarTime } from "../../vendor/tyme4ts-1.5.2.mjs";
import { equationOfTime } from "./equation-of-time.js";
import { localMeanSolarTime } from "./mean-solar-time.js";

function solarTimeFields(time) {
  return {
    year: time.getYear(),
    month: time.getMonth(),
    day: time.getDay(),
    hour: time.getHour(),
    minute: time.getMinute(),
    second: time.getSecond()
  };
}

/**
 * Compose local apparent solar time (LAST) from the two independently-tested
 * layers already used by the atlas:
 *
 * civil clock -> local mean solar time  : longitude / UTC-offset correction
 * local mean  -> local apparent solar   : Equation of Time
 *
 * Equation-of-Time sign convention is apparent minus mean, so it is added.
 * This function is astronomical plumbing only; choosing LAST as a BaZi
 * Four-Pillar convention remains a separate explicit UI/policy decision.
 */
export function localApparentSolarTime(
  input,
  longitudeDegrees,
  utcOffsetHours,
  { deltaTSeconds } = {}
) {
  const mean = localMeanSolarTime(input, longitudeDegrees, utcOffsetHours);
  const equation = equationOfTime(input, utcOffsetHours, { deltaTSeconds });

  const local = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute ?? 0,
    input.second ?? 0
  );
  const civilJulianDay = local.getJulianDay().getDay();
  const totalCorrectionMinutes = mean.correctionMinutes + equation.minutes;
  const apparentJulianDay = civilJulianDay + totalCorrectionMinutes / 1440;
  const apparent = JulianDay.fromJulianDay(apparentJulianDay).getSolarTime();

  return {
    civil: mean.civil,
    meanSolar: mean.meanSolar,
    apparentSolar: solarTimeFields(apparent),
    longitudeDegrees,
    utcOffsetHours,
    longitudeCorrectionMinutes: mean.correctionMinutes,
    equationOfTimeMinutes: equation.minutes,
    totalCorrectionMinutes,
    method: "local-apparent-solar-time",
    equation
  };
}
