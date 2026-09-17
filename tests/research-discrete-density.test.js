import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [view, css, host] = await Promise.all([
  readFile(new URL("../src/research-discrete-density-view.js", import.meta.url), "utf8"),
  readFile(new URL("../research-discrete-density.css", import.meta.url), "utf8"),
  readFile(new URL("../src/four-pillar-determinacy-view.js", import.meta.url), "utf8")
]);

test("discrete presentation removes duplicate top scope copy", () => {
  assert.match(view, /\.recurrence-intro > \.scope-note/);
  assert.match(view, /\.remove\(\)/);
});

test("milestone table is progressively disclosed without deleting its rows", () => {
  assert.match(view, /document\.createElement\("details"\)/);
  assert.match(view, /details\.id = "discrete-milestone-details"/);
  assert.match(view, /details\.append\(summary, table\)/);
  assert.match(view, /#milestone-rows > \.milestone-row/);
  assert.doesNotMatch(view, /details\.open\s*=\s*true/);
});

test("discrete drilldown stays flat rather than becoming another card", () => {
  assert.match(css, /\.research-discrete-drilldown\s*\{[\s\S]*?border-top:[^;]+;[\s\S]*?border-bottom:[^;]+;/);
  assert.doesNotMatch(css, /\.research-discrete-drilldown\s*\{[\s\S]*?border-radius\s*:/);
  assert.doesNotMatch(css, /\.research-discrete-drilldown\s*\{[\s\S]*?box-shadow\s*:/);
  assert.match(css, /\.research-discrete-drilldown > \.milestone-table\s*\{[\s\S]*?margin-top:\s*0/);
});

test("research integration loads the discrete presentation layer", () => {
  assert.match(host, /import "\.\/research-discrete-density-view\.js";/);
});
