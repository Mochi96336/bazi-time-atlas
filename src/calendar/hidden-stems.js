const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const STEM_META = new Map([
  ["甲", { element: "木", yinYang: "陽" }], ["乙", { element: "木", yinYang: "陰" }],
  ["丙", { element: "火", yinYang: "陽" }], ["丁", { element: "火", yinYang: "陰" }],
  ["戊", { element: "土", yinYang: "陽" }], ["己", { element: "土", yinYang: "陰" }],
  ["庚", { element: "金", yinYang: "陽" }], ["辛", { element: "金", yinYang: "陰" }],
  ["壬", { element: "水", yinYang: "陽" }], ["癸", { element: "水", yinYang: "陰" }]
]);

const TABLE = new Map([
  ["子", ["癸"]],
  ["丑", ["己", "癸", "辛"]],
  ["寅", ["甲", "丙", "戊"]],
  ["卯", ["乙"]],
  ["辰", ["戊", "乙", "癸"]],
  ["巳", ["丙", "戊", "庚"]],
  ["午", ["丁", "己"]],
  ["未", ["己", "丁", "乙"]],
  ["申", ["庚", "壬", "戊"]],
  ["酉", ["辛"]],
  ["戌", ["戊", "辛", "丁"]],
  ["亥", ["壬", "甲"]]
]);

export const HIDDEN_STEM_BRANCHES = Object.freeze([...TABLE.keys()]);
export const HIDDEN_STEM_NAMES = Object.freeze([...STEMS]);

export function hiddenStemsForBranch(branch) {
  const names = TABLE.get(branch);
  if (!names) throw new RangeError(`unknown earthly branch: ${branch}`);
  return names.map((name, index) => ({
    name,
    order: index + 1,
    role: index === 0 ? "主" : index === 1 ? "次" : "餘",
    ...STEM_META.get(name)
  }));
}

export function primaryHiddenStem(branch) {
  return hiddenStemsForBranch(branch)[0];
}
