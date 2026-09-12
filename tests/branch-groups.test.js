import test from "node:test";
import assert from "node:assert/strict";

import {
  BRANCH_THREE_HARMONIES,
  BRANCH_THREE_MEETINGS,
  visiblePillarBranchGroups
} from "../src/calendar/branch-groups.js";

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function flattenedMembers(groups) {
  return groups.flatMap(group => group.members);
}

function pillarsWithBranches(year, month, day, hour) {
  return {
    year: { branch: year },
    month: { branch: month },
    day: { branch: day },
    hour: { branch: hour }
  };
}

test("canonical three-harmony and three-meeting registries stay explicit", () => {
  assert.deepEqual(BRANCH_THREE_HARMONIES, [
    { kind: "three-harmony", label: "三合", element: "水", members: ["申", "子", "辰"] },
    { kind: "three-harmony", label: "三合", element: "木", members: ["亥", "卯", "未"] },
    { kind: "three-harmony", label: "三合", element: "火", members: ["寅", "午", "戌"] },
    { kind: "three-harmony", label: "三合", element: "金", members: ["巳", "酉", "丑"] }
  ]);

  assert.deepEqual(BRANCH_THREE_MEETINGS, [
    { kind: "three-meeting", label: "三會", element: "木", direction: "東", season: "春", members: ["寅", "卯", "辰"] },
    { kind: "three-meeting", label: "三會", element: "火", direction: "南", season: "夏", members: ["巳", "午", "未"] },
    { kind: "three-meeting", label: "三會", element: "金", direction: "西", season: "秋", members: ["申", "酉", "戌"] },
    { kind: "three-meeting", label: "三會", element: "水", direction: "北", season: "冬", members: ["亥", "子", "丑"] }
  ]);
});

test("each registry partitions all twelve branches exactly once", () => {
  assert.deepEqual(flattenedMembers(BRANCH_THREE_HARMONIES).sort(), [...BRANCHES].sort());
  assert.deepEqual(flattenedMembers(BRANCH_THREE_MEETINGS).sort(), [...BRANCHES].sort());
});

test("three-harmony members are four branch positions apart around the cycle", () => {
  for (const group of BRANCH_THREE_HARMONIES) {
    const indices = group.members.map(branch => BRANCHES.indexOf(branch)).sort((a, b) => a - b);
    const gaps = [
      indices[1] - indices[0],
      indices[2] - indices[1],
      indices[0] + 12 - indices[2]
    ].sort((a, b) => a - b);
    assert.deepEqual(gaps, [4, 4, 4], `${group.members.join("")} should form a 120° branch trine`);
  }
});

test("three-meeting members are consecutive seasonal branches, including winter wrap", () => {
  for (const group of BRANCH_THREE_MEETINGS) {
    const [a, b, c] = group.members.map(branch => BRANCHES.indexOf(branch));
    assert.equal((b - a + 12) % 12, 1, group.members.join(""));
    assert.equal((c - b + 12) % 12, 1, group.members.join(""));
  }
});

test("complete visible 三合 resolves with canonical members and pillar support", () => {
  const groups = visiblePillarBranchGroups(pillarsWithBranches("申", "子", "辰", "卯"));
  assert.deepEqual(groups, [{
    domain: "branch",
    arity: 3,
    kind: "three-harmony",
    label: "三合",
    element: "水",
    members: ["申", "子", "辰"],
    support: [
      { value: "申", pillars: ["year"] },
      { value: "子", pillars: ["month"] },
      { value: "辰", pillars: ["day"] }
    ],
    pillarKeys: ["year", "month", "day"]
  }]);
});

test("complete visible 三會 resolves independently from 三合", () => {
  const groups = visiblePillarBranchGroups(pillarsWithBranches("寅", "卯", "巳", "辰"));
  assert.deepEqual(groups, [{
    domain: "branch",
    arity: 3,
    kind: "three-meeting",
    label: "三會",
    element: "木",
    direction: "東",
    season: "春",
    members: ["寅", "卯", "辰"],
    support: [
      { value: "寅", pillars: ["year"] },
      { value: "卯", pillars: ["month"] },
      { value: "辰", pillars: ["hour"] }
    ],
    pillarKeys: ["year", "month", "hour"]
  }]);
});

test("two members do not become a half-combination or half-meeting in V1", () => {
  assert.equal(visiblePillarBranchGroups(pillarsWithBranches("申", "子", "卯", "午")).length, 0);
  assert.equal(visiblePillarBranchGroups(pillarsWithBranches("寅", "卯", "午", "酉")).length, 0);
});

test("duplicate member occurrences support one group instead of duplicating matches", () => {
  const groups = visiblePillarBranchGroups(pillarsWithBranches("寅", "寅", "卯", "辰"));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "three-meeting");
  assert.deepEqual(groups[0].support, [
    { value: "寅", pillars: ["year", "month"] },
    { value: "卯", pillars: ["day"] },
    { value: "辰", pillars: ["hour"] }
  ]);
  assert.deepEqual(groups[0].pillarKeys, ["year", "month", "day", "hour"]);
});

test("four visible branches can contain at most one complete V1 three-branch group", () => {
  for (const year of BRANCHES) {
    for (const month of BRANCHES) {
      for (const day of BRANCHES) {
        for (const hour of BRANCHES) {
          const groups = visiblePillarBranchGroups(pillarsWithBranches(year, month, day, hour));
          assert.ok(groups.length <= 1, `${year}${month}${day}${hour} produced ${groups.length} groups`);
        }
      }
    }
  }
});

test("unknown branches and incomplete pillars fail closed", () => {
  assert.throws(() => visiblePillarBranchGroups(pillarsWithBranches("A", "子", "辰", "申")), /unknown branch/);
  assert.throws(() => visiblePillarBranchGroups({}), /missing pillar/);
});
