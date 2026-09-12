const BRANCHES = Object.freeze(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);
const PILLAR_KEYS = Object.freeze(["year", "month", "day", "hour"]);

function freezeGroups(groups) {
  return Object.freeze(groups.map(group => Object.freeze({
    ...group,
    members: Object.freeze([...group.members])
  })));
}

export const BRANCH_THREE_HARMONIES = freezeGroups([
  { kind: "three-harmony", label: "三合", element: "水", members: ["申", "子", "辰"] },
  { kind: "three-harmony", label: "三合", element: "木", members: ["亥", "卯", "未"] },
  { kind: "three-harmony", label: "三合", element: "火", members: ["寅", "午", "戌"] },
  { kind: "three-harmony", label: "三合", element: "金", members: ["巳", "酉", "丑"] }
]);

export const BRANCH_THREE_MEETINGS = freezeGroups([
  { kind: "three-meeting", label: "三會", element: "木", direction: "東", season: "春", members: ["寅", "卯", "辰"] },
  { kind: "three-meeting", label: "三會", element: "火", direction: "南", season: "夏", members: ["巳", "午", "未"] },
  { kind: "three-meeting", label: "三會", element: "金", direction: "西", season: "秋", members: ["申", "酉", "戌"] },
  { kind: "three-meeting", label: "三會", element: "水", direction: "北", season: "冬", members: ["亥", "子", "丑"] }
]);

const GROUPS = Object.freeze([
  ...BRANCH_THREE_HARMONIES,
  ...BRANCH_THREE_MEETINGS
]);

function validBranch(branch) {
  if (!BRANCHES.includes(branch)) {
    throw new RangeError(`unknown branch: ${branch}`);
  }
}

function validatePillars(pillars) {
  if (!pillars || typeof pillars !== "object") {
    throw new TypeError("pillars must be an object");
  }

  for (const key of PILLAR_KEYS) {
    const pillar = pillars[key];
    if (!pillar || typeof pillar !== "object") {
      throw new TypeError(`missing pillar: ${key}`);
    }
    validBranch(pillar.branch);
  }
}

/**
 * Resolve complete visible three-branch groups only.
 *
 * V1 deliberately requires all three canonical members to be present among the
 * four visible pillar branches. Two-member "half" patterns, transformation,
 * strength, auspiciousness, hidden stems and transit completion are excluded.
 * Duplicate occurrences are preserved as supporting pillar positions rather
 * than expanded into combinatorial duplicate matches.
 */
export function visiblePillarBranchGroups(pillars) {
  validatePillars(pillars);

  const occurrences = new Map(BRANCHES.map(branch => [branch, []]));
  for (const key of PILLAR_KEYS) {
    occurrences.get(pillars[key].branch).push(key);
  }

  return GROUPS
    .filter(group => group.members.every(member => occurrences.get(member).length > 0))
    .map(group => ({
      domain: "branch",
      arity: 3,
      kind: group.kind,
      label: group.label,
      element: group.element,
      ...(group.direction ? { direction: group.direction } : {}),
      ...(group.season ? { season: group.season } : {}),
      members: [...group.members],
      support: group.members.map(value => ({
        value,
        pillars: [...occurrences.get(value)]
      })),
      pillarKeys: PILLAR_KEYS.filter(key => group.members.includes(pillars[key].branch))
    }));
}

export const VISIBLE_BRANCH_GROUP_PILLAR_KEYS = PILLAR_KEYS;
