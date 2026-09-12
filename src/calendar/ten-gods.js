const STEM_META = new Map([
  ["甲", { element: "木", yinYang: "陽" }], ["乙", { element: "木", yinYang: "陰" }],
  ["丙", { element: "火", yinYang: "陽" }], ["丁", { element: "火", yinYang: "陰" }],
  ["戊", { element: "土", yinYang: "陽" }], ["己", { element: "土", yinYang: "陰" }],
  ["庚", { element: "金", yinYang: "陽" }], ["辛", { element: "金", yinYang: "陰" }],
  ["壬", { element: "水", yinYang: "陽" }], ["癸", { element: "水", yinYang: "陰" }]
]);

const GENERATES = new Map([
  ["木", "火"], ["火", "土"], ["土", "金"], ["金", "水"], ["水", "木"]
]);

const CONTROLS = new Map([
  ["木", "土"], ["土", "水"], ["水", "火"], ["火", "金"], ["金", "木"]
]);

const NAMES = Object.freeze({
  peer: Object.freeze({ same: "比肩", opposite: "劫財" }),
  output: Object.freeze({ same: "食神", opposite: "傷官" }),
  wealth: Object.freeze({ same: "偏財", opposite: "正財" }),
  officer: Object.freeze({ same: "七殺", opposite: "正官" }),
  resource: Object.freeze({ same: "偏印", opposite: "正印" })
});

const GROUP_LABELS = Object.freeze({
  peer: "同我",
  output: "我生",
  wealth: "我剋",
  officer: "剋我",
  resource: "生我"
});

export const HEAVENLY_STEMS = Object.freeze([...STEM_META.keys()]);
export const TEN_GOD_NAMES = Object.freeze([
  "比肩", "劫財", "食神", "傷官", "偏財", "正財", "七殺", "正官", "偏印", "正印"
]);

export function heavenlyStemMeta(stem) {
  const meta = STEM_META.get(stem);
  if (!meta) throw new RangeError(`unknown heavenly stem: ${stem}`);
  return { name: stem, ...meta };
}

function relationGroup(dayElement, otherElement) {
  if (dayElement === otherElement) return "peer";
  if (GENERATES.get(dayElement) === otherElement) return "output";
  if (CONTROLS.get(dayElement) === otherElement) return "wealth";
  if (CONTROLS.get(otherElement) === dayElement) return "officer";
  if (GENERATES.get(otherElement) === dayElement) return "resource";
  throw new RangeError(`unresolved Five-Phase relation: ${dayElement}/${otherElement}`);
}

/**
 * Resolve one heavenly stem's Ten-God relationship relative to the Day Master.
 *
 * This is structural classification only: Five-Phase direction first, then
 * same/opposite yin-yang. It does not calculate strength, auspiciousness,
 * personality, events, or any weighting of visible versus hidden stems.
 */
export function tenGodForStem(dayMasterStem, otherStem) {
  const day = heavenlyStemMeta(dayMasterStem);
  const other = heavenlyStemMeta(otherStem);
  const group = relationGroup(day.element, other.element);
  const samePolarity = day.yinYang === other.yinYang;
  const name = NAMES[group][samePolarity ? "same" : "opposite"];

  return {
    name,
    group,
    groupLabel: GROUP_LABELS[group],
    samePolarity,
    dayMaster: day,
    other
  };
}
