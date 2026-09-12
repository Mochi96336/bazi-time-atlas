import { localApparentSolarTime } from "../astronomy/apparent-solar-time.js";
import {
  DAY_BOUNDARY,
  resolveBirthPillars,
  resolveDayHourPillars
} from "./tyme-adapter.js";

export const DAY_HOUR_TIME_BASIS = Object.freeze({
  CIVIL: "civil",
  LOCAL_MEAN_SOLAR: "local-mean-solar",
  LOCAL_APPARENT_SOLAR: "local-apparent-solar"
});

function samePillar(a, b) {
  return a.name === b.name;
}

function row(id, label, clock, resolved, civil) {
  const dayChanged = !samePillar(resolved.pillars.day, civil.pillars.day);
  const hourChanged = !samePillar(resolved.pillars.hour, civil.pillars.hour);
  return {
    id,
    label,
    clock: { ...clock },
    day: { ...resolved.pillars.day },
    hour: { ...resolved.pillars.hour },
    changedFromCivil: {
      day: dayChanged,
      hour: hourChanged,
      any: dayChanged || hourChanged
    }
  };
}

/**
 * Compare Day + Hour pillar results under three clock-basis hypotheses while
 * keeping Year + Month anchored to the original physical birth instant.
 *
 * This function does NOT choose a BaZi school or convention. It is a
 * sensitivity tool: all three clock readings are fed through the exact same
 * selected day-boundary and Five-Rats rules so the only changed variable is
 * which local clock supplies Day/Hour boundary membership.
 */
export function compareDayHourTimeBases(input, options) {
  const {
    longitudeDegrees,
    utcOffsetHours,
    dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
  } = options ?? {};

  const birth = resolveBirthPillars(input, { dayBoundary, utcOffsetHours });
  const solar = localApparentSolarTime(input, longitudeDegrees, utcOffsetHours);

  const civil = resolveDayHourPillars(input, {
    dayBoundary,
    timeBasis: DAY_HOUR_TIME_BASIS.CIVIL
  });
  const mean = resolveDayHourPillars(solar.meanSolar, {
    dayBoundary,
    timeBasis: DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR
  });
  const apparent = resolveDayHourPillars(solar.apparentSolar, {
    dayBoundary,
    timeBasis: DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR
  });

  const rows = [
    row(DAY_HOUR_TIME_BASIS.CIVIL, "民用時間", civil.input, civil, civil),
    row(DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR, "平太陽時", mean.input, mean, civil),
    row(DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR, "視太陽時", apparent.input, apparent, civil)
  ];

  return {
    fixedPillars: {
      year: { ...birth.pillars.year },
      month: { ...birth.pillars.month }
    },
    dayBoundary,
    longitudeDegrees,
    utcOffsetHours,
    corrections: {
      longitudeMinutes: solar.longitudeCorrectionMinutes,
      equationOfTimeMinutes: solar.equationOfTimeMinutes,
      totalMinutes: solar.totalCorrectionMinutes
    },
    rows,
    anyDayChange: rows.some(item => item.changedFromCivil.day),
    anyHourChange: rows.some(item => item.changedFromCivil.hour),
    anyChange: rows.some(item => item.changedFromCivil.any),
    method: "day-hour-time-basis-sensitivity"
  };
}
