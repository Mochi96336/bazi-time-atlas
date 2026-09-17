import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [hostView, drilldownView, css] = await Promise.all([
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8"),
  readFile(new URL("../src/research-evidence-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-evidence-drilldown.css", import.meta.url), "utf8")
]);

test("four-pillar evidence loads the presentation-only drilldown layer", () => {
  assert.match(hostView, /import "\.\/research-evidence-drilldown-view\.js";/);
});

test("proof stages move behind a closed native details rail while Day Hour summary stays outside", () => {
  assert.match(drilldownView, /details\.id = "proof-chain-evidence-details"/);
  assert.match(drilldownView, /details\.append\(drilldownSummary\("完整證明鏈"[\s\S]*?stages\);/);
  assert.doesNotMatch(drilldownView, /proof-chain-foot[\s\S]*?details\.append/);
  assert.doesNotMatch(drilldownView, /proof-chain-evidence-details[\s\S]*?\.open\s*=\s*true/);
  assert.doesNotMatch(drilldownView, /setAttribute\(["']open["']/);
});

test("source provider cards and source footnote share one closed audit drilldown", () => {
  assert.match(drilldownView, /details\.id = "epoch-audit-evidence-details"/);
  assert.match(drilldownView, /details\.append\(drilldownSummary\("來源能力稽核"[\s\S]*?sources, foot\);/);
  assert.doesNotMatch(drilldownView, /epoch-audit-evidence-details[\s\S]*?\.open\s*=\s*true/);
});

test("drilldowns are flat rails rather than new cards", () => {
  assert.match(css, /\.research-evidence-drilldown\s*\{[\s\S]*?border-top\s*:\s*1px/);
  assert.match(css, /> summary\s*\{[\s\S]*?display\s*:\s*grid[\s\S]*?list-style\s*:\s*none/);
  assert.doesNotMatch(css, /\.research-evidence-drilldown\s*\{[\s\S]*?border-radius/);
  assert.doesNotMatch(css, /\.research-evidence-drilldown\s*\{[\s\S]*?box-shadow/);
});
