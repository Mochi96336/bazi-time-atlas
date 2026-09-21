import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../src/atlas-solar-time-analysis.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../atlas-solar-time-analysis.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../desktop-tools-workspace.css", import.meta.url), "utf8");

test("Solar Time presents pillar result before comparison rows and correction math", () => {
  const verdict = view.indexOf('class="atlas-solar-verdict"');
  const rows = view.indexOf('id="atlas-solar-basis-rows"');
  const calculation = view.indexOf('class="atlas-solar-calculation-head"');
  const corrections = view.indexOf('class="atlas-solar-corrections"');
  const meta = view.indexOf('id="atlas-solar-analysis-meta"');
  assert.ok(verdict >= 0 && verdict < rows && rows < calculation && calculation < corrections && corrections < meta);
  assert.match(view, /atlas-solar-verdict[\s\S]*id="atlas-solar-sensitivity-summary"/);
  assert.match(view, /<span>柱位結果<\/span>/);
  assert.match(view, /<span>校正值<\/span>[\s\S]*<small>計算檢查<\/small>/);
});

test("Solar Time result rail has no 7px or 8px information text", () => {
  assert.doesNotMatch(css, /font-size:\s*(?:7|8)px/);
  assert.doesNotMatch(workspace, /atlas-solar[\s\S]{0,260}?font-size:\s*(?:7|8)px/);
  assert.match(css, /\.atlas-solar-verdict > strong[\s\S]*font-size:\s*13px/);
  assert.match(css, /\.atlas-solar-basis-row > span small[\s\S]*font-size:\s*9px/);
  assert.match(css, /\.atlas-solar-analysis-meta[\s\S]*font-size:\s*9px/);
});

test("Solar Time header asks the user-facing question instead of leading with implementation jargon", () => {
  assert.match(view, /<strong>太陽時<\/strong>/);
  assert.match(view, /輸入經度，檢查日柱／時柱是否因時計基準跨界。/);
  assert.doesNotMatch(view, /<strong>太陽時比較<\/strong>/);
});


test("Solar Time is an explicit Tools action while explicit lon remains shareable intent", () => {
  assert.match(view, /toolButton\.id = "solar-time-tool-button"/);
  assert.match(view, /toolButton\.textContent = "太陽時"/);
  assert.match(view, /let toolActive = initial\.raw\.trim\(\) !== ""/);
  assert.match(view, /panel\.hidden = !\(analysisOpen && toolActive\)/);
  assert.match(view, /atlas-solar-time-entering/);
  assert.match(view, /classificationButton\?\.getAttribute\("aria-pressed"\) === "true"/);
  assert.match(view, /atlas-find-time-entering/);
});
