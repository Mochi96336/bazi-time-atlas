import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../recurrence.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../research-reading.css", import.meta.url), "utf8");
const glossaryJs = readFileSync(new URL("../src/research-glossary-inline.js", import.meta.url), "utf8");

function sectionOf(id) {
  const start = html.indexOf(`<section id="${id}"`);
  const next = html.indexOf('\n    <section id="', start + 10);
  return html.slice(start, next > start ? next : undefined);
}

test("each Research section reads: plain conclusion, one figure, a reading line, then optional depth", () => {
  const discrete = sectionOf("research-discrete");
  const order01 = ['data-plain-conclusion="01"', 'class="research-entry"', 'id="recurrence-instrument"', 'class="research-figure-howto"', 'class="research-discrete-mechanism"', 'id="research-discrete-tools"'];
  const at01 = order01.map(marker => discrete.indexOf(marker));
  assert.ok(at01.every((value, index) => value > 0 && (index === 0 || value > at01[index - 1])), `01 order: ${at01}`);

  const astronomy = sectionOf("research-astronomy");
  const order02 = ['data-plain-conclusion="02"', 'id="seasonal-boundary-proof-svg"', 'data-figure-howto="02"', 'id="seasonal-drift-method"', 'id="research-drift-accumulation"', 'id="seasonal-drift-orbit-details"', 'id="near-recurrence-disclosure"'];
  const at02 = order02.map(marker => astronomy.indexOf(marker));
  assert.ok(at02.every((value, index) => value > 0 && (index === 0 || value > at02[index - 1])), `02 order: ${at02}`);

  const evidence = sectionOf("research-evidence");
  const order03 = ['data-plain-conclusion="03"', 'class="determinacy-grid"', 'data-figure-howto="03"', 'id="research-evidence-why"'];
  const at03 = order03.map(marker => evidence.indexOf(marker));
  assert.ok(at03.every((value, index) => value > 0 && (index === 0 || value > at03[index - 1])), `03 order: ${at03}`);
});

test("02 keeps its model caveat and states the result as a model result", () => {
  assert.match(html, /data-plain-conclusion="02">沒有。用深時間天文模型推算/);
  assert.match(html, /class="research-model-scope"><strong>證據範圍：<\/strong>[^<]*尚未獨立驗證/);
  assert.match(html, /01 的選取不會改寫節界證據/);
  assert.doesNotMatch(html, /用真實天文計算檢查/);
});

test("the long-range search and the orbit explanation are optional depth, not the main line", () => {
  assert.match(html, /<details id="near-recurrence-disclosure" class="research-extension near-recurrence-disclosure">[\s\S]*?<section id="near-recurrence-detail"/);
  assert.doesNotMatch(html, /<details id="seasonal-drift-orbit-details"[^>]*\sopen/);
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

test("the opening answer is one sentence plus a three-step route map", () => {
  assert.match(html, /class="lede research-answer">目前找不到/);
  assert.equal((html.match(/data-research-spine="/g) ?? []).length, 3);
  assert.doesNotMatch(html, /research-alignment-map/);
  assert.match(css, /\.research-outline\.research-answer-map::before \{/);
});

test("phase-fan labels are not drawn at unreadable sizes on phones", () => {
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 480px)"));
  assert.match(mobile, /#recurrence-wheel text \{ display: none; \}/);
});
