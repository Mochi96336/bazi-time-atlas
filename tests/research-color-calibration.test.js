import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html=readFileSync(new URL("../recurrence.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../research-color-calibration.css",import.meta.url),"utf8");

test("Research color calibration is the final page-specific visual layer",()=>{
  const navigation=html.indexOf('href="./navigation-workspace.css"');
  const calibration=html.indexOf('href="./research-color-calibration.css"');
  assert.ok(navigation>=0 && calibration>navigation);
});

test("Research calibration centralizes one graphite field and semantic task accents",()=>{
  for(const token of [
    "--research-field: #090d12",
    "--research-discrete: #93afbd",
    "--research-astronomy: #c59563",
    "--research-evidence: #86a1ba",
    "--gregorian: #aa97c8",
    "--year: #c5a96f",
    "--day: #78aabd",
    "--cursor: #efe2ad"
  ]) assert.ok(css.includes(token),token);

  assert.match(css,/#research-astronomy \.research-task-index \{ color: var\(--research-astronomy\); \}/);
  assert.match(css,/#research-evidence \.research-task-index \{ color: var\(--research-evidence\); \}/);
  assert.match(css,/\.research-cycle-inline-year strong \{ color: #d4bd82; \}/);
  assert.match(css,/\.research-cycle-inline-day strong \{ color: #9bc8d7; \}/);
});

test("color pass does not become a hidden layout rewrite",()=>{
  const forbidden=/^\s*(?:display|position|width|height|min-width|max-width|min-height|max-height|margin|padding|gap|grid(?:-[a-z-]+)?|flex(?:-[a-z-]+)?|inset|top|right|bottom|left|transform|font-size|line-height|letter-spacing)\s*:/m;
  assert.doesNotMatch(css,forbidden);
});

test("status colors stay semantic rather than sharing one decorative accent",()=>{
  assert.match(css,/data-resolved="true"[\s\S]*color: #91c7ad/);
  assert.match(css,/not-resolved-by-shape-model[\s\S]*color: #bd8377/);
  assert.match(css,/identical-by-definition[\s\S]*color: #c1ad79/);
  assert.match(css,/data-qualified-coverage="true"\] header b \{ color: #83afc4; \}/);
});
