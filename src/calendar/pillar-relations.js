const STEMS = Object.freeze(["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]);
const BRANCHES = Object.freeze(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);
const PILLAR_KEYS = Object.freeze(["year", "month", "day", "hour"]);

function freezePairs(pairs) {
  return Object.freeze(pairs.map(pair => Object.freeze([...pair])));
}

export const STEM_FIVE_COMBINATIONS = freezePairs([
  ["甲", "己"],
  ["乙", "庚"],
  ["丙", "辛"],
  ["丁", "壬"],
  ["戊", "癸"]
]);

export const BRANCH_SIX_HARMONIES = freezePairs([
  ["子", "丑"],
  ["寅", "亥"],
  ["卯", "戌"],
  ["辰", "酉"],
  ["巳", "申"],
  ["午", "未"]
]);

export const BRANCH_SIX_CLASHES = freezePairs([
  ["子", "午"],
  ["丑", "未"],
  ["寅", "申"],
  ["卯", "酉"],
  ["辰", "戌"],
  ["巳", "亥"]
]);

export const BRANCH_SIX_HARMS = freezePairs([
  ["子", "未"],
  ["丑", "午"],
  ["寅", "巳"],
  ["卯", "辰"],
  ["申", "亥"],
  ["酉", "戌"]
]);

const RELATION_DEFINITIONS = Object.freeze([
  Object.freeze({
    domain: "stem",
    kind: "five-combination",
    label: "五合",
    pairs: STEM_FIVE_COMBINATIONS
  }),
  Object.freeze({
    domain: "branch",
    kind: "six-harmony",
    label: "六合",
    pairs: BRANCH_SIX_HARMONIES
  }),
  Object.freeze({
    domain: "branch",
    kind: "six-clash",
    label: "六沖",
    pairs: BRANCH_SIX_CLASHES
  }),
  Object.freeze({
    domain: "branch",
    kind: "six-harm",
    label: "六害",
    pairs: BRANCH_SIX_HARMS
  })
]);

function validValue(domain, value) {
  const values = domain === "stem" ? STEMS : BRANCHES;
  if (!values.includes(value)) {
    throw new RangeError(`unknown ${domain}: ${value}`);
  }
}

function pairMatches(pair, a, b) {
  return (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a);
}

/**
 * Return static pair membership only.
 *
 * This deliberately does not infer transformation, strength, auspiciousness,
 * real-world harm, or whether one relation overrides another.
 */
export function relationsForPair(domain, a, b) {
  if (domain !== "stem" && domain !== "branch") {
    throw new RangeError(`unknown relation domain: ${domain}`);
  }
  validValue(domain, a);
  validValue(domain, b);

  return RELATION_DEFINITIONS
    .filter(definition => definition.domain === domain)
    .filter(definition => definition.pairs.some(pair => pairMatches(pair, a, b)))
    .map(definition => ({
      domain: definition.domain,
      kind: definition.kind,
      label: definition.label,
      members: [a, b]
    }));
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
    validValue("stem", pillar.stem);
    validValue("branch", pillar.branch);
  }
}

/**
 * Scan the six unordered pairs among year/month/day/hour visible pillars.
 * Hidden stems are intentionally excluded from this layer.
 */
export function visiblePillarPairRelations(pillars) {
  validatePillars(pillars);
  const relations = [];

  for (let leftIndex = 0; leftIndex < PILLAR_KEYS.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < PILLAR_KEYS.length; rightIndex += 1) {
      const leftKey = PILLAR_KEYS[leftIndex];
      const rightKey = PILLAR_KEYS[rightIndex];
      const left = pillars[leftKey];
      const right = pillars[rightKey];

      for (const domain of ["stem", "branch"]) {
        const leftValue = domain === "stem" ? left.stem : left.branch;
        const rightValue = domain === "stem" ? right.stem : right.branch;

        for (const relation of relationsForPair(domain, leftValue, rightValue)) {
          relations.push({
            ...relation,
            left: { pillar: leftKey, value: leftValue },
            right: { pillar: rightKey, value: rightValue }
          });
        }
      }
    }
  }

  return relations;
}

export const VISIBLE_PILLAR_KEYS = PILLAR_KEYS;
