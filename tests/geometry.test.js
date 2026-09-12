import test from "node:test";
import assert from "node:assert/strict";
import { solarTerms, baziMonths, seasons, zodiacSigns } from "../src/data.js";
import { clockwiseSpan, midpointAngle, containsAngle } from "../src/geometry.js";

test("24 solar terms are 15° apart", () => {
  assert.equal(solarTerms.length, 24);
  const angles = solarTerms.map(x => x.longitude);
  for (let i = 0; i < angles.length; i++) assert.equal(clockwiseSpan(angles[i], angles[(i + 1) % angles.length]), 15);
});

test("12 jie terms define BaZi month boundaries", () => {
  const jie = solarTerms.filter(x => x.kind === "jie");
  assert.equal(jie.length, 12);
  assert.deepEqual(jie.map(x => x.name), ["清明","立夏","芒種","小暑","立秋","白露","寒露","立冬","大雪","小寒","立春","驚蟄"]);
});

test("BaZi months are 12 exact 30° sectors", () => {
  assert.equal(baziMonths.length, 12);
  for (const month of baziMonths) assert.equal(clockwiseSpan(month.start, month.end), 30);
  const mao = baziMonths.find(x => x.branch === "卯");
  assert.deepEqual([mao.start, mao.end], [345, 15]);
  assert.equal(midpointAngle(mao.start, mao.end), 0);
  assert.equal(containsAngle(mao.start, mao.end, 0), true);
});

test("traditional seasons start at Li Chun/Li Xia/Li Qiu/Li Dong", () => {
  assert.deepEqual(seasons.map(x => [x.name, x.start, x.end]), [["春",315,45], ["夏",45,135], ["秋",135,225], ["冬",225,315]]);
  for (const season of seasons) assert.equal(clockwiseSpan(season.start, season.end), 90);
});

test("tropical zodiac is twelve 30° sectors beginning at 0°", () => {
  assert.equal(zodiacSigns.length, 12); assert.equal(zodiacSigns[0].name, "白羊"); assert.deepEqual([zodiacSigns[0].start, zodiacSigns[0].end], [0, 30]);
  for (const sign of zodiacSigns) assert.equal(clockwiseSpan(sign.start, sign.end), 30);
});

test("earthly-branch element rhythm is wood wood earth etc", () => {
  assert.deepEqual(baziMonths.map(x => x.element), ["木","木","土","火","火","土","金","金","土","水","水","土"]);
});
