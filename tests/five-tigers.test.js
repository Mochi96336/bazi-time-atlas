import test from "node:test";
import assert from "node:assert/strict";
import {
  FIVE_TIGERS_MONTH_BRANCHES,
  FIVE_TIGERS_STEMS,
  monthPillarForYearStem,
  monthStemSequenceForYearStem,
  yinMonthStemForYearStem
} from "../src/calendar/five-tigers.js";

const yinStarts = new Map([
  ["甲", "丙"], ["己", "丙"],
  ["乙", "戊"], ["庚", "戊"],
  ["丙", "庚"], ["辛", "庚"],
  ["丁", "壬"], ["壬", "壬"],
  ["戊", "甲"], ["癸", "甲"]
]);

test("Five Tigers maps all ten year stems to the canonical Yin-month starts", () => {
  for (const [yearStem, expectedStart] of yinStarts) {
    assert.equal(yinMonthStemForYearStem(yearStem), expectedStart);
  }
});

test("month stems advance one stem per branch from Yin through Chou", () => {
  const sequence = monthStemSequenceForYearStem("乙");
  assert.deepEqual(
    sequence.map(item => item.pillar),
    ["戊寅", "己卯", "庚辰", "辛巳", "壬午", "癸未", "甲申", "乙酉", "丙戌", "丁亥", "戊子", "己丑"]
  );
});

test("generated month pillars preserve stem/branch yin-yang parity", () => {
  for (const yearStem of FIVE_TIGERS_STEMS) {
    const sequence = monthStemSequenceForYearStem(yearStem);
    assert.equal(sequence.length, 12);
    sequence.forEach((item, index) => {
      const stemIndex = FIVE_TIGERS_STEMS.indexOf(item.stem);
      const branchIndex = FIVE_TIGERS_MONTH_BRANCHES.indexOf(item.branch);
      assert.equal(stemIndex % 2, branchIndex % 2);
    });
  }
});

test("Birth sample year stem Yi reproduces Wu-Zi month pillar", () => {
  assert.equal(monthPillarForYearStem("乙", "子"), "戊子");
});

test("invalid stems and branches fail closed", () => {
  assert.throws(() => yinMonthStemForYearStem("A"), /unknown heavenly stem/);
  assert.throws(() => monthPillarForYearStem("甲", "鼠"), /unknown BaZi month branch/);
});
