import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cssSource } from "./helpers/css-source.js";
import {
  CYCLE_MILESTONES,
  cyclePhases,
  milestoneSentence,
  nextYearDayReturn,
  sexagenaryName,
  rotationCrossingYear,
  rotationRangeHours
} from "../src/research-reading-figures.js";

// Review 2026-11-21 (research reading v2): every step is question → one
// sentence → a large figure with its controls attached → how to read it → the
// explanation left open. Tools live in the lab after the three answers.
const html = readFileSync(new URL("../recurrence.html", import.meta.url), "utf8");
const css = cssSource("research-reading.css");
const v2 = cssSource("research-reading-v2.css");
const glossaryJs = readFileSync(new URL("../src/research-glossary-inline.js", import.meta.url), "utf8");

function sectionOf(id) {
  const start = html.indexOf(`<section id="${id}"`);
  const next = html.indexOf('\n    <section id="', start + 10);
  return html.slice(start, next > start ? next : undefined);
}

function inOrder(section, markers) {
  const at = markers.map(marker => section.indexOf(marker));
  return { ok: at.every((value, index) => value > 0 && (index === 0 || value > at[index - 1])), at };
}

test("each Research step reads: plain conclusion, its figure, how to read it, then the open explanation", () => {
  const discrete = inOrder(sectionOf("research-discrete"), ['data-plain-conclusion="01"', 'id="research-cycle-fan"', 'class="cycle-fan-choices"', 'class="cycle-fan-stage"', 'data-figure-howto="01"', 'class="research-discrete-mechanism"']);
  assert.ok(discrete.ok, `01 order: ${discrete.at}`);
  const astronomy = inOrder(sectionOf("research-astronomy"), ['data-plain-conclusion="02"', 'id="seasonal-boundary-proof-svg"', 'data-figure-howto="02"', 'id="seasonal-drift-method"', 'id="research-drift-accumulation"', 'id="seasonal-drift-orbit-details"', 'id="near-recurrence-disclosure"']);
  assert.ok(astronomy.ok, `02 order: ${astronomy.at}`);
  const evidence = inOrder(sectionOf("research-evidence"), ['data-plain-conclusion="03"', 'id="research-rotation-uncertainty"', 'class="determinacy-grid"', 'data-figure-howto="03"', 'id="research-evidence-why"']);
  assert.ok(evidence.ok, `03 order: ${evidence.at}`);
});

test("reading sections keep explanations open: at most two disclosures each, none in 01", () => {
  const count = id => (sectionOf(id).match(/<details[\s>]/g) ?? []).length;
  assert.equal(count("research-discrete"), 0);
  assert.ok(count("research-astronomy") <= 2, `02 has ${count("research-astronomy")} disclosures`);
  assert.ok(count("research-evidence") <= 1, `03 has ${count("research-evidence")} disclosures`);
  assert.match(html, /<div id="seasonal-drift-orbit-details" class="seasonal-drift-orbit-details research-why-figure">/);
  assert.match(html, /<div id="research-evidence-why" class="research-evidence-why">/);
  assert.match(html, /<p class="research-model-scope" id="seasonal-drift-method">/);
});

test("the lab leads with the same cycle fan, its controls right above it, then one researcher-tools disclosure", () => {
  const lab = sectionOf("research-lab");
  const order = inOrder(lab, ['id="research-lab-fan"', 'class="lab-fan-controls"', 'id="lab-fan-start"', 'id="lab-fan-years"', 'id="lab-fan-slider"', 'data-lab-jump="next"', 'class="cycle-fan-stage"', 'id="lab-fan-sentence"', 'id="research-sexagenary-cycle"', 'id="research-lab-tools"', 'id="recurrence-instrument"', 'class="research-entry"', 'id="research-discrete-tools"', 'id="research-lab-evidence"', 'id="secondary-astronomy-tools"']);
  assert.ok(order.ok, `lab order: ${order.at}`);
  const instrumentEnd = lab.indexOf("</section>", lab.indexOf('id="recurrence-instrument"'));
  assert.match(lab.slice(instrumentEnd, instrumentEnd + 80), /<\/section>\s*<div class="research-entry"/);
  assert.match(html, /<div id="research-discrete-tools" class="research-discrete-tools">/);
  assert.match(lab, /<details id="research-lab-tools" class="research-lab-tools">\s*<summary><strong>研究者工具<\/strong>/);
  assert.ok(html.indexOf('id="research-lab"') > html.indexOf('id="research-evidence"'));
  assert.ok(html.indexOf('id="research-lab"') < html.indexOf('id="research-glossary"'));
});

