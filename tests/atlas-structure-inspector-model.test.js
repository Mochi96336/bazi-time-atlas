import test from "node:test";
import assert from "node:assert/strict";

import {
  ATLAS_STRUCTURE_PILLAR_KEYS,
  atlasStructureInspectorState
} from "../src/atlas-structure-inspector-model.js";

const DEFAULT_BIRTH = Object.freeze({
  yearPillar: "乙酉",
  monthPillar: "戊子",
  dayPillar: "辛巳",
  hourPillar: "壬辰"
});

test("structure inspector expands the existing Birth fixture without recomputing time", () => {
  const state = atlasStructureInspectorState(DEFAULT_BIRTH);
  assert.ok(state);
  assert.equal(state.dayMaster, "辛");
  assert.deepEqual(state.dayMasterMeta, { name: "辛", element: "金", yinYang: "陰" });
  assert.deepEqual(ATLAS_STRUCTURE_PILLAR_KEYS, ["year", "month", "day", "hour"]);
  assert.deepEqual(
    state.pillars.map(pillar => [pillar.key, pillar.name, pillar.visibleStem.tenGod]),
    [
      ["year", "乙酉", "偏財"],
      ["month", "戊子", "正印"],
      ["day", "辛巳", "日主"],
      ["hour", "壬辰", "傷官"]
    ]
  );
  assert.equal(state.pillars[2].visibleStem.relation.name, "比肩");
  assert.equal(state.pillars[0].visibleStem.relation.groupLabel, "我剋");
  assert.equal(state.pillars[0].visibleStem.relation.samePolarity, true);

  assert.deepEqual(
    state.tenGodDerivation.map(group => [
      group.group,
      group.groupLabel,
      group.targetElement,
      group.same.name,
      group.opposite.name
    ]),
    [
      ["resource", "生我", "土", "偏印", "正印"],
      ["officer", "剋我", "火", "七殺", "正官"],
      ["peer", "同我", "金", "比肩", "劫財"],
      ["output", "我生", "水", "食神", "傷官"],
      ["wealth", "我剋", "木", "偏財", "正財"]
    ]
  );

  assert.deepEqual(
    state.pillars.map(pillar => pillar.hiddenStems.map(hidden => [hidden.name, hidden.role, hidden.tenGod.name])),
    [
      [["辛", "主", "比肩"]],
      [["癸", "主", "食神"]],
      [["丙", "主", "正官"], ["戊", "次", "正印"], ["庚", "餘", "劫財"]],
      [["戊", "主", "正印"], ["乙", "次", "偏財"], ["癸", "餘", "食神"]]
    ]
  );

  assert.deepEqual(
    state.relations.pairs.map(relation => [relation.label, relation.left.pillar, relation.right.pillar, relation.members.join("")]),
    [["六合", "year", "hour", "酉辰"]]
  );
  assert.deepEqual(state.relations.groups, []);
  assert.deepEqual(state.relations.punishments, []);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.pillars[0].hiddenStems), true);
  assert.equal(Object.isFrozen(state.tenGodDerivation), true);
});

test("structure inspector composes pair, complete-group and punishment families", () => {
  const state = atlasStructureInspectorState({
    yearPillar: "甲申",
    monthPillar: "丙子",
    dayPillar: "庚辰",
    hourPillar: "己卯"
  });
  assert.ok(state);

  assert.deepEqual(
    state.relations.pairs.map(relation => [relation.domain, relation.label, relation.members.join("")]),
    [
      ["stem", "五合", "甲己"],
      ["branch", "六害", "辰卯"]
    ]
  );
  assert.deepEqual(
    state.relations.groups.map(group => [group.label, group.element, group.members.join(""), group.pillarKeys.join(",")]),
    [["三合", "水", "申子辰", "year,month,day"]]
  );
  assert.deepEqual(
    state.relations.punishments.map(event => [event.kind, event.label, event.members?.join("") ?? event.branch]),
    [["mutual", "互刑", "子卯"]]
  );
});

test("structure inspector fails closed for incomplete or invalid sexagenary identities", () => {
  assert.equal(atlasStructureInspectorState(), null);
  assert.equal(atlasStructureInspectorState({ ...DEFAULT_BIRTH, hourPillar: null }), null);
  assert.equal(atlasStructureInspectorState({ ...DEFAULT_BIRTH, hourPillar: "壬龍" }), null);
  assert.equal(atlasStructureInspectorState({ ...DEFAULT_BIRTH, dayPillar: "辛" }), null);
  assert.equal(atlasStructureInspectorState({ ...DEFAULT_BIRTH, yearPillar: "甲丑" }), null);
});
