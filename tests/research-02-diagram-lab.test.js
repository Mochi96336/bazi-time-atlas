import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,css,js,production]=await Promise.all([
  readFile(new URL("../prototypes/research-02-diagram-lab.html",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-02-diagram-lab.css",import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-02-diagram-lab.js",import.meta.url),"utf8"),
  readFile(new URL("../recurrence.html",import.meta.url),"utf8")
]);

test("Research 02 diagram lab stays outside production",()=>{
  assert.doesNotMatch(production,/research-02-diagram-lab/);
  assert.match(html,/noindex,nofollow/);
  assert.match(html,/\.\.\/research-foundations\.css/);
});

test("Research 02 lab compares exactly three independent diagram grammars",()=>{
  const directions=[...html.matchAll(/<section class="diagram-direction" data-direction="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(directions,["zero","ring","decompose"]);
  assert.match(html,/A · Zero-line proof/);
  assert.match(html,/B · Solar-year ring/);
  assert.match(html,/C · Common shift \+ shape/);
});

test("Research 02 lab reads the production seasonal timeline and BaZi Jie boundaries",()=>{
  assert.match(js,/SEASONAL_DRIFT_26026_RESEARCH as DATA/);
  assert.match(js,/from "\.\.\/src\/research\/bazi-seasonal-boundaries\.js"/);
  assert.match(js,/baziJieDriftSummary/);
  assert.match(js,/targetYearFrameIndependentlyValidated/);
  assert.doesNotMatch(js,/10\.235|14\.177/);
});

test("Research 02 directions keep one explicit claim each",()=>{
  assert.match(html,/0 天＝真的回到原位/);
  assert.match(html,/同一太陽黃經，卻在公曆／TT 年輪上提早到達/);
  assert.match(html,/先把共同提前量拿出來/);
  assert.match(html,/24,000 是離散候選，不是完整八字週期/);
});

test("Research 02 lab uses foundation semantics instead of a second raw palette",()=>{
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  for(const token of ["--research-diagram-active-current","--research-candidate","--research-text-primary","--research-diagram-structure","--research-type-body"])assert.ok(css.includes(token));
});