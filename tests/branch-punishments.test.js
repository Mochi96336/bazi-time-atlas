import test from "node:test";
import assert from "node:assert/strict";

import {
  DIRECTIONAL_PUNISHMENT_EDGES,
  MUTUAL_PUNISHMENT_PAIR,
  SELF_PUNISHMENT_BRANCHES,
  visiblePillarPunishments
} from "../src/calendar/branch-punishments.js";

const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

function pillars(branches) {
  const [year, month, day, hour] = branches;
  return {
    year: { branch: year },
    month: { branch: month },
    day: { branch: day },
    hour: { branch: hour }
  };
}

test("directed punishment registry preserves the two three-branch cycles", () => {
  assert.deepEqual(DIRECTIONAL_PUNISHMENT_EDGES, [
    { source: "寅", target: "巳", cycle: "寅巳申" },
    { source: "巳", target: "申", cycle: "寅巳申" },
    { source: "申", target: "寅", cycle: "寅巳申" },
    { source: "丑", target: "戌", cycle: "丑戌未" },
    { source: "戌", target: "未", cycle: "丑戌未" },
    { source: "未", target: "丑", cycle: "丑戌未" }
  ]);

  for (const cycle of ["寅巳申", "丑戌未"]) {
    const edges = DIRECTIONAL_PUNISHMENT_EDGES.filter(edge => edge.cycle === cycle);
    assert.equal(edges.length, 3);
    assert.deepEqual(new Set(edges.map(edge => edge.source)), new Set([...cycle]));
    assert.deepEqual(new Set(edges.map(edge => edge.target)), new Set([...cycle]));
  }
});

test("mutual and self registries remain distinct from directed cycles", () => {
  assert.deepEqual(MUTUAL_PUNISHMENT_PAIR, ["子", "卯"]);
  assert.deepEqual(SELF_PUNISHMENT_BRANCHES, ["辰", "午", "酉", "亥"]);

  const directionalBranches = new Set(DIRECTIONAL_PUNISHMENT_EDGES.flatMap(edge => [edge.source, edge.target]));
  assert.equal(directionalBranches.has("子"), false);
  assert.equal(directionalBranches.has("卯"), false);
  for (const branch of SELF_PUNISHMENT_BRANCHES) assert.equal(directionalBranches.has(branch), false);
});

test("directional punishment keeps source and target pillar semantics", () => {
  const result = visiblePillarPunishments(pillars(["寅", "子", "辰", "巳"]));
  assert.deepEqual(result, [{
    kind: "directed",
    label: "刑",
    cycle: "寅巳申",
    source: { pillar: "year", branch: "寅" },
    target: { pillar: "hour", branch: "巳" }
  }]);

  const reversedPositions = visiblePillarPunishments(pillars(["巳", "子", "辰", "寅"]));
  assert.deepEqual(reversedPositions, [{
    kind: "directed",
    label: "刑",
    cycle: "寅巳申",
    source: { pillar: "hour", branch: "寅" },
    target: { pillar: "year", branch: "巳" }
  }]);
});

test("子卯 produces one reciprocal event instead of two arrows", () => {
  const result = visiblePillarPunishments(pillars(["子", "寅", "辰", "卯"]));
  assert.deepEqual(result, [{
    kind: "mutual",
    label: "互刑",
    members: ["子", "卯"],
    left: { pillar: "year", branch: "子" },
    right: { pillar: "hour", branch: "卯" }
  }]);
});

test("self punishment requires duplicate visible occurrences and aggregates supports", () => {
  const single = visiblePillarPunishments(pillars(["辰", "子", "寅", "卯"]));
  assert.equal(single.filter(event => event.kind === "self").length, 0);

  assert.deepEqual(visiblePillarPunishments(pillars(["辰", "子", "寅", "辰"])), [{
    kind: "self",
    label: "自刑",
    branch: "辰",
    supports: ["year", "hour"]
  }]);

  assert.deepEqual(visiblePillarPunishments(pillars(["辰", "辰", "寅", "辰"])), [{
    kind: "self",
    label: "自刑",
    branch: "辰",
    supports: ["year", "month", "hour"]
  }]);
});

test("default Birth sample has no punishment event", () => {
  assert.deepEqual(visiblePillarPunishments(pillars(["酉", "子", "巳", "辰"])), []);
});

test("directed, mutual and self events can coexist without overwriting one another", () => {
  const result = visiblePillarPunishments(pillars(["寅", "卯", "子", "巳"]));
  assert.deepEqual(result.map(event => event.kind), ["directed", "mutual"]);

  const withSelf = visiblePillarPunishments(pillars(["辰", "子", "卯", "辰"]));
  assert.deepEqual(withSelf.map(event => event.kind), ["mutual", "self"]);
});

test("all twelve branches belong to exactly one structural punishment category", () => {
  const directed = new Set(DIRECTIONAL_PUNISHMENT_EDGES.flatMap(edge => [edge.source, edge.target]));
  const mutual = new Set(MUTUAL_PUNISHMENT_PAIR);
  const self = new Set(SELF_PUNISHMENT_BRANCHES);
  const all = [...directed, ...mutual, ...self];
  assert.equal(all.length, 12);
  assert.deepEqual(new Set(all), new Set(BRANCHES));
});

test("unknown or incomplete branch data fails closed", () => {
  assert.throws(() => visiblePillarPunishments({}), /missing branch/);
  assert.throws(() => visiblePillarPunishments(pillars(["子", "丑", "寅", "A"])), /unknown branch/);
});
