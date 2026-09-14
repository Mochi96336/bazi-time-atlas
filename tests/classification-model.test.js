import test from "node:test";
import assert from "node:assert/strict";

import {
  FIVE_ELEMENTS,
  ZODIAC_ELEMENTS,
  ZODIAC_MODALITIES,
  cycleClassification,
  pillarClassification,
  zodiacClassification
} from "../src/classification-model.js";

test("pillar classification preserves separate stem and branch five-element identities", () => {
  assert.deepEqual(pillarClassification("甲子"), {
    name: "甲子",
    stemElement: "木",
    stemYinYang: "陽",
    branchElement: "水",
    branchYinYang: "陽"
  });
  assert.deepEqual(pillarClassification("辛酉"), {
    name: "辛酉",
    stemElement: "金",
    stemYinYang: "陰",
    branchElement: "金",
    branchYinYang: "陰"
  });
  assert.equal(pillarClassification("—"), null);
});

test("sexagenary cycle classification comes from the canonical cycle data", () => {
  assert.deepEqual(cycleClassification(0), {
    index: 0,
    name: "甲子",
    stemElement: "木",
    stemYinYang: "陽",
    branchElement: "水",
    branchYinYang: "陽"
  });
  assert.equal(cycleClassification(2).name, "丙寅");
  assert.equal(cycleClassification(2).stemElement, "火");
  assert.equal(cycleClassification(2).branchElement, "木");
  assert.equal(cycleClassification(60).name, "甲子");
});

test("zodiac element and modality remain a separate classification system", () => {
  assert.deepEqual(zodiacClassification("白羊"), {
    name: "白羊",
    element: "火",
    modality: "基本",
    start: 0,
    end: 30
  });
  assert.deepEqual(zodiacClassification(2), {
    name: "雙子",
    element: "風",
    modality: "變動",
    start: 60,
    end: 90
  });
  assert.deepEqual(FIVE_ELEMENTS, ["木", "火", "土", "金", "水"]);
  assert.deepEqual(ZODIAC_ELEMENTS, ["火", "土", "風", "水"]);
  assert.deepEqual(ZODIAC_MODALITIES, ["基本", "固定", "變動"]);
  assert.notDeepEqual(FIVE_ELEMENTS, ZODIAC_ELEMENTS, "the two element vocabularies must never be modeled as equivalent sets");
});
