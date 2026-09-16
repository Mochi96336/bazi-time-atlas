import test from "node:test";
import assert from "node:assert/strict";
import {
  GANZHI_PILLARS,
  ganzhiInspectorModel,
  normalizeGanzhiPillar,
  sexagenaryReferenceByName
} from "../src/ganzhi-inspector-model.js";

test("乙酉 resolves to the same sexagenary structure used by the legacy reference", () => {
  const reference = sexagenaryReferenceByName("乙酉");
  assert.equal(reference.ordinal, 22);
  assert.deepEqual(reference.stem, {
    name: "乙",
    yinYang: "陰",
    element: "木",
    phase: 2,
    period: 10
  });
  assert.deepEqual(reference.branch, {
    name: "酉",
    yinYang: "陰",
    element: "金",
    phase: 10,
    period: 12
  });
  assert.deepEqual(reference.previous, { name: "甲申", ordinal: 21 });
  assert.deepEqual(reference.next, { name: "丙戌", ordinal: 23 });
});

test("inspector model binds a Ganzhi reference to one Atlas pillar without creating another clock", () => {
  const model = ganzhiInspectorModel("day", "乙酉");
  assert.equal(model.pillar, "day");
  assert.equal(model.pillarLabel, "日柱");
  assert.equal(model.stateId, "state-day");
  assert.equal(model.name, "乙酉");
  assert.equal(model.ordinal, 22);
});

test("pillar and Ganzhi inputs fail closed", () => {
  assert.equal(normalizeGanzhiPillar("year"), "year");
  assert.equal(normalizeGanzhiPillar("solar"), null);
  assert.equal(ganzhiInspectorModel("solar", "乙酉"), null);
  assert.equal(ganzhiInspectorModel("year", "not-ganzhi"), null);
  assert.deepEqual(Object.keys(GANZHI_PILLARS), ["year", "month", "day", "hour"]);
});
