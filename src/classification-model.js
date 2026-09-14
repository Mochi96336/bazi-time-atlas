import { earthlyBranches, heavenlyStems, cycleItem } from "./sexagenary-data.js";
import { zodiacSigns } from "./data.js";

export const FIVE_ELEMENTS = Object.freeze(["木", "火", "土", "金", "水"]);
export const ZODIAC_ELEMENTS = Object.freeze(["火", "土", "風", "水"]);
export const ZODIAC_MODALITIES = Object.freeze(["基本", "固定", "變動"]);

const stemByName = new Map(heavenlyStems.map(stem => [stem.name, stem]));
const branchByName = new Map(earthlyBranches.map(branch => [branch.name, branch]));
const zodiacByName = new Map(zodiacSigns.map(sign => [sign.name, sign]));

export function pillarClassification(name) {
  if (typeof name !== "string" || name.length < 2) return null;
  const stem = stemByName.get(name[0]);
  const branch = branchByName.get(name[1]);
  if (!stem || !branch) return null;
  return {
    name: `${stem.name}${branch.name}`,
    stemElement: stem.element,
    stemYinYang: stem.yinYang,
    branchElement: branch.element,
    branchYinYang: branch.yinYang
  };
}

export function cycleClassification(index) {
  const item = cycleItem(index);
  return {
    index: item.index,
    name: item.name,
    stemElement: item.stem.element,
    stemYinYang: item.stem.yinYang,
    branchElement: item.branch.element,
    branchYinYang: item.branch.yinYang
  };
}

export function zodiacClassification(nameOrIndex) {
  const sign = Number.isInteger(nameOrIndex)
    ? zodiacSigns[((nameOrIndex % zodiacSigns.length) + zodiacSigns.length) % zodiacSigns.length]
    : zodiacByName.get(nameOrIndex);
  if (!sign) return null;
  return {
    name: sign.name,
    element: sign.element,
    modality: sign.modality,
    start: sign.start,
    end: sign.end
  };
}
