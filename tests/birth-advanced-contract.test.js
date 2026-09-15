import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, script] = await Promise.all([
  readFile(new URL("../birth.html", import.meta.url), "utf8"),
  readFile(new URL("../birth-advanced.css", import.meta.url), "utf8"),
  readFile(new URL("../src/birth-advanced-mode.js", import.meta.url), "utf8")
]);

const advanced = html.match(/<details id="birth-advanced-controls"[\s\S]*?<\/details>/)?.[0] ?? "";
const beforeAdvanced = html.slice(0, html.indexOf('<details id="birth-advanced-controls"'));

test("basic Birth flow owns date and local clock while conventions live in Advanced", () => {
  assert.match(beforeAdvanced, /id="birth-year"/);
  assert.match(beforeAdvanced, /id="birth-hour"/);
  assert.doesNotMatch(beforeAdvanced, /id="birth-utc-offset"/);
  assert.match(advanced, /id="birth-utc-offset"/);
  assert.match(advanced, /name="day-boundary"/);
  assert.match(advanced, /class="time-basis-note"/);
  assert.match(html, /id="birth-advanced-summary"/);
});

test("advanced presentation is one-column on narrow phones and full-width in compact layout", () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*birth-advanced-controls[^}]*grid-column:\s*1 \/ -1/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.birth-controls\s*\{\s*grid-template-columns:\s*1fr;/);
});

test("Advanced only auto-opens for explicit advanced or longitude research context", () => {
  assert.match(script, /query\.get\("advanced"\) === "1" \|\| query\.has\("lon"\)/);
  assert.doesNotMatch(script, /query\.has\("utc"\)/);
  assert.match(script, /panel\.dataset\.advancedSummary = text/);
});
