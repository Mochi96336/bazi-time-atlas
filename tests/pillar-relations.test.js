import test from "node:test";
import assert from "node:assert/strict";

import {
  STEM_FIVE_COMBINATIONS,
  BRANCH_SIX_HARMONIES,
  BRANCH_SIX_CLASHES,
  BRANCH_SIX_HARMS,
  relationsForPair,
  visiblePillarPairRelations
} from "../src/calendar/pillar-relations.js";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function flatten(pairs) {
  return pairs.flatMap(pair => pair);
}

function canonical(pair, order) {
  return [...pair].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("");
}

function canonicalSet(pairs, order) {
  return new Set(pairs.map(pair => canonical(pair, order)));
}

test("canonical pair registries contain five combinations plus six harmony, clash and harm pairs", () => {
  assert.deepEqual(STEM_FIVE_COMBINATIONS, [
    ["甲", "己"], ["乙", "庚"], ["丙", "辛"], ["丁", "壬"], ["戊", "癸"]
  ]);
  assert.deepEqual(BRANCH_SIX_HARMONIES, [
    ["子", "丑"], ["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"], ["午", "未"]
  ]);
  assert.deepEqual(BRANCH_SIX_CLASHES, [
    ["子", "午"], ["丑", "未"], ["寅", "申"], ["卯", "酉"], ["辰", "戌"], ["巳", "亥"]
  ]);
  assert.deepEqual(BRANCH_SIX_HARMS, [
    ["子", "未"], ["丑", "午"], ["寅", "巳"], ["卯", "辰"], ["申", "亥"], ["酉", "戌"]
  ]);
});

test("five combinations pair every heavenly stem exactly once", () => {
  assert.deepEqual(flatten(STEM_FIVE_COMBINATIONS).sort(), [...STEMS].sort());
});

test("harmony, clash and harm registries each pair every earthly branch exactly once", () => {
  for (const pairs of [BRANCH_SIX_HARMONIES, BRANCH_SIX_CLASHES, BRANCH_SIX_HARMS]) {
    assert.deepEqual(flatten(pairs).sort(), [...BRANCHES].sort());
  }
});

test("six clashes are opposite branches six positions apart", () => {
  for (const [a, b] of BRANCH_SIX_CLASHES) {
    const delta = (BRANCHES.indexOf(b) - BRANCHES.indexOf(a) + 12) % 12;
    assert.equal(delta, 6, `${a}${b}`);
  }
});

test("harmony, clash and harm pair registries do not reuse the same unordered pair", () => {
  const registries = [BRANCH_SIX_HARMONIES, BRANCH_SIX_CLASHES, BRANCH_SIX_HARMS]
    .map(pairs => canonicalSet(pairs, BRANCHES));

  for (let left = 0; left < registries.length; left += 1) {
    for (let right = left + 1; right < registries.length; right += 1) {
      assert.deepEqual([...registries[left]].filter(pair => registries[right].has(pair)), []);
    }
  }
});

test("pair lookup is symmetric and does not infer non-membership", () => {
  assert.deepEqual(relationsForPair("stem", "甲", "己"), [{
    domain: "stem", kind: "five-combination", label: "五合", members: ["甲", "己"]
  }]);
  assert.deepEqual(relationsForPair("stem", "己", "甲"), [{
    domain: "stem", kind: "five-combination", label: "五合", members: ["己", "甲"]
  }]);
  assert.equal(relationsForPair("stem", "甲", "乙").length, 0);

  assert.equal(relationsForPair("branch", "酉", "辰")[0].kind, "six-harmony");
  assert.equal(relationsForPair("branch", "辰", "酉")[0].kind, "six-harmony");
  assert.equal(relationsForPair("branch", "子", "午")[0].kind, "six-clash");
  assert.equal(relationsForPair("branch", "午", "子")[0].kind, "six-clash");
  assert.equal(relationsForPair("branch", "寅", "巳")[0].kind, "six-harm");
  assert.equal(relationsForPair("branch", "巳", "寅")[0].kind, "six-harm");
  assert.equal(relationsForPair("branch", "子", "寅").length, 0);
});

test("no canonical pair is duplicated within a registry", () => {
  for (const [pairs, order] of [
    [STEM_FIVE_COMBINATIONS, STEMS],
    [BRANCH_SIX_HARMONIES, BRANCHES],
    [BRANCH_SIX_CLASHES, BRANCHES],
    [BRANCH_SIX_HARMS, BRANCHES]
  ]) {
    const keys = pairs.map(pair => canonical(pair, order));
    assert.equal(new Set(keys).size, keys.length);
  }
});

test("default Birth sample still exposes only the visible 辰酉六合", () => {
  const relations = visiblePillarPairRelations({
    year: { stem: "乙", branch: "酉" },
    month: { stem: "戊", branch: "子" },
    day: { stem: "辛", branch: "巳" },
    hour: { stem: "壬", branch: "辰" }
  });

  assert.deepEqual(relations, [{
    domain: "branch",
    kind: "six-harmony",
    label: "六合",
    members: ["酉", "辰"],
    left: { pillar: "year", value: "酉" },
    right: { pillar: "hour", value: "辰" }
  }]);
});

test("visible pillar scan can expose 六害 alongside independent relations", () => {
  const relations = visiblePillarPairRelations({
    year: { stem: "甲", branch: "寅" },
    month: { stem: "己", branch: "巳" },
    day: { stem: "丙", branch: "子" },
    hour: { stem: "辛", branch: "午" }
  });

  assert.deepEqual(relations.map(relation => [
    relation.domain,
    relation.kind,
    relation.left.pillar,
    relation.right.pillar,
    relation.members.join("")
  ]), [
    ["stem", "five-combination", "year", "month", "甲己"],
    ["branch", "six-harm", "year", "month", "寅巳"],
    ["stem", "five-combination", "day", "hour", "丙辛"],
    ["branch", "six-clash", "day", "hour", "子午"]
  ]);
});

test("unknown values and incomplete pillar objects fail closed", () => {
  assert.throws(() => relationsForPair("stem", "甲", "A"), /unknown stem/);
  assert.throws(() => relationsForPair("branch", "子", "A"), /unknown branch/);
  assert.throws(() => relationsForPair("planet", "甲", "己"), /unknown relation domain/);
  assert.throws(() => visiblePillarPairRelations({}), /missing pillar/);
});
