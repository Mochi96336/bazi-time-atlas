import { hiddenStemsForBranch } from "./calendar/hidden-stems.js";
import {
  heavenlyStemMeta,
  tenGodDerivationForDayMaster,
  tenGodForStem
} from "./calendar/ten-gods.js";
import { visiblePillarPairRelations } from "./calendar/pillar-relations.js";
import { visiblePillarBranchGroups } from "./calendar/branch-groups.js";
import { visiblePillarPunishments } from "./calendar/branch-punishments.js";
import { sexagenaryCycle } from "./sexagenary-data.js";

const PILLAR_KEYS = Object.freeze(["year", "month", "day", "hour"]);
const PILLAR_LABELS = Object.freeze({
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "時柱"
});
const SEXAGENARY_NAMES = new Set(sexagenaryCycle.map(item => item.name));

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizePillar(name) {
  if (typeof name !== "string" || !SEXAGENARY_NAMES.has(name)) return null;
  return Object.freeze({ name, stem: name[0], branch: name[1] });
}

function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const names = {
    year: input.yearPillar,
    month: input.monthPillar,
    day: input.dayPillar,
    hour: input.hourPillar
  };
  const pillars = Object.fromEntries(
    PILLAR_KEYS.map(key => [key, normalizePillar(names[key])])
  );
  return Object.values(pillars).some(value => value === null) ? null : pillars;
}

function tenGodSummary(dayMaster, stem) {
  const relation = tenGodForStem(dayMaster, stem);
  return {
    name: relation.name,
    group: relation.group,
    groupLabel: relation.groupLabel,
    samePolarity: relation.samePolarity
  };
}

function visibleStemSummary(dayMaster, key, stem) {
  const relation = tenGodSummary(dayMaster, stem);
  return {
    name: stem,
    tenGod: key === "day" ? "日主" : relation.name,
    relationGroup: key === "day" ? "day-master" : relation.group,
    relation
  };
}

/**
 * Build the structure data behind a future Atlas four-pillar inspector.
 *
 * This model reads already-resolved pillar identities only. It does not own or
 * recompute Selected Instant, time conventions, astronomy, strength, weighting,
 * auspiciousness or interpretation. Invalid/incomplete pillar input fails closed.
 */
export function atlasStructureInspectorState(input = {}) {
  const normalized = normalizeInput(input);
  if (!normalized) return null;

  const dayMaster = normalized.day.stem;
  const relationPillars = Object.fromEntries(
    PILLAR_KEYS.map(key => [key, {
      stem: normalized[key].stem,
      branch: normalized[key].branch
    }])
  );

  const pillars = PILLAR_KEYS.map(key => {
    const pillar = normalized[key];
    const hiddenStems = hiddenStemsForBranch(pillar.branch).map(hidden => ({
      ...hidden,
      tenGod: tenGodSummary(dayMaster, hidden.name)
    }));

    return {
      key,
      label: PILLAR_LABELS[key],
      name: pillar.name,
      stem: pillar.stem,
      branch: pillar.branch,
      visibleStem: visibleStemSummary(dayMaster, key, pillar.stem),
      hiddenStems
    };
  });

  return deepFreeze({
    dayMaster,
    dayMasterMeta: heavenlyStemMeta(dayMaster),
    tenGodDerivation: tenGodDerivationForDayMaster(dayMaster),
    pillars,
    relations: {
      pairs: visiblePillarPairRelations(relationPillars),
      groups: visiblePillarBranchGroups(relationPillars),
      punishments: visiblePillarPunishments(relationPillars)
    }
  });
}

export const ATLAS_STRUCTURE_PILLAR_KEYS = PILLAR_KEYS;
