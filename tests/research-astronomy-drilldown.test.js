import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css, residualView, residualCss] = await Promise.all([
  readFile(new URL("../src/research-astronomy-drilldown-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-astronomy-drilldown.css", import.meta.url), "utf8"),
  readFile(new URL("../src/astronomical-residuals-view.js", import.meta.url), "utf8"),
  readFile(new URL("../astronomical-residuals.css", import.meta.url), "utf8")
]);

test("astronomy progressive disclosure keeps three closed native drilldowns", () => {
  for (const id of ["astronomy-residual-detail", "month-boundary-detail", "near-recurrence-detail"]) {
    assert.match(view, new RegExp(`makeDetails\\(\\"${id}\\"`));
  }
  assert.doesNotMatch(view, /\.open\s*=|setAttribute\(\s*["']open["']/);
});

test("RMS owns the visible astronomy headline while duplicate max residual moves into detail", () => {
  assert.match(view, /headline\.classList\.add\("research-astronomy-rms-rail"\)/);
  assert.match(view, /headline\.dataset\.astronomyVisibleMetric = "rms"/);
  assert.match(view, /headlineLabel\.textContent = "RMS 殘差"/);
  assert.match(view, /maxMetric\.dataset\.astronomyDetailMetric = "max-residual"/);
  assert.match(view, /maxMetric\.append\(maxLabel, maxResidual\)/);
  assert.match(view, /meta\.appendChild\(maxMetric\)/);
  assert.match(view, /\[\.\.\.panel\.children\]\.slice\(1\)/);
  assert.match(view, /detail\.append\(meta, termGrid\)/);
  assert.doesNotMatch(view, /cloneNode|textContent\s*=\s*maxResidual\.textContent/);
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

test("month-boundary outcome keeps a visible mechanism diagram without duplicating the model", () => {
  assert.match(residualView, /id="boundary-shift-diagram"/);
  assert.match(residualView, /兩條邊界之間＝分歧窗口/);
  assert.match(residualView, /renderBoundaryShiftDiagram\(panel, exposure\)/);
  assert.match(residualView, /exposure\.largestWindow/);
  assert.match(residualView, /exposure\.yearMonthWindow/);
  assert.doesNotMatch(view, /boundary-shift-diagram.*appendChild/s);
  assert.match(residualCss, /\.boundary-shift-diagram\s*\{[\s\S]*grid-column:1 \/ -1/);
  assert.match(residualCss, /\.boundary-shift-window\s*\{[\s\S]*background:/);
});

test("near recurrence summary remains visible while chart and ranking body drill down", () => {
  assert.match(view, /panel\?\.querySelector\("\.near-search-body"\)/);
  assert.match(view, /detail\.appendChild\(body\)/);
  assert.doesNotMatch(view, /near-search-head.*appendChild/s);
});

test("drilldowns and RMS headline render as flat rails rather than new cards", () => {
  assert.match(css, /\.research-astronomy-drilldown\s*\{[\s\S]*?border\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.match(css, /\.astronomy-panel\s*\{[\s\S]*?border-radius\s*:\s*0[\s\S]*?background\s*:\s*transparent/);
  assert.match(css, /\.research-astronomy-rms-rail\s*\{[\s\S]*?grid-template-columns:[^;]+;[\s\S]*?border\s*:\s*0/);
  assert.match(css, /\.astronomy-detail-meta #astronomy-max-residual/);
  assert.doesNotMatch(css, /\.research-astronomy-drilldown\s*\{[\s\S]*?border-radius\s*:/);
  assert.doesNotMatch(css, /\.research-astronomy-rms-rail\s*\{[\s\S]*?box-shadow\s*:/);
});
