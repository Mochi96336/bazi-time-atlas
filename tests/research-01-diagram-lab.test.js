import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html,css,js,productionHtml] = await Promise.all([
  readFile(new URL("../prototypes/research-01-diagram-lab.html", import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-01-diagram-lab.css", import.meta.url),"utf8"),
  readFile(new URL("../prototypes/research-01-diagram-lab.js", import.meta.url),"utf8"),
  readFile(new URL("../recurrence.html", import.meta.url),"utf8")
]);

test("Research 01 diagram lab stays outside production navigation", () => {
  assert.doesNotMatch(productionHtml,/research-01-diagram-lab/);
  assert.match(html,/meta name="robots" content="noindex,nofollow"/);
  assert.match(html,/\.\.\/research-foundations\.css/);
});

test("Research 01 lab exposes exactly three independent diagram directions", () => {
  const directions = [...html.matchAll(/<section class="diagram-direction" data-direction="([^"]+)"/g)]
    .map(match => match[1]);
  assert.deepEqual(directions,["ladder","tracks","origin"]);
  assert.match(html,/A · Condition ladder/);
  assert.match(html,/B · Phase alignment tracks/);
  assert.match(html,/C · Solar-origin map/);
});

test("Research 01 lab uses production recurrence truth instead of hardcoded phase states", () => {
  assert.match(js,/import \{ recurrenceState \} from "\.\.\/src\/recurrence\/gregorian-cycle\.js"/);
  assert.match(js,/const DELTAS = Object\.freeze\(\[400,1200,8000,1980,24000\]\)/);
  assert.match(js,/recurrenceState\(BASE_DATE,delta\)/);
  assert.match(js,/document\.documentElement\.dataset\.diagramLabReady = "true"/);
});

test("Research 01 lab consumes foundation tokens instead of inventing a second palette", () => {
  assert.doesNotMatch(css,/#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css,/rgba?\(/);
  assert.doesNotMatch(css,/font-size\s*:\s*[0-9.]+px/);
  assert.match(css,/var\(--research-current\)/);
  assert.match(css,/var\(--research-candidate\)/);
  assert.match(css,/var\(--research-text-primary\)/);
  assert.match(css,/var\(--research-diagram-structure\)/);
  assert.match(css,/var\(--research-type-body\)/);
});

test("diagram directions keep one explicit visual claim each", () => {
  assert.match(html,/把「提高條件」本身畫成主角/);
  assert.match(html,/直接看三個相位有沒有同時對線/);
  assert.match(html,/先解釋「為什麼公曆值得拿來對」/);
  assert.match(html,/不是找 1,980 的倍數/);
  assert.match(html,/公曆結構與十二節／八字月序不是同一系統/);
});
