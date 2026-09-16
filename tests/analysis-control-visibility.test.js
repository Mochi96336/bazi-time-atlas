import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../ux-analysis.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const mode = readFileSync(new URL("../src/analysis-mode.js", import.meta.url), "utf8");

test("analysis entry and exit controls are visually mutually exclusive", () => {
  assert.match(
    html,
    /id="analysis-close"[^>]*\shidden(?:\s|>)/,
    "the default document must start with the exit control hidden"
  );
  assert.match(
    css,
    /\.analysis-toggle\[hidden\],\s*\.analysis-close\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s,
    "author CSS must not paint a semantically hidden analysis control"
  );
  assert.match(mode, /openControl\.hidden\s*=\s*Boolean\(open\)/);
  assert.match(mode, /closeControl\.hidden\s*=\s*!open/);
});
