import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, discreteView, astronomyView, nearView, residualView, determinacyView, dayHourView, evidenceView] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-astronomy-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/near-recurrence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/astronomical-residuals-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/day-hour-proof-chain-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-evidence-drilldown-view.js", import.meta.url), "utf8")
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

  assert.match(residualView, /相位窗口 \\$\\{exposure\\.yearPercent.*非人口機率/);\n  assert.match(residualView, /模型不可用/);
  assert.match(residualView, /年／月柱邊界/);\n  assert.match(residualView, /僅月柱 · 11 節/);\n  assert.match(residualView, /年柱＋月柱 · 立春/);\n  assert.match(residualView, /astronomy-rms-residual", `\\$\\{result\\.rmsHours\\.toFixed\\(2\\)\\} h`/);\n  assert.doesNotMatch(residualView, /BaZi pillar-boundary exposure|Month only ·|Year \\+ Month ·|h RMS|model unavailable|% of normalized year/);\n
  assert.match(determinacyView, /年柱＋月柱可隔離 · 日柱＋時柱未解/);
  assert.doesNotMatch(determinacyView, /Year \+ Month 可隔離 · Day \+ Hour 未解/);
});


test("Research evidence verdicts use product language while canonical contracts stay untouched", () => {
  for (const text of [
    "目標時刻 / 日界 / 計時基準 / 經度 · 研究約定",
    "第一個硬阻塞",
    "日柱證明",
    "時柱證明",
    "目標年 / 結論",
    "地方鐘面／時區約定",
    "地方時計時基準",
    "均時差（Equation of Time）",
    "已解析",
    "仍阻塞",
    "無阻塞"
  ]) assert.ok(dayHourView.includes(text), `missing Research evidence label: ${text}`);

  for (const stale of [
    "Target / Day boundary / Clock basis / Longitude · research conventions",
    "<span>First hard blocker</span>",
    "<span>Day proof</span>",
    "<span>Hour proof</span>",
    "<span>Target / verdict</span>",
    "<label>Target local clock",
    "<label>Fixed offset from UT1",
    "<option value=\"\">Not selected</option>",
    '"無 blocker"'
  ]) assert.ok(!dayHourView.includes(stale), `stale evidence product copy returned: ${stale}`);

  assert.match(evidenceView, /\$\{count \|\| 11\} 層 · 展開看逐層證據/);
  assert.match(evidenceView, /\$\{count\} 個來源 · 展開看能力邊界/);
  assert.doesNotMatch(evidenceView, /stages ·|sources ·|展開看 coverage/);
});
