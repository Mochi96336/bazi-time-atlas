import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [foundations,discrete,seasonal,determinacy,consequence]=await Promise.all([
  readFile(new URL("../research-foundations.css",import.meta.url),"utf8"),
  readFile(new URL("../research-discrete-density.css",import.meta.url),"utf8"),
  readFile(new URL("../research-seasonal-drift-evidence.css",import.meta.url),"utf8"),
  readFile(new URL("../four-pillar-determinacy.css",import.meta.url),"utf8"),
  readFile(new URL("../research-absolute-boundary-consequence.css",import.meta.url),"utf8")
]);

test("Research semantic accents expose matching quiet surface roles",()=>{
  for(const token of [
    "--research-current-soft","--research-current-line",
    "--research-candidate-soft","--research-candidate-line",
    "--research-unresolved-soft"
  ]) assert.ok(foundations.includes(token+":"),token+" missing");
});

test("01 carries current and candidate color over meaningful area, not only text",()=>{
  assert.match(discrete,/is-local-recurrence[\s\S]*?background:linear-gradient\(180deg,var\(--research-current-soft\)/);
  assert.match(discrete,/is-global-closure[\s\S]*?background:linear-gradient\(180deg,var\(--research-candidate-soft\)/);
});

test("02 distinguishes base/current geometry from the candidate target",()=>{
  assert.match(seasonal,/\.seasonal-orbit-time-base \{ stroke:var\(--research-current\)/);
  assert.match(seasonal,/\.seasonal-orbit-time-target[\s\S]*?stroke:var\(--research-diagram-active-candidate\)/);
  assert.match(seasonal,/\.seasonal-boundary-proof-head strong[\s\S]*?color:var\(--research-candidate\)/);
});

test("03 gives resolved and unresolved conclusions distinct semantic surfaces",()=>{
  assert.match(determinacy,/data-resolved="true"[\s\S]*?var\(--research-candidate-soft\)/);
  assert.match(determinacy,/data-resolved="false"[\s\S]*?var\(--research-unresolved-soft\)/);
  assert.match(consequence,/data-alignment-claim="solar"[\s\S]*?var\(--research-candidate-soft\)/);
  assert.match(consequence,/data-alignment-claim="calendar"[\s\S]*?var\(--research-unresolved-soft\)/);
});
