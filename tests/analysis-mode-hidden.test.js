import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../ux-analysis.css", import.meta.url), "utf8")
]);

test("analysis exit control starts hidden in the canonical normal view", () => {
  assert.match(
    html,
    /id="analysis-close"[^>]*\shidden(?:\s|>)/,
    "analysis-close must be hidden before analysis-mode.js resolves the view state"
  );
});

test("author CSS preserves the HTML hidden state for both analysis controls", () => {
  assert.match(
    css,
    /\.analysis-toggle\[hidden\]\s*,\s*\.analysis-close\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important\s*;/s,
    "analysis controls need an author-level hidden guard because their base rule sets display:inline-flex"
  );
});
