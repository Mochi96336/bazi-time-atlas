const BRANCHES = Object.freeze(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);
const PILLAR_KEYS = Object.freeze(["year", "month", "day", "hour"]);

export const DIRECTIONAL_PUNISHMENT_EDGES = Object.freeze([
  Object.freeze({ source: "寅", target: "巳", cycle: "寅巳申" }),
  Object.freeze({ source: "巳", target: "申", cycle: "寅巳申" }),
  Object.freeze({ source: "申", target: "寅", cycle: "寅巳申" }),
  Object.freeze({ source: "丑", target: "戌", cycle: "丑戌未" }),
  Object.freeze({ source: "戌", target: "未", cycle: "丑戌未" }),
  Object.freeze({ source: "未", target: "丑", cycle: "丑戌未" })
]);

export const MUTUAL_PUNISHMENT_PAIR = Object.freeze(["子", "卯"]);
export const SELF_PUNISHMENT_BRANCHES = Object.freeze(["辰", "午", "酉", "亥"]);

function validateBranch(branch) {
  if (!BRANCHES.includes(branch)) throw new RangeError(`unknown branch: ${branch}`);
}

function validatePillars(pillars) {
  if (!pillars || typeof pillars !== "object") throw new TypeError("pillars must be an object");
  for (const key of PILLAR_KEYS) {
    const branch = pillars[key]?.branch;
    if (typeof branch !== "string") throw new TypeError(`missing branch for pillar: ${key}`);
    validateBranch(branch);
  }
}

function directionalEdge(source, target) {
  return DIRECTIONAL_PUNISHMENT_EDGES.find(edge => edge.source === source && edge.target === target) ?? null;
}

function isMutualPair(a, b) {
  const [x, y] = MUTUAL_PUNISHMENT_PAIR;
  return (a === x && b === y) || (a === y && b === x);
}

/**
 * Resolve visible-branch punishment structure without interpretive claims.
 *
 * - directed: six directed edges across the 寅巳申 and 丑戌未 cycles
 * - mutual: 子卯 represented once as one reciprocal relation
 * - self: 辰午酉亥 require at least two visible occurrences; duplicate
 *   occurrence pairs are aggregated into one event per branch
 */
export function visiblePillarPunishments(pillars) {
  validatePillars(pillars);
  const events = [];

  for (let leftIndex = 0; leftIndex < PILLAR_KEYS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < PILLAR_KEYS.length; rightIndex += 1) {
      const leftPillar = PILLAR_KEYS[leftIndex];
      const rightPillar = PILLAR_KEYS[rightIndex];
      const leftBranch = pillars[leftPillar].branch;
      const rightBranch = pillars[rightPillar].branch;

      if (leftBranch === rightBranch) continue;

      if (isMutualPair(leftBranch, rightBranch)) {
        events.push({
          kind: "mutual",
          label: "互刑",
          members: [leftBranch, rightBranch],
          left: { pillar: leftPillar, branch: leftBranch },
          right: { pillar: rightPillar, branch: rightBranch }
        });
        continue;
      }

      const leftToRight = directionalEdge(leftBranch, rightBranch);
      if (leftToRight) {
        events.push({
          kind: "directed",
          label: "刑",
          cycle: leftToRight.cycle,
          source: { pillar: leftPillar, branch: leftBranch },
          target: { pillar: rightPillar, branch: rightBranch }
        });
      }

      const rightToLeft = directionalEdge(rightBranch, leftBranch);
      if (rightToLeft) {
        events.push({
          kind: "directed",
          label: "刑",
          cycle: rightToLeft.cycle,
          source: { pillar: rightPillar, branch: rightBranch },
          target: { pillar: leftPillar, branch: leftBranch }
        });
      }
    }
  }

  for (const branch of SELF_PUNISHMENT_BRANCHES) {
    const supports = PILLAR_KEYS.filter(key => pillars[key].branch === branch);
    if (supports.length >= 2) {
      events.push({
        kind: "self",
        label: "自刑",
        branch,
        supports
      });
    }
  }

  return events;
}

export const PUNISHMENT_PILLAR_KEYS = PILLAR_KEYS;
