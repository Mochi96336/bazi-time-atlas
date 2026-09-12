const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const MONTH_BRANCHES = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];

function stemIndex(name) {
  const index = STEMS.indexOf(name);
  if (index < 0) throw new RangeError(`unknown heavenly stem: ${name}`);
  return index;
}

function monthBranchIndex(name) {
  const index = MONTH_BRANCHES.indexOf(name);
  if (index < 0) throw new RangeError(`unknown BaZi month branch: ${name}`);
  return index;
}

/**
 * 五虎遁 / 年上起月.
 *
 * The year stem determines the stem used at 寅 month:
 * 甲己→丙, 乙庚→戊, 丙辛→庚, 丁壬→壬, 戊癸→甲.
 * Each following month advances one heavenly stem together with the month branch.
 */
export function yinMonthStemForYearStem(yearStem) {
  const yearIndex = stemIndex(yearStem);
  return STEMS[((yearIndex % 5) * 2 + 2) % 10];
}

export function monthStemForYearStem(yearStem, monthBranch) {
  const startIndex = stemIndex(yinMonthStemForYearStem(yearStem));
  const offset = monthBranchIndex(monthBranch);
  return STEMS[(startIndex + offset) % 10];
}

export function monthPillarForYearStem(yearStem, monthBranch) {
  return `${monthStemForYearStem(yearStem, monthBranch)}${monthBranch}`;
}

export function monthStemSequenceForYearStem(yearStem) {
  return MONTH_BRANCHES.map(branch => ({
    branch,
    stem: monthStemForYearStem(yearStem, branch),
    pillar: monthPillarForYearStem(yearStem, branch)
  }));
}

export const FIVE_TIGERS_MONTH_BRANCHES = Object.freeze([...MONTH_BRANCHES]);
export const FIVE_TIGERS_STEMS = Object.freeze([...STEMS]);
