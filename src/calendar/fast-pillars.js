// Frame-rate four-pillar estimate for continuous wheel drags.
//
// Tyme (tyme-adapter.js) stays the calendar authority: the atlas resolves
// every settled instant through it and re-resolves the final instant of a
// drag. During the drag itself this module answers in O(1) without lunar or
// solar-term series:
//   - Day/Hour are exact arithmetic: the day pillar is a continuous 60-day
//     cycle over the Julian Day Number (on Tyme's calendar: Julian before
//     1582-10-15, Gregorian after), the hour pillar is 五鼠遁 from the
//     effective day stem. tests/fast-pillars.test.js holds them equal to Tyme.
//   - Year/Month come from the apparent solar longitude the atlas already
//     computes per frame (Jie every 30° from 立春 at 315°). Near a Jie this
//     can differ from Tyme's exact boundary second; the settle pass corrects it.
import { DAY_BOUNDARY } from "./day-boundary.js";
import { monthStemForYearStem } from "./five-tigers.js";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function pillar(stemIndex, branchIndex) {
  const stem = STEMS[((stemIndex % 10) + 10) % 10];
  const branch = BRANCHES[((branchIndex % 12) + 12) % 12];
  return { name: `${stem}${branch}`, stem, branch };
}

function sexagenaryPillar(index) {
  const i = ((index % 60) + 60) % 60;
  return pillar(i % 10, i % 12);
}

// Julian Day Number at civil noon of a Tyme calendar date.
export function julianDayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const gregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  const base = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4);
  return gregorian
    ? base - Math.floor(y / 100) + Math.floor(y / 400) - 32045
    : base - 32083;
}

// 1949-10-01 (JDN 2433191) is a 甲子 day.
function dayCycleIndex(year, month, day) {
  return julianDayNumber(year, month, day) + 49;
}

export function fastDayHourPillars(fields, dayBoundary = DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY) {
  const lateZi = fields.hour === 23;
  const nextDay = lateZi && dayBoundary === DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY ? 1 : 0;
  const dayIndex = dayCycleIndex(fields.year, fields.month, fields.day) + nextDay;
  const day = sexagenaryPillar(dayIndex);
  // 五鼠遁 from the effective day stem: the Zi-hour stem is (dayStem % 5) * 2.
  // Under civil midnight 23:00 keeps the civil day, and so its stem (the
  // adapter's hourPillarFromDayStem rule).
  const branchIndex = lateZi ? 0 : Math.floor((fields.hour + 1) / 2);
  const ziStem = (((dayIndex % 10) + 10) % 10 % 5) * 2;
  const hour = pillar(ziStem + branchIndex, branchIndex);
  return { day, hour };
}

// `referenceFields` is the UTC+8 clock Tyme uses for solar terms.
export function fastYearMonthPillars(referenceFields, apparentLongitudeDegrees) {
  const longitude = ((apparentLongitudeDegrees % 360) + 360) % 360;
  // Before 立春 (315°) in January/February the BaZi year is still the old one.
  const beforeLiChun = referenceFields.month <= 2 && longitude >= 180 && longitude < 315;
  const baziYear = referenceFields.year - (beforeLiChun ? 1 : 0);
  const year = sexagenaryPillar(baziYear - 4);
  const jieIndex = Math.floor((((longitude - 315) % 360) + 360) % 360 / 30);
  const branch = BRANCHES[(2 + jieIndex) % 12];
  const stem = monthStemForYearStem(year.stem, branch);
  return { year, month: { name: `${stem}${branch}`, stem, branch } };
}
