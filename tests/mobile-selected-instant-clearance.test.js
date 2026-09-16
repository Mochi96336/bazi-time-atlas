import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobileCss = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");
const instrumentCss = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

function mobile480Block(source) {
  const marker = "@media (max-width: 480px)";
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, "480px mobile composition block must exist");
  return source.slice(index);
}

test("mobile keeps the Selected Instant datum while shared reading CSS owns the redundant caption", () => {
  const mobile = mobile480Block(mobileCss);
  assert.doesNotMatch(
    mobileCss,
    /\.cursor-note/,
    "mobile-time.css must not define a second Selected Instant caption policy"
  );
  assert.match(
    instrumentCss,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/,
    "ordinary reading must retire the redundant caption through the shared instrument owner"
  );
  assert.doesNotMatch(
    mobile,
    /#cursor-layer\s+\.cursor-line\s*\{[^}]*display:\s*none;/s,
    "the shared Selected Instant datum line must remain visible"
  );
});
