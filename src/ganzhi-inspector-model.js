import { cycleItem, sexagenaryCycle } from "./sexagenary-data.js";

export const GANZHI_PILLARS = Object.freeze({
  year: Object.freeze({ label: "年柱", stateId: "state-year" }),
  month: Object.freeze({ label: "月柱", stateId: "state-month" }),
  day: Object.freeze({ label: "日柱", stateId: "state-day" }),
  hour: Object.freeze({ label: "時柱", stateId: "state-hour" })
});

export function normalizeGanzhiPillar(value) {
  return typeof value === "string" && Object.hasOwn(GANZHI_PILLARS, value) ? value : null;
}

export function sexagenaryReferenceByName(name) {
  const normalized = typeof name === "string" ? name.trim() : "";
  const index = sexagenaryCycle.findIndex(item => item.name === normalized);
  if (index < 0) return null;

  const item = cycleItem(index);
  const previous = cycleItem(index - 1);
  const next = cycleItem(index + 1);

  return {
    index: item.index,
    ordinal: item.ordinal,
    name: item.name,
    stem: {
      name: item.stem.name,
      yinYang: item.stem.yinYang,
      element: item.stem.element,
      phase: item.stemIndex + 1,
      period: 10
    },
    branch: {
      name: item.branch.name,
      yinYang: item.branch.yinYang,
      element: item.branch.element,
      phase: item.branchIndex + 1,
      period: 12
    },
    previous: { name: previous.name, ordinal: previous.ordinal },
    next: { name: next.name, ordinal: next.ordinal }
  };
}

export function ganzhiInspectorModel(pillar, name) {
  const key = normalizeGanzhiPillar(pillar);
  if (!key) return null;
  const reference = sexagenaryReferenceByName(name);
  if (!reference) return null;
  return {
    pillar: key,
    pillarLabel: GANZHI_PILLARS[key].label,
    stateId: GANZHI_PILLARS[key].stateId,
    ...reference
  };
}
