import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../discrete-phase.css", import.meta.url), "utf8");

test("continuous tracks retire the old intra-tooth arc and bead without hiding boundary gates", () => {
  assert.match(
    css,
    /\.state-phase-progress,\s*\n\.state-phase-bead\s*\{[^}]*display:\s*none\s*!important;/s,
    "the old phase arc/bead must stay visually retired once the whole ring owns phase motion"
  );
  assert.match(css, /\.state-boundary-gate\s*\{[^}]*stroke-width:/s);
  assert.match(css, /\.state-boundary-gate\.is-shared\s*\{[^}]*stroke:\s*var\(--cursor\)/s);
  assert.doesNotMatch(
    css,
    /\.state-boundary-gate[^}]*display:\s*none\s*!important/s,
    "exact boundary gates must remain independently renderable"
  );
});
