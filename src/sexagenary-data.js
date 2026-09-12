export const heavenlyStems = [
  { name: "甲", yinYang: "陽", element: "木" },
  { name: "乙", yinYang: "陰", element: "木" },
  { name: "丙", yinYang: "陽", element: "火" },
  { name: "丁", yinYang: "陰", element: "火" },
  { name: "戊", yinYang: "陽", element: "土" },
  { name: "己", yinYang: "陰", element: "土" },
  { name: "庚", yinYang: "陽", element: "金" },
  { name: "辛", yinYang: "陰", element: "金" },
  { name: "壬", yinYang: "陽", element: "水" },
  { name: "癸", yinYang: "陰", element: "水" }
];

export const earthlyBranches = [
  { name: "子", yinYang: "陽", element: "水" },
  { name: "丑", yinYang: "陰", element: "土" },
  { name: "寅", yinYang: "陽", element: "木" },
  { name: "卯", yinYang: "陰", element: "木" },
  { name: "辰", yinYang: "陽", element: "土" },
  { name: "巳", yinYang: "陰", element: "火" },
  { name: "午", yinYang: "陽", element: "火" },
  { name: "未", yinYang: "陰", element: "土" },
  { name: "申", yinYang: "陽", element: "金" },
  { name: "酉", yinYang: "陰", element: "金" },
  { name: "戌", yinYang: "陽", element: "土" },
  { name: "亥", yinYang: "陰", element: "水" }
];

export const sexagenaryCycle = Array.from({ length: 60 }, (_, index) => {
  const stemIndex = index % heavenlyStems.length;
  const branchIndex = index % earthlyBranches.length;
  const stem = heavenlyStems[stemIndex];
  const branch = earthlyBranches[branchIndex];

  return {
    index,
    ordinal: index + 1,
    name: `${stem.name}${branch.name}`,
    stemIndex,
    branchIndex,
    stem,
    branch
  };
});

export function wrapCycleIndex(index) {
  return ((index % sexagenaryCycle.length) + sexagenaryCycle.length) % sexagenaryCycle.length;
}

export function cycleItem(index) {
  return sexagenaryCycle[wrapCycleIndex(index)];
}
