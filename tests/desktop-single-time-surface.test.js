import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

test("ordinary desktop reading has one textual exact-time surface", () => {
  const desktop = css.match(/@media \(min-width: 481px\) \{([\s\S]*?)\n\}/);
  assert.ok(desktop, "desktop instrument-first override must exist");
  assert.match(
    desktop[1],
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-readout\s*\{\s*display:\s*none;/
  );
  assert.match(
    desktop[1],
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock\s*\{[\s\S]*?grid-template-columns:\s*minmax\(190px, 230px\);/
  );
});

test("Analysis keeps the diagnostic readout available", () => {
  assert.doesNotMatch(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-readout\s*\{[^}]*display:\s*none;/s
  );
});
