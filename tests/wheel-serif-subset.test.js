import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { solarTerms, zodiacSigns } from "../src/data.js";
import { HEAVENLY_STEMS } from "../src/calendar/ten-gods.js";

const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const RING_NAMES = "年月太陽日時";
const manifest = JSON.parse(readFileSync(new URL("../assets/fonts/noto-serif-tc-wheel.json", import.meta.url), "utf8"));

test("the wheel serif subset covers every label the home wheel can draw", () => {
  const needed = [
    ...HEAVENLY_STEMS.join(""),
    ...BRANCHES,
    ...solarTerms.map(term => term.name).join(""),
    ...zodiacSigns.map(sign => sign.name).join(""),
    ...RING_NAMES
  ];
  const covered = new Set(manifest.text);
  const missing = [...new Set(needed.filter(char => !covered.has(char)))];
  assert.deepEqual(missing, [], "rebuild with scripts/subset-wheel-serif.py");
});

test("the wheel serif ships as one small woff2 declared by the finish stylesheet", () => {
  const font = new URL("../assets/fonts/noto-serif-tc-wheel.woff2", import.meta.url);
  const bytes = readFileSync(font);
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2");
  assert.ok(statSync(font).size < 60_000, "subset should stay small");
  const css = readFileSync(new URL("../atlas-wheel-finish.css", import.meta.url), "utf8");
  assert.match(css, /font-family:\s*"Atlas Wheel Serif"/);
  assert.match(css, /noto-serif-tc-wheel\.woff2/);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<html[^>]*data-look="lacquer"/);
  assert.match(html, /rel="preload" href="\.\/assets\/fonts\/noto-serif-tc-wheel\.woff2"/);
});
