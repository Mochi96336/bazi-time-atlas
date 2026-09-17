import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatInverseMatchPillars,
  inverseWheelConstraints,
  inverseWheelPillarForOffset
} from "../src/inverse-time-search-view.js";

const view = readFileSync(new URL("../src/inverse-time-search-view.js", import.meta.url), "utf8");
const analysis = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../inverse-time-search.css", import.meta.url), "utf8");

test("find-time is wheel-native instead of a second form UI", () => {
  assert.match(view, /button\.textContent = "找時間"/);
  assert.match(view, /直接轉動年、月、日、時環/);
  assert.match(view, /MutationObserver\(scheduleSearch\)/);
  assert.doesNotMatch(view, /createPanel|data-inverse-pillar|data-inverse-range|SEARCH_RANGES/);
  assert.doesNotMatch(view, /createElement\("select"\)|<select|<input/);
});

test("one snapped wheel tooth maps to the pillar now under the fixed cursor", () => {
  assert.equal(inverseWheelPillarForOffset({ currentPillar:"乙丑", offsetDegrees:6 }), "甲子");
  assert.equal(inverseWheelPillarForOffset({ currentPillar:"乙丑", offsetDegrees:-6 }), "丙寅");
  assert.equal(inverseWheelPillarForOffset({ currentPillar:"甲子", offsetDegrees:360 }), "甲子");
});

test("only moved sexagenary rings become inverse-search constraints", () => {
  const constraints = inverseWheelConstraints({
    pillars:{ year:"丙午", month:"丁酉", day:"甲子", hour:"乙丑" },
    offsets:{ year:0, month:6, day:-12, hour:0 }
  });
  assert.deepEqual(constraints, {
    year:null,
    month:"丙申",
    day:"丙寅",
    hour:null
  });
});

test("wheel query copy describes only the constraints the user actually moved", () => {
  assert.equal(formatInverseMatchPillars({ day:"甲子" }), "日 甲子");
  assert.equal(
    formatInverseMatchPillars({ year:"丙午", hour:{ name:"甲辰" } }),
    "年 丙午 · 時 甲辰"
  );
});

test("find-time reuses Free Compare drag mechanics without restoring Compare as product chrome", () => {
  assert.match(view, /querySelector\("#compare-rings-button"\)/);
  assert.match(view, /compareButton\.hidden = true/);
  assert.match(view, /compareButton\.dataset\.productEntry = "retired"/);
  assert.match(view, /compareButton\.click\(\)/);
  assert.match(css, /#ring-compare-status,[\s\S]*?#reset-rings-button[\s\S]*?display:\s*none\s*!important/);
});

test("inverse search refines slow clocks before fast clocks instead of scanning decades hour-by-hour", () => {
  assert.match(view, /const PILLAR_IDS = Object\.freeze\(\["year", "month", "day", "hour"\]\)/);
  assert.match(view, /for \(const id of activeIds\)/);
  assert.match(view, /constraints:\{ \[id\]:constraints\[id\] \}/);
  assert.match(view, /SEARCH_STAGE_MAX_RESULTS/);
});

test("search result applies one real Selected Instant and leaves authority fail-closed", () => {
  assert.match(view, /SELECTED_INSTANT_COMMAND/);
  assert.match(view, /source:"inverse-wheel-search"/);
  assert.match(view, /Selected Instant is unavailable/);
  assert.doesNotMatch(view, /Date\.now\(\)/);
  assert.doesNotMatch(view, /DEFAULT_ATLAS_TIME_CONTEXT/);
  assert.match(view, /時間基準已變更/);
});

test("solar band stays context rather than becoming a fake fifth inverse constraint", () => {
  assert.match(view, /找時間只轉年、月、日、時四個干支環/);
  assert.match(view, /isSolarBandPointer/);
  assert.doesNotMatch(view, /constraints[^\n]*solar/);
});

test("Analysis bootstrap still installs find-time, but the visible disclosure is relabeled Tools", () => {
  assert.match(analysis, /installInverseTimeSearch/);
  assert.match(analysis, /inverse-time-search\.css/);
  assert.match(view, /open\.textContent = "工具"/);
  assert.match(view, /close\.textContent = "完成"/);
  assert.match(css, /content:\s*"工具 · "/);
});

test("ordinary reading never shows the find-time entry", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #inverse-time-search-button\s*\{[\s\S]*?display:\s*none\s*!important/
  );
});
