import test from "node:test";
import assert from "node:assert/strict";

import {
  HEAVENLY_STEMS,
  TEN_GOD_NAMES,
  tenGodForStem
} from "../src/calendar/ten-gods.js";

const XIN_MATRIX = {
  甲: "正財",
  乙: "偏財",
  丙: "正官",
  丁: "七殺",
  戊: "正印",
  己: "偏印",
  庚: "劫財",
  辛: "比肩",
  壬: "傷官",
  癸: "食神"
};

test("Xin Day Master reproduces the canonical Ten-God matrix", () => {
  for (const [stem, expected] of Object.entries(XIN_MATRIX)) {
    assert.equal(tenGodForStem("辛", stem).name, expected, `辛日主見${stem}`);
  }
});

test("every Day Master maps the ten stems to all ten Ten-God names exactly once", () => {
  const expected = [...TEN_GOD_NAMES].sort();
  for (const dayMaster of HEAVENLY_STEMS) {
    const actual = HEAVENLY_STEMS
      .map(stem => tenGodForStem(dayMaster, stem).name)
      .sort();
    assert.deepEqual(actual, expected, `${dayMaster}日主 should produce a complete ten-name set`);
  }
});

test("same stem is always Bi Jian and same element opposite polarity is Jie Cai", () => {
  const opposite = {
    甲: "乙", 乙: "甲", 丙: "丁", 丁: "丙", 戊: "己",
    己: "戊", 庚: "辛", 辛: "庚", 壬: "癸", 癸: "壬"
  };

  for (const dayMaster of HEAVENLY_STEMS) {
    assert.equal(tenGodForStem(dayMaster, dayMaster).name, "比肩");
    assert.equal(tenGodForStem(dayMaster, opposite[dayMaster]).name, "劫財");
  }
});

test("Five-Phase direction and yin-yang parity remain explicit in the result", () => {
  const food = tenGodForStem("甲", "丙");
  assert.equal(food.name, "食神");
  assert.equal(food.group, "output");
  assert.equal(food.groupLabel, "我生");
  assert.equal(food.samePolarity, true);

  const officer = tenGodForStem("甲", "辛");
  assert.equal(officer.name, "正官");
  assert.equal(officer.group, "officer");
  assert.equal(officer.groupLabel, "剋我");
  assert.equal(officer.samePolarity, false);
});

test("unknown stems fail closed", () => {
  assert.throws(() => tenGodForStem("辛", "A"), /unknown heavenly stem/);
  assert.throws(() => tenGodForStem("A", "辛"), /unknown heavenly stem/);
});
