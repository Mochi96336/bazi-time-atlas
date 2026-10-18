import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,css,js,production]=await Promise.all([
  readFile(new URL("../prototypes/research-full-page-rhythm-lab.html",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-full-page-rhythm-lab.css",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-full-page-rhythm-lab.js",import.meta.url),"utf8"),
  readFile(new URL("../recurrence.html",import.meta.url),"utf8")
]);

test("full-page rhythm lab stays prototype-only",()=>{
  assert.doesNotMatch(production,/research-full-page-rhythm-lab/);
  assert.match(html,/noindex,nofollow/);
  assert.ok(html.includes("../research-foundations.css"));
});

test("core research figures stay unfolded in the main reading spine",()=>{
  const figures=[...html.matchAll(/data-core-figure="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(figures,[
    "condition-ladder","year-strip","phase-fan","delta-control",
    "zero-proof","orbit-view","residual-strip",
    "pillar-verdict","alignment-fork"
  ]);
  for(const block of html.matchAll(/<details[\s\S]*?<\/details>/g)){
    assert.doesNotMatch(block[0],/data-core-figure=/);
  }
  assert.equal((html.match(/data-support/g)??[]).length,2);
});

test("lab compares editorial and gallery spacing without changing research semantics",()=>{
  assert.match(html,/data-mode-link="editorial"/);
  assert.match(html,/data-mode-link="gallery"/);
  assert.match(js,/dataset\.mode=mode/);
  assert.match(html,/12 \/ 12/);
  assert.match(html,/固定 \+24,000 公曆年 ≠ 完整「時間 → 八字」精確週期/);
  assert.match(html,/日／時仍未能判定/);
});

test("rhythm lab uses semantic foundation tokens and explicit whitespace scales",()=>{
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  assert.match(css,/--scene-gap:112px/);
  assert.match(css,/--scene-gap:152px/);
  assert.match(css,/--transition-space:144px/);
  assert.match(css,/var\(--research-candidate\)/);
  assert.match(css,/var\(--research-current\)/);
  assert.match(css,/var\(--research-diagram-structure\)/);
});
