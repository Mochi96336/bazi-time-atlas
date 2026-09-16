import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const boundaries = readFileSync(new URL("../kinetic-boundaries.css", import.meta.url), "utf8");

test("Graphite M2 boundary chrome is neutral rather than moss-green", () => {
  for (const legacy of [
    "#7f8982",
    "#d7ddd8",
    "#111512",
    "#68726b",
    "#5f6962",
    "#778078",
    "#778179",
    "#cbd1cc",
    "rgba(15,19,16,.78)",
    "rgba(238, 242, 237, .13)",
    "rgba(238, 242, 237, .27)"
  ]) {
    assert.doesNotMatch(boundaries, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(boundaries, /\.boundary-meta \{[\s\S]*?color:\s*#85898a;/);
  assert.match(boundaries, /#guide-layer \.guide-arc \{ stroke: rgba\(236, 239, 239, \.13\); \}/);
  assert.match(boundaries, /\.reference-frame-control \{[\s\S]*?color:\s*#7a7f80;/);
  assert.match(boundaries, /\.reference-frame-control select \{[\s\S]*?background:\s*rgba\(15,17,18,\.78\);/);
});

test("neutral chrome does not disturb the matte material contract", () => {
  assert.doesNotMatch(boundaries, /filter:\s*url\(|feTurbulence|background-image:\s*url\(/);
  assert.match(boundaries, /#kinetic-wheel\[data-active-ring="solar"\][\s\S]*?rgba\(244, 230, 183, \.58\)/);
});
