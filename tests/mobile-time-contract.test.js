import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../mobile-time.css", import.meta.url), "utf8")
]);

test("mobile atlas exposes a dedicated second-level exact-time dock", () => {
  assert.match(html, /id="mobile-time-dock"/);
  assert.match(html, /id="mobile-instant-input"[^>]*step="1"/);
  assert.match(html, /id="mobile-time-apply"/);
  assert.match(html, /src="\.\/src\/mobile-time-control\.js"/);
  assert.match(html, /href="\.\/mobile-time\.css"/);
});

test("mobile shell scrolls internally while preserving the instrument-first viewport", () => {
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.kinetic-shell\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /\.mobile-time-dock\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.timeline-dock,[\s\S]*\.sources-panel\s*\{\s*display:\s*none;/);
});
