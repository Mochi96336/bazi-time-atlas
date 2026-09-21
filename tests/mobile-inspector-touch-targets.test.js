import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../ganzhi-inspector.css", import.meta.url), "utf8");

test("mobile Ganzhi inspector exposes real touch targets without inflating its header", () => {
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.ganzhi-inspector-head \{\s*padding:\s*6px 14px;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.ganzhi-inspector-close \{[\s\S]*?min-height:\s*36px;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.ganzhi-inspector-pillar-switch \{[\s\S]*?min-height:\s*38px;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.ganzhi-structure-tab \{[\s\S]*?min-height:\s*38px;/);
});
