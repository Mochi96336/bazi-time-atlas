import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { visibleStemTenGodState } from "../src/atlas-visible-ten-gods.js";

const source = await readFile(new URL("../src/atlas-visible-ten-gods.js", import.meta.url), "utf8");
const analysisMode = await readFile(new URL("../src/analysis-mode.js", import.meta.url), "utf8");
const css = await readFile(new URL("../atlas-visible-ten-gods.css", import.meta.url), "utf8");

test("visible stem Ten Gods are derived from the Atlas-resolved four pillars", () => {
  const state = visibleStemTenGodState({
    yearPillar: "乙酉",
    monthPillar: "戊子",
    dayPillar: "辛巳",
    hourPillar: "壬辰"
  });

  assert.equal(state.dayMaster, "辛");
  assert.deepEqual(
    state.entries.map(entry => [entry.key, entry.pillar, entry.tenGod]),
    [
      ["year", "乙酉", "偏財"],
      ["month", "戊子", "正印"],
      ["day", "辛巳", "日主"],
      ["hour", "壬辰", "傷官"]
    ]
  );
});

test("visible stem projection fails closed for incomplete or malformed pillar diagnostics", () => {
  assert.equal(visibleStemTenGodState(), null);
  assert.equal(visibleStemTenGodState({
    yearPillar: "乙酉",
    monthPillar: "戊子",
    dayPillar: "辛巳",
    hourPillar: ""
  }), null);
  assert.equal(visibleStemTenGodState({
    yearPillar: "乙酉",
    monthPillar: "not-a-pillar",
    dayPillar: "辛巳",
    hourPillar: "壬辰"
  }), null);
});

test("Analysis projection reads the canonical instrument diagnostics instead of owning time state", () => {
  for (const diagnostic of ["yearPillar", "monthPillar", "dayPillar", "hourPillar"]) {
    assert.match(source, new RegExp(`instrument\\.dataset\\.${diagnostic}`));
  }
  assert.match(source, /tenGodForStem\(dayMaster, stem\)/);
  assert.doesNotMatch(source, /resolveBirthPillars|birth-form|instantFromAtlasLocalInput|Date\.UTC/);
  assert.doesNotMatch(source, /addEventListener\(["'](?:input|change)["']/);
});

test("visible stem analysis is installed by Analysis mode and hidden outside it", () => {
  assert.match(analysisMode, /installAtlasVisibleTenGods\(instrument\)/);
  assert.match(source, /stylesheet\.href = "\.\/atlas-visible-ten-gods\.css"/);
  assert.match(source, /panel\.hidden = !analysisOpen \|\| state === null/);
  assert.match(css, /\.atlas-visible-ten-gods\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /\.atlas-visible-ten-gods-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});


test("mobile Tools keeps Four Pillars as one compact inspector rail", () => {
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.atlas-visible-ten-gods \{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*58px;[\s\S]*?left:\s*9px;[\s\S]*?right:\s*9px;/
  );
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.atlas-visible-ten-gods-grid \{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(
    css,
    /@media \(max-width: 480px\) \{[\s\S]*?\.atlas-visible-ten-gods-cell \{[\s\S]*?min-height:\s*42px;[\s\S]*?grid-template-columns:\s*1fr;/
  );
  assert.match(css, /\.atlas-visible-ten-gods-note \{\s*display:\s*none;/);
});
