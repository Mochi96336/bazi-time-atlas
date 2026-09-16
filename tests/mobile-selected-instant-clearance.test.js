import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");

function mobile480Block(source) {
  const marker = "@media (max-width: 480px)";
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, "480px mobile composition block must exist");
  return source.slice(index);
}

test("mobile keeps the Selected Instant datum but retires the redundant SVG caption", () => {
  const mobile = mobile480Block(css);
  assert.match(
    mobile,
    /#cursor-layer\s+\.cursor-note\s*\{[^}]*display:\s*none;/s,
    "the portrait cursor caption must not collide with the compact layer legend"
  );
  assert.doesNotMatch(
    mobile,
    /#cursor-layer\s+\.cursor-line\s*\{[^}]*display:\s*none;/s,
    "the shared Selected Instant datum line must remain visible"
  );
});
