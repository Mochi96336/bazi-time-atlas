import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../ring-identity.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("B7: each time ring carries one low-chroma cool identity hue; Solar keeps amber", () => {
  assert.match(css, /#kinetic-instrument \{ --hour:#6f86a8; --day:#5f958c; --month:#8f84b0; --year:#a4afc2; \}/);
  for (const ring of ["hour", "day", "month", "year"]) {
    const rule = `:not([data-classification-overlay="on"]) #${ring}-track .${ring}-sector { fill: color-mix(in srgb, var(--${ring}) `;
    assert.ok(css.includes(rule), `missing identity veil for ${ring}`);
  }
  assert.doesNotMatch(css, /solar|zodiac|!important/);
});

test("B7 stylesheet loads after the radial hierarchy it refines", () => {
  assert.ok(html.indexOf('href="./ring-identity.css"') > html.indexOf('href="./radial-hierarchy.css"'));
});
