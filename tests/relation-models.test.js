import test from "node:test";
import assert from "node:assert/strict";

import {
  RELATION_MODEL_FAMILIES,
  relationModelFamily
} from "../src/calendar/relation-models.js";

test("relation model families remain three distinct topologies", () => {
  assert.deepEqual(RELATION_MODEL_FAMILIES.map(family => [
    family.id,
    family.topology,
    family.memberCount
  ]), [
    ["pair", "unordered-pair", 2],
    ["complete-group", "complete-set", 3],
    ["punishment", "directed-reciprocal-self", null]
  ]);
});

test("pair model owns only symmetric two-member relation labels", () => {
  const pair = relationModelFamily("pair");
  assert.deepEqual(pair.labels, ["五合", "六合", "六沖", "六害"]);
  assert.equal(pair.memberCount, 2);
});

test("complete-group model owns only full three-branch relation labels", () => {
  const group = relationModelFamily("complete-group");
  assert.deepEqual(group.labels, ["三合", "三會"]);
  assert.equal(group.memberCount, 3);
  assert.equal(group.topology, "complete-set");
});

test("punishment model preserves directed reciprocal and repeated-self modes", () => {
  const punishment = relationModelFamily("punishment");
  assert.deepEqual(punishment.labels, ["方向刑", "互刑", "自刑"]);
  assert.deepEqual(punishment.modes.map(mode => [mode.id, mode.glyph]), [
    ["directed", "→"],
    ["mutual", "↔"],
    ["self", "×2"]
  ]);
  assert.equal(punishment.memberCount, null);
});

test("family ids are unique and unknown ids fail closed", () => {
  const ids = RELATION_MODEL_FAMILIES.map(family => family.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => relationModelFamily("pair-ish"), /unknown relation model family/);
});
