import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([
  readFile(new URL("../recurrence.html", import.meta.url), "utf8"),
  readFile(new URL("../research-tasks.css", import.meta.url), "utf8")
]);

const discreteStart = html.indexOf('id="research-discrete"');
const astronomyStart = html.indexOf('id="research-astronomy"');
const evidenceStart = html.indexOf('id="research-evidence"');
const discrete = html.slice(discreteStart, astronomyStart);
const astronomy = html.slice(astronomyStart, evidenceStart);
const evidence = html.slice(evidenceStart);

test("Research exposes three ordered task anchors instead of one flat dashboard", () => {
  assert.ok(discreteStart >= 0);
  assert.ok(astronomyStart > discreteStart);
  assert.ok(evidenceStart > astronomyStart);
  assert.match(html, /class="research-task-nav"/);
  assert.match(html, /href="#research-discrete"/);
  assert.match(html, /href="#research-astronomy"/);
  assert.match(html, /href="#research-evidence"/);
  assert.match(html, /research-tasks\.css/);
});

test("discrete task owns the instrument and exact closure evidence only", () => {
  assert.match(discrete, /id="recurrence-instrument"/);
  assert.match(discrete, /class="closure-grid"/);
  assert.match(discrete, /class="milestone-table"/);
  assert.doesNotMatch(discrete, /class="astronomy-panel"/);
  assert.doesNotMatch(discrete, /id="four-pillar-determinacy"/);
});

test("astronomy task owns residual detail and astronomical near-recurrence ranking", () => {
  assert.match(astronomy, /class="astronomy-panel"/);
  assert.match(astronomy, /id="astronomy-term-grid"/);
  assert.match(astronomy, /class="near-search-panel"/);
  assert.doesNotMatch(astronomy, /id="four-pillar-determinacy"/);
});

test("evidence task owns determinacy and the model appendix", () => {
  assert.match(evidence, /id="four-pillar-determinacy"/);
  assert.match(evidence, /class="model-boundary research-evidence-appendix"/);
  assert.doesNotMatch(evidence, /class="near-search-panel"/);
});

test("task navigation stays three-column without horizontal-scroll ownership on phone", () => {
  assert.match(css, /\.research-task-nav\s*\{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:480px\)[\s\S]*grid-template-areas:"index" "title"/);
  assert.doesNotMatch(css, /overflow-x\s*:\s*(auto|scroll)/);
});
