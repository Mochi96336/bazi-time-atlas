import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [seasonal,determinacy,consequence]=await Promise.all([
  readFile(new URL("../research-seasonal-drift-evidence.css",import.meta.url),"utf8"),
  readFile(new URL("../four-pillar-determinacy.css",import.meta.url),"utf8"),
  readFile(new URL("../research-absolute-boundary-consequence.css",import.meta.url),"utf8")
]);

test("Research 02 core orbit annotations use the shared readable type floor",()=>{
  assert.match(seasonal,/\.seasonal-orbit-time-label\s*\{[\s\S]*?font-size:var\(--research-type-plot\)/);
  assert.match(seasonal,/\.seasonal-drift-orbit-explainer \.seasonal-drift-orbit-head span,[\s\S]*?font-size:var\(--research-type-meta\)/);
  assert.match(seasonal,/\.seasonal-drift-orbit-explainer #seasonal-drift-orbit-scale\s*\{[\s\S]*?font-size:var\(--research-type-plot\)/);
  assert.match(seasonal,/\.seasonal-orbit-explainer-note\s*\{[\s\S]*?font-size:var\(--research-type-meta\)/);
  assert.match(seasonal,/zero-line-proof[^}]*\.seasonal-drift-stat > span,[\s\S]*?font-size:var\(--research-type-meta\)/);
});

test("Research 03 mobile core explanation does not shrink below metadata size",()=>{
  assert.match(determinacy,/pillar-verdict[^}]*\.determinacy-card header span\s*\{[^}]*font-size:var\(--research-type-meta\)/);
  assert.match(determinacy,/pillar-verdict[^}]*\.determinacy-card p\s*\{[^}]*font-size:var\(--research-type-meta\)/);
  assert.match(consequence,/\.research-alignment-fork small\s*\{[^}]*font-size:var\(--research-type-meta\)/);
});
