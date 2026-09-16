import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hierarchy = readFileSync(new URL("../radial-hierarchy.css", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../mobile-time.css", import.meta.url), "utf8");

test("shared radial hierarchy keeps the Selected Instant datum but retires the redundant SVG caption", () => {
  assert.match(
    hierarchy,
    /#cursor-layer\s+\.cursor-note\s*\{[^}]*display:\s*none;/s,
    "the shared cursor caption must stay retired at every viewport"
  );
  assert.doesNotMatch(
    hierarchy,
    /#cursor-layer\s+\.cursor-line\s*\{[^}]*display:\s*none;/s,
    "the shared Selected Instant datum line must remain visible"
  );
  assert.doesNotMatch(
    mobileCss,
    /#cursor-layer\s+\.cursor-note/,
    "mobile must not duplicate shared cursor-caption ownership"
  );
});
