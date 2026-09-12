import test from "node:test";
import assert from "node:assert/strict";
import { baziMonths } from "../src/data.js";
import {
  HIDDEN_STEM_BRANCHES,
  HIDDEN_STEM_NAMES,
  hiddenStemsForBranch,
  primaryHiddenStem
} from "../src/calendar/hidden-stems.js";

const expected = new Map([
  ["子", ["癸"]], ["丑", ["己", "癸", "辛"]], ["寅", ["甲", "丙", "戊"]],
  ["卯", ["乙"]], ["辰", ["戊", "乙", "癸"]], ["巳", ["丙", "戊", "庚"]],
  ["午", ["丁", "己"]], ["未", ["己", "丁", "乙"]], ["申", ["庚", "壬", "戊"]],
  ["酉", ["辛"]], ["戌", ["戊", "辛", "丁"]], ["亥", ["壬", "甲"]]
]);

const stemElement = new Map([
  ["甲", "木"], ["乙", "木"], ["丙", "火"], ["丁", "火"], ["戊", "土"],
  ["己", "土"], ["庚", "金"], ["辛", "金"], ["壬", "水"], ["癸", "水"]
]);

test("canonical hidden-stem table covers all twelve branches exactly", () => {
  assert.deepEqual(HIDDEN_STEM_BRANCHES, [...expected.keys()]);
  for (const [branch, names] of expected) {
    assert.deepEqual(hiddenStemsForBranch(branch).map(item => item.name), names);
  }
});

test("all hidden stems are valid heavenly stems and there are 28 assignments", () => {
  const all = HIDDEN_STEM_BRANCHES.flatMap(branch => hiddenStemsForBranch(branch));
  assert.equal(all.length, 28);
  assert.ok(all.every(item => HIDDEN_STEM_NAMES.includes(item.name)));
});

test("first hidden stem matches each branch primary Five-Phase mapping", () => {
  for (const month of baziMonths) {
    assert.equal(stemElement.get(primaryHiddenStem(month.branch).name), month.element);
  }
});

test("roles preserve order without inventing fixed percentages", () => {
  assert.deepEqual(
    hiddenStemsForBranch("丑").map(item => [item.name, item.role, item.order]),
    [["己", "主", 1], ["癸", "次", 2], ["辛", "餘", 3]]
  );
  assert.deepEqual(
    hiddenStemsForBranch("午").map(item => [item.name, item.role, item.order]),
    [["丁", "主", 1], ["己", "次", 2]]
  );
});

test("unknown branch fails closed", () => {
  assert.throws(() => hiddenStemsForBranch("貓"), /unknown earthly branch/);
});