test("01 fan: four milestones, each closing a different pair, 24,000 closing all three", () => {
  assert.deepEqual([...CYCLE_MILESTONES], [1200, 1980, 8000, 24000]);
  const offsets = years => { const p = cyclePhases(years); return [p.year.offset, p.day.offset, p.gregorian.offset]; };
  assert.deepEqual(offsets(1200), [0, -9, 0]);
  assert.deepEqual(offsets(1980), [0, 0, -20]);
  assert.deepEqual(offsets(8000), [20, 0, 0]);
  assert.deepEqual(offsets(24000), [0, 0, 0]);
  assert.equal(milestoneSentence(cyclePhases(1980)), "1,980 年後：年柱、日柱回到起點，但公曆還差 20 年。");
  assert.equal(milestoneSentence(cyclePhases(8000)), "8,000 年後：公曆、日柱回到起點，但年柱多走了 20 年。");
  for (const years of CYCLE_MILESTONES) assert.match(html, new RegExp(`data-cycle-milestone="${years}"`));
});

test("the fan's rings carry real 干支 and the year+day return depends on the start date", () => {
  const p = cyclePhases(1200);
  assert.equal(sexagenaryName(p.year.from), "丙午");
  assert.equal(sexagenaryName(p.day.from), "庚寅");
  assert.equal(sexagenaryName(p.day.to), "辛巳");
  assert.equal(sexagenaryName(cyclePhases(8000).year.to), "丙寅");
  assert.equal(nextYearDayReturn(), 1980);
  const returns = new Set();
  for (let year = 1; year <= 4000; year += 7) returns.add(nextYearDayReturn({ year, month: 1, day: 15 }));
  assert.ok(returns.size > 1, "the first year+day return must vary with the start date");
  for (const years of [1200, 8000, 24000]) {
    assert.equal(cyclePhases(years, { year: 1931, month: 5, day: 2 }).gregorian.offset, 0);
  }
  assert.equal(cyclePhases(24000, { year: 1931, month: 5, day: 2 }).day.offset, 0);
});

test("03 rotation figure: the 1σ ΔT range passes one double-hour, then one day, before 26026", () => {
  assert.equal(rotationCrossingYear(2), 3500);
  assert.equal(rotationCrossingYear(24), 8000);
  const endDays = rotationRangeHours(26026) / 2 / 24;
  assert.ok(endDays > 6 && endDays < 8, `±${endDays} days at 26026`);
  assert.match(html, /1σ，約 68% 的把握/);
  assert.match(html, /<script type="module" src="\.\/src\/research-reading-figures\.js"><\/script>/);
});

test("02 keeps its model caveat and states the result as a model result", () => {
  assert.match(html, /data-plain-conclusion="02">沒有。用深時間天文模型推算/);
  assert.match(html, /26026 年的框架還沒有獨立驗證，所以是模型推算，不是實測/);
  assert.doesNotMatch(html, /用真實天文計算檢查/);
});

test("03 groups the four pillar cards by cause instead of repeating the verdict", () => {
  assert.match(css, /#research-evidence \.determinacy-grid::before \{\s*content: "只看太陽走到哪 → 算得出來";/);
  assert.match(css, /#research-evidence \.determinacy-grid::after \{\s*content: "還要知道地球轉到哪一刻 → 算不準";/);
  assert.doesNotMatch(html, /id="pillar-proof-flow"/);
});

test("glossary terms open their definition in place and keep the jump link without JS", () => {
  const terms = [...html.matchAll(/<a class="research-term" href="#(term-[a-z-]+)">/g)].map(match => match[1]);
  assert.ok(terms.length >= 6, `expected at least six first-use glossary links, got ${terms.length}`);
  for (const id of new Set(terms)) assert.match(html, new RegExp(`<div id="${id}"><dt>`), `missing glossary entry ${id}`);
  assert.match(html, /<script type="module" src="\.\/src\/research-glossary-inline\.js"><\/script>/);
  assert.match(glossaryJs, /event\.preventDefault\(\);/);
  assert.match(glossaryJs, /note\.setAttribute\("role", "note"\)/);
  assert.match(glossaryJs, /link\.setAttribute\("aria-expanded", "true"\)/);
});

test("the opening answers in one sentence, then a to-scale overview, then three chapter links", () => {
  assert.match(html, /class="lede research-answer">目前找不到<a class="research-term" href="#term-pillars">四柱<\/a>完整重複的週期。<\/p>/);
  assert.ok(html.indexOf('id="research-overview"') < html.indexOf('class="research-outline research-answer-map"'));
  assert.match(html, /data-stop="local" style="--x:8\.25%"/);
  assert.equal((html.match(/data-research-spine="/g) ?? []).length, 3);
  assert.doesNotMatch(html, /research-alignment-map/);
});

test("rhythm comes from spacing tokens, without !important", () => {
  assert.match(v2, /--rv2-section-gap: 200px;/);
  assert.match(v2, /--rv2-body: 17px;/);
  assert.match(v2, /\.recurrence-shell \.research-task \{ background: none; \}/);
  assert.doesNotMatch(v2, /!important/);
});

test("phase-fan labels are not drawn at unreadable sizes on phones", () => {
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 480px)"));
  assert.match(mobile, /#recurrence-wheel text \{ display: none; \}/);
});
