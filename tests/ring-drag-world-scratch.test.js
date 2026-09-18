import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/wheel/ring-drag-controller.js", import.meta.url), "utf8");

test("pointer screen conversion reuses one controller-lifetime world point", () => {
  assert.match(source, /const pointerWorld = \{ x:0, y:0 \};/);

  const start = source.indexOf("function screenToWorld");
  const end = source.indexOf("export function ringAtWorldPoint", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);

  assert.match(body, /target\.x = inverse\.a \* clientX \+ inverse\.c \* clientY \+ inverse\.e;/);
  assert.match(body, /target\.y = inverse\.b \* clientX \+ inverse\.d \* clientY \+ inverse\.f;/);
  assert.doesNotMatch(body, /return \{\s*x:/s);

  assert.match(source, /screenToWorld\(svg, sample\.clientX, sample\.clientY, pointerWorld, inverse\)/);
});
