import test from "node:test";
import assert from "node:assert/strict";

import {
  HEAVENLY_STEMS,
  TEN_GOD_NAMES,
  TEN_GOD_GROUPS,
  tenGodForStem,
  tenGodDerivationForDayMaster
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

test("Xin derivation map exposes the five relation groups around Yin Metal", () => {
  const derivation = tenGodDerivationForDayMaster("辛");
  assert.deepEqual(derivation.map(group => group.group), [...TEN_GOD_GROUPS]);

  const compact = Object.fromEntries(derivation.map(group => [
    group.group,
    {
      label: group.groupLabel,
      element: group.targetElement,
      same: `${group.same.other.name}${group.same.name}`,
      opposite: `${group.opposite.other.name}${group.opposite.name}`
    }
  ]));

  assert.deepEqual(compact, {
    resource: { label: "生我", element: "土", same: "己偏印", opposite: "戊正印" },
    officer: { label: "剋我", element: "火", same: "丁七殺", opposite: "丙正官" },
    peer: { label: "同我", element: "金", same: "辛比肩", opposite: "庚劫財" },
    output: { label: "我生", element: "水", same: "癸食神", opposite: "壬傷官" },
    wealth: { label: "我剋", element: "木", same: "乙偏財", opposite: "甲正財" }
  });
});

test("every derivation map is five polarity pairs covering all ten stems and names", () => {
  for (const dayMaster of HEAVENLY_STEMS) {
    const derivation = tenGodDerivationForDayMaster(dayMaster);
    assert.equal(derivation.length, 5);
    assert.deepEqual(derivation.map(group => group.group), [...TEN_GOD_GROUPS]);

    const relations = derivation.flatMap(group => [group.same, group.opposite]);
    assert.equal(new Set(relations.map(relation => relation.other.name)).size, 10);
    assert.deepEqual(relations.map(relation => relation.name).sort(), [...TEN_GOD_NAMES].sort());

    for (const group of derivation) {
      assert.equal(group.same.samePolarity, true);
      assert.equal(group.opposite.samePolarity, false);
      assert.equal(group.same.other.element, group.targetElement);
      assert.equal(group.opposite.other.element, group.targetElement);
    }
  }
});

test("unknown stems fail closed", () => {
  assert.throws(() => tenGodForStem("辛", "A"), /unknown heavenly stem/);
  assert.throws(() => tenGodForStem("A", "辛"), /unknown heavenly stem/);
  assert.throws(() => tenGodDerivationForDayMaster("A"), /unknown heavenly stem/);
});
