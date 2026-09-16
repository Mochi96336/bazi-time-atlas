import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, uxCss, actionCss] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../ux-analysis.css", import.meta.url), "utf8"),
  readFile(new URL("../main-action-hierarchy.css", import.meta.url), "utf8")
]);

test("playback remains the same lifecycle control while the UX layer owns its hierarchy", () => {
  assert.match(
    html,
    /id="play-button"[^>]*aria-pressed="false"[^>]*>播放<\/button>/,
    "playback controller must keep its canonical #play-button and aria-pressed lifecycle"
  );
  assert.match(
    uxCss,
    /^@import\s+["']\.\/main-action-hierarchy\.css["'];/,
    "main action hierarchy must load through the late UX stylesheet so it can override base toolbar presentation"
  );
});

test("playback does not use the cursor-yellow primary treatment", () => {
  assert.match(
    actionCss,
    /#play-button\.primary\s*\{[^}]*background\s*:\s*rgba\(15,\s*19,\s*16,\s*\.72\)[^}]*border-color\s*:\s*var\(--hairline\)/s,
    "resting playback should read like an ordinary time control"
  );
  assert.doesNotMatch(
    actionCss,
    /#play-button\.primary[^}]*background\s*:\s*var\(--cursor\)/s,
    "playback must not reclaim the page's cursor-yellow primary visual"
  );
  assert.match(
    actionCss,
    /#play-button\.primary\[aria-pressed="true"\]\s*\{[^}]*background\s*:\s*rgba\(199,\s*217,\s*205,\s*\.09\)/s,
    "running playback still needs a distinct but secondary state"
  );
});
