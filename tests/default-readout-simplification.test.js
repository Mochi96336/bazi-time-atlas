import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../instrument-first.css", import.meta.url), "utf8")
]);

test("ordinary reading keeps one timestamp while diagnostics stay Analysis-only", () => {
  assert.match(html, /id="instant-readout">—<\/div>/);
  assert.match(html, /class="readout-meta">/);
  assert.match(html, /class="boundary-meta">/);
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.readout-meta,[\s\S]*?\.boundary-meta\s*\{\s*display:\s*none;/
  );
});

test("ordinary exact-time input is reduced to a quiet inline control", () => {
  assert.match(html, /id="instant-input"[^>]*type="datetime-local"/);
  assert.match(css, /grid-template-columns:\s*minmax\(190px,\s*230px\);/);
  assert.match(css, /opacity:\s*\.48;/);
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock \.instant-field input\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*transparent;/
  );
});

test("Now remains reachable but loses pill chrome", () => {
  assert.match(html, /id="now-button"[^>]*>現在<\/button>/);
  const nowRule = css.match(/#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(nowRule);
  assert.match(nowRule, /border-color:\s*transparent;/);
  assert.match(nowRule, /background:\s*transparent;/);
  assert.doesNotMatch(nowRule, /display:\s*none/);
});
