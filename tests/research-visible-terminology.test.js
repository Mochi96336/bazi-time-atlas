import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, discreteView, astronomyView, nearView, residualView, determinacyView, dayHourView, evidenceView, timeView, timeState, absoluteView] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-astronomy-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/near-recurrence-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/astronomical-residuals-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/day-hour-proof-chain-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-evidence-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-time-state-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research/research-time-state.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-absolute-boundary-consequence-view.js", import.meta.url), "utf8")
]);

test("Research product labels use Chinese while canonical research terms stay recognizable", () => {
  for (const text of [
    "先看局部重遇缺哪一層，再把條件補滿",
    "共同追蹤：太陽年",
    "十二節／八字月序",
    "用 Δ 驗算",
    "其他時間",
    "超出滑桿範圍",
    "公曆結構",
    "60 年序",
    "60 日序",
    "季節形狀 · 春分歸零",
    "季節相位 · 公曆框架",
    "軌道參數",
    "視覺尺度",
    "固定 +24,000 · 同一太陽黃經",
    "季節形狀最大值 → RMS",
    "最大絕對值 / RMS",
    "搜尋最佳",
    "搜尋最佳殘差",
    "研究時間",
    "年序／日序",
    "離散推導",
    "節界校驗",
    "四柱結論",
    "固定推進 24,000 個公曆年"
  ]) assert.ok(html.includes(text), `missing visible Research label: ${text}`);

  for (const stale of [
    "Time displacement",
    "位移 Δ",
    "其他位移",
    "Deep exact candidate",
    "深時間 exact 候選",
    "Gregorian frame",
    "Year sequence",
    "Day sequence",
    "Strongest supported claim",
    "Solar-term shape residual",
    "Orbital parameters",
    "Visual scale",
    "max residual → RMS",
    "max absolute / RMS",
    "Research time",
    "Year / Day cycles",
    "Discrete derivation",
    "Seasonal check",
    "Four-pillar recurrence",
    "<span>Year</span>",
    "<span>Month</span>",
    "<span>Day</span>",
    "<span>Hour</span>",
    "Gregorian years"
  ]) assert.ok(!html.includes(stale), `stale product copy returned: ${stale}`);
});

test("Research presentation layers do not reintroduce prototype English copy", () => {
  assert.match(discreteView, /六十干支圖/);
  assert.match(discreteView, /10 天干 × 12 地支 → 60 配對/);
  assert.doesNotMatch(discreteView, /展開看相位|相位明細|個候選 · 公曆結構 \/ 60 年序 \/ 60 日序|展開看 phase| candidates · /);

  assert.match(astronomyView, /headlineLabel\.textContent = "季節形狀 RMS"/);
  assert.match(astronomyView, /maxLabel\.textContent = "最大形狀殘差"/);
  assert.match(astronomyView, /只看季節形狀的交節窗口明細/);
  assert.doesNotMatch(astronomyView, /RMS residual|Max residual|shape-only/);

  assert.match(nearView, /最大 \$\{candidate\.maxAbsHours/);
  assert.match(nearView, /模型不可用/);
  assert.doesNotMatch(nearView, /model unavailable/);

  assert.match(residualView, /相位窗口 \$\{exposure\.yearPercent.*非人口機率/);
  assert.match(residualView, /模型不可用/);
  assert.match(residualView, /年／月柱邊界/);
  assert.match(residualView, /僅月柱 · 11 節/);
  assert.match(residualView, /年柱＋月柱 · 立春/);
  assert.match(residualView, /astronomy-rms-residual", \`\$\{result\.rmsHours\.toFixed\(2\)\} h\`/);
  assert.doesNotMatch(residualView, /BaZi pillar-boundary exposure|Month only ·|Year \+ Month ·|h RMS|model unavailable|% of normalized year/);

  assert.match(determinacyView, /年柱＋月柱可隔離 · 日柱＋時柱未解/);
  assert.match(determinacyView, /一般 Δ 探索仍使用春分共同歸零後的季節形狀比較/);
  assert.doesNotMatch(determinacyView, /Year \+ Month 可隔離 · Day \+ Hour 未解|shape-only|Δ explorer/);

  assert.match(timeView, /26026 太陽位置到達 · TT/);
  assert.match(timeView, /固定推進 24,000 個公曆年/);
  assert.doesNotMatch(timeView, /26026 crossing|Gregorian years/);

  assert.match(timeState, /2026 同一太陽黃經時刻已確定投影/);
  assert.match(timeState, /地球自轉／民用時間資料/);
  assert.doesNotMatch(timeState, /2026 crossing|TT crossing|Earth-rotation \/ civil-time bridge/);

  assert.match(absoluteView, /研究結論 · 01 → 02 → 03/);
  assert.doesNotMatch(absoluteView, /Research conclusion/);
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