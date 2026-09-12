import test from "node:test";
import assert from "node:assert/strict";
import {
  heavenlyStems,
  earthlyBranches,
  sexagenaryCycle,
  cycleItem,
  wrapCycleIndex
} from "../src/sexagenary-data.js";

test("sexagenary source sequences are 10 stems and 12 branches", () => {
  assert.equal(heavenlyStems.length, 10);
  assert.equal(earthlyBranches.length, 12);
  assert.deepEqual(heavenlyStems.map(item => item.name), ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]);
  assert.deepEqual(earthlyBranches.map(item => item.name), ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);
});

test("generated cycle contains exactly 60 unique Gan-Zhi pairs", () => {
  assert.equal(sexagenaryCycle.length, 60);
  assert.equal(new Set(sexagenaryCycle.map(item => item.name)).size, 60);
  assert.equal(sexagenaryCycle[0].name, "甲子");
  assert.equal(sexagenaryCycle[11].name, "乙亥");
  assert.equal(sexagenaryCycle[12].name, "丙子");
  assert.equal(sexagenaryCycle[29].name, "癸巳");
  assert.equal(sexagenaryCycle[59].name, "癸亥");
});

test("each cycle step advances stem and branch together", () => {
  sexagenaryCycle.forEach((item, index) => {
    assert.equal(item.stemIndex, index % 10);
    assert.equal(item.branchIndex, index % 12);
    assert.equal(item.stem.yinYang, item.branch.yinYang);
  });
});

test("60 is the first positive step where both source phases reset", () => {
  const earlierReset = Array.from({ length: 59 }, (_, i) => i + 1)
    .find(step => step % 10 === 0 && step % 12 === 0);
  assert.equal(earlierReset, undefined);
  assert.equal(60 % 10, 0);
  assert.equal(60 % 12, 0);
});

test("cycle index helpers wrap cleanly", () => {
  assert.equal(wrapCycleIndex(60), 0);
  assert.equal(wrapCycleIndex(-1), 59);
  assert.equal(cycleItem(60).name, "甲子");
  assert.equal(cycleItem(-1).name, "癸亥");
});
