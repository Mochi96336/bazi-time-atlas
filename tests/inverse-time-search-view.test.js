import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatInverseMatchPillars } from "../src/inverse-time-search-view.js";

const view = readFileSync(new URL("../src/inverse-time-search-view.js", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../inverse-time-search.css", import.meta.url), "utf8");

test("Atlas exposes reverse search as a real four-pillar action", () => {
  assert.match(view, /button\.textContent = "找時間"/);
  assert.match(view, /searchInversePillarIntervals/);
  assert.match(view, /data-inverse-pillar="\$\{id\}"/);
  for (const id of ["year", "month", "day", "hour"]) {
    assert.match(view, new RegExp(`${id}:instrument\\.dataset\\.${id}Pillar`));
  }
  assert.match(view, /至少鎖定一柱/);
});

test("search results jump Atlas to a real Selected Instant", () => {
  assert.match(view, /SELECTED_INSTANT_COMMAND/);
  assert.match(view, /source:"inverse-time-search"/);
  assert.match(view, /Math\.round\(match\.startMs/);
  assert.doesNotMatch(view, /manualOffset|compareMode|setModelRotation/);
});

test("wildcard results describe only the pillars the solver actually claims", () => {
  assert.equal(formatInverseMatchPillars({ day:{ name:"甲子" } }), "日 甲子");
  assert.equal(
    formatInverseMatchPillars({ year:{ name:"丙午" }, hour:{ name:"甲辰" } }),
    "年 丙午 · 時 甲辰"
  );
  assert.doesNotMatch(view, /match\.pillars\.year\.name/);
});

test("inverse search fails closed instead of inventing time authority", () => {
  assert.match(view, /Selected Instant is unavailable/);
  assert.doesNotMatch(view, /Date\.now\(\)/);
  assert.doesNotMatch(view, /DEFAULT_ATLAS_TIME_CONTEXT/);
  assert.match(view, /時間基準已變更，請重新搜尋/);
});

test("inverse search range changes candidate bounds rather than wheel emphasis", () => {
  assert.match(view, /month:Object\.freeze\(\{ label:"前後 30 日"/);
  assert.match(view, /year:Object\.freeze\(\{ label:"前後 1 年"/);
  assert.match(view, /fiveYear:Object\.freeze\(\{ label:"前後 5 年"/);
  assert.match(view, /startMs:selectedMs - range\.spanMs/);
  assert.match(view, /endMs:selectedMs \+ range\.spanMs/);
});

test("find-time replaces Free Compare as the product entry without deleting its engine", () => {
  assert.match(view, /querySelector\("#compare-rings-button"\)/);
  assert.match(view, /compareButton\.hidden = true/);
  assert.match(view, /compareButton\.dataset\.productEntry = "retired"/);
  assert.doesNotMatch(view, /remove\(\).*compare-rings-button/s);
});

test("Analysis bootstrap installs the inverse search without adding static page chrome", () => {
  assert.match(analysis, /installInverseTimeSearch/);
  assert.match(analysis, /inverse-time-search\.css/);
  assert.match(analysis, /installInverseTimeSearch\(instrument\)/);
});

test("inverse search presentation stays a flat rail instead of another card", () => {
  assert.match(css, /\.inverse-time-search-panel \{[\s\S]*?border-top:/);
  assert.doesNotMatch(css, /\.inverse-time-search-panel \{[^}]*border-radius:/s);
  assert.doesNotMatch(css, /\.inverse-time-search-panel \{[^}]*background:/s);
  assert.match(css, /\.inverse-search-result \{[\s\S]*?background:\s*transparent;/);
});
