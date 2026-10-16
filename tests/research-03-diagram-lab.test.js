import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,css,js,production]=await Promise.all([
  readFile(new URL("../prototypes/research-03-diagram-lab.html",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-03-diagram-lab.css",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-03-diagram-lab.js",import.meta.url),"utf8"),
  readFile(new URL("../recurrence.html",import.meta.url),"utf8")
]);

test("Research 03 lab stays prototype-only and compares three evidence grammars",()=>{
  assert.doesNotMatch(production,/research-03-diagram-lab/);
  assert.match(html,/noindex,nofollow/);
  const directions=[...html.matchAll(/<section class="diagram-direction" data-direction="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(directions,["pillars","fork","claims"]);
});

test("Research 03 lab derives pillar epistemic state from production logic",()=>{
  assert.match(js,/fourPillarDeterminacy/);
  assert.match(js,/ABSOLUTE_BOUNDARY_CONSEQUENCE_24000/);
  assert.match(js,/day:model\.pillars\.day\.resolved\?"supported":"unknown"/);
  assert.match(js,/hour:model\.pillars\.hour\.resolved\?"supported":"unknown"/);
  assert.doesNotMatch(js,/10\.235|14\.177/);
});

test("Research 03 never calls unresolved Day or Hour different",()=>{
  assert.match(html,/日／時不是「不同」，而是目前證據不足/);
  assert.match(html,/未能判定/);
  assert.match(html,/不能把「節界未重現」直接偷換成「每個四柱一定不同」/);
  assert.doesNotMatch(html,/日柱不同|時柱不同|日／時不同/);
});

test("Research 03 lab separates pillar, reference-frame and claim grammars",()=>{
  assert.match(html,/A · Four-pillar verdict band/);
  assert.match(html,/B · Alignment fork/);
  assert.match(html,/C · Claim ladder/);
  assert.match(html,/同一太陽黃經/);
  assert.match(html,/固定推進 24,000 公曆年/);
  assert.match(html,/可以證/);
  assert.match(html,/可以否定/);
  assert.match(html,/目前不能說/);
});

test("Research 03 lab uses foundation semantics without a raw palette",()=>{
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  for(const token of ["--research-candidate","--research-text-primary","--research-diagram-context","--research-line-subtle","--research-type-body"])assert.ok(css.includes(token));
});