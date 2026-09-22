import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, discreteView, astronomyView, nearView, residualView, determinacyView] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-astronomy-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/near-recurrence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/astronomical-residuals-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8")
]);

test("Research product labels use Chinese while canonical research terms stay recognizable", () => {
  for (const text of [
    "時間位移",
    "深時間 exact 候選",
    "公曆骨架",
    "干支年序",
    "干支日序",
    "十二節形狀殘差",
    "軌道參數",
    "視覺尺度",
    "目前可支持的最強結論",
    "最大殘差 → RMS",
    "最大絕對值 / RMS"
  ]) assert.ok(html.includes(text), `missing visible Research label: ${text}`);

  for (const stale of [
    "Time displacement",
    "Deep exact candidate",
    "Gregorian frame",
    "Year sequence",
    "Day sequence",
    "Strongest supported claim",
    "Solar-term shape residual",
    "Orbital parameters",
    "Visual scale",
    "max residual → RMS",
    "max absolute / RMS"
  ]) assert.ok(!html.includes(stale), `stale product copy returned: ${stale}`);
});

test("Research presentation layers do not reintroduce prototype English copy", () => {
  assert.match(discreteView, /展開看相位/);
  assert.match(discreteView, /個候選 · 公曆 \/ 年序 \/ 日序/);
  assert.doesNotMatch(discreteView, /展開看 phase| candidates · /);

  assert.match(astronomyView, /headlineLabel\.textContent = "RMS 殘差"/);
  assert.match(astronomyView, /maxLabel\.textContent = "最大殘差"/);
  assert.doesNotMatch(astronomyView, /RMS residual|Max residual/);

  assert.match(nearView, /最大 \$\{candidate\.maxAbsHours/);
  assert.match(nearView, /模型不可用/);
  assert.doesNotMatch(nearView, /model unavailable/);

  assert.match(residualView, /標準化年 \$\{exposure\.yearPercent/);
  assert.match(residualView, /模型不可用/);
  assert.doesNotMatch(residualView, /model unavailable|% of normalized year/);

  assert.match(determinacyView, /年柱＋月柱可隔離 · 日柱＋時柱未解/);
  assert.doesNotMatch(determinacyView, /Year \+ Month 可隔離 · Day \+ Hour 未解/);
});
