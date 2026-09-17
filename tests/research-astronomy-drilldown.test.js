import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css] = await Promise.all([
  readFile(new URL("../src/research-astronomy-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-astronomy-drilldown.css", import.meta.url), "utf8")
]);

test("astronomy progressive disclosure keeps three closed native drilldowns", () => {
  for (const id of ["astronomy-residual-detail", "month-boundary-detail", "near-recurrence-detail"]) {
    assert.match(view, new RegExp(`makeDetails\\(\\"${id}\\"`));
  }
  assert.doesNotMatch(view, /\.open\s*=|setAttribute\(\s*["']open["']/);
});

test("headline astronomy metrics stay outside while diagnostics move under detail", () => {
  assert.match(view, /\[\.\.\.panel\.children\]\.slice\(1\)/);
  assert.match(view, /detail\.append\(meta, termGrid\)/);
  assert.doesNotMatch(view, /panel\.children\]\.slice\(0\)/);
});

test("month boundary keeps summary stats and moves only prose and deep evidence", () => {
  for (const token of [
    'copy?.querySelector("p")',
    'panel.querySelector(".pillar-impact-strip")',
    'panel.querySelector(".full-pillar-attribution")',
    'panel.querySelector("#month-boundary-window-grid")'
  ]) assert.ok(view.includes(token), `missing ${token}`);
  assert.match(view, /heading\.textContent\s*=\s*"交節分歧窗口"/);
  assert.doesNotMatch(view, /month-boundary-exposure-hours.*appendChild/s);
});

test("near recurrence summary remains visible while chart and ranking body drill down", () => {
  assert.match(view, /panel\?\.querySelector\("\.near-search-body"\)/);
  assert.match(view, /detail\.appendChild\(body\)/);
  assert.doesNotMatch(view, /near-search-head.*appendChild/s);
});

test("drilldowns render as flat rails rather than new cards", () => {
  assert.match(css, /\.research-astronomy-drilldown\s*\{[\s\S]*?border\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.match(css, /\.astronomy-panel\s*\{[\s\S]*?border-radius\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.doesNotMatch(css, /\.research-astronomy-drilldown\s*\{[\s\S]*?border-radius\s*:/);
});
