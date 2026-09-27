import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  H25_COLORS, H25_INSTANTS, H25_REFERENCE_SHA, H25_VARIANTS, h25ExpectedColors, h25OverrideCss
} from "../scripts/home-h25-color-contract.js";

test("H2.5 reference is pinned and variants are an orthogonal 2x2 experiment", () => {
  assert.match(H25_REFERENCE_SHA, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(H25_VARIANTS), ["A0","A1","A2","A3","B1","B2","B3"]);
  assert.deepEqual(Object.values(H25_VARIANTS).slice(0,4).map(v => [v.background,v.zodiac]),
    [[false,false],[true,false],[false,true],[true,true]]);
  assert.equal(H25_INSTANTS.length, 2);
  assert.notEqual(Date.parse(H25_INSTANTS[0]), Date.parse(H25_INSTANTS[1]));
});

test("A0 has zero injected CSS and A1/A2 isolate their only respective factors", () => {
  assert.equal(h25OverrideCss("A0"), "");
  const bg = h25OverrideCss("A1");
  const z = h25OverrideCss("A2");
  const combined = h25OverrideCss("A3");
  assert.match(bg, /--field:\s*#0b1019/);
  assert.match(bg, /--field-raised:\s*#101824/);
  assert.match(bg, /linear-gradient/);
  assert.doesNotMatch(bg, /--zodiac\s*:/);
  assert.match(z, /--zodiac:\s*#47556c/);
  assert.doesNotMatch(z, /--field\s*:|--field-raised\s*:|body\s*\{/);
  assert.ok(combined.includes(bg.replace("/* H2.5 isolated color-only experiment: A1 */\n","").trim()));
  assert.ok(combined.includes(z.replace("/* H2.5 isolated color-only experiment: A2 */\n","").trim()));
  assert.throws(() => h25OverrideCss("unknown"));
});

test("H2.5 B-series tests less-invasive environments without changing original A colors", () => {
  assert.deepEqual(h25ExpectedColors("A0"), {field:"#090b0f",raised:"#0e1116",zodiac:"#424b59"});
  assert.deepEqual(h25ExpectedColors("A1"), {field:"#0b1019",raised:"#101824",zodiac:"#424b59"});
  assert.deepEqual(h25ExpectedColors("A2"), {field:"#090b0f",raised:"#0e1116",zodiac:"#47556c"});
  assert.deepEqual(h25ExpectedColors("B1"), {field:"#090b0f",raised:"#0e1116",zodiac:"#424b59"});
  assert.deepEqual(h25ExpectedColors("B2"), {field:"#0a0d13",raised:"#0e121a",zodiac:"#424b59"});
  assert.deepEqual(h25ExpectedColors("B3"), {field:"#0a0d13",raised:"#0e121a",zodiac:"#47556c"});
  const ambient = h25OverrideCss("B1");
  const restrained = h25OverrideCss("B2");
  const paired = h25OverrideCss("B3");
  assert.match(ambient, /--field:\\s*#090b0f/);
  assert.match(ambient, /rgba\\(123, 145, 171, \\.043\\)/);
  assert.doesNotMatch(ambient, /--zodiac\\s*:/);
  assert.match(restrained, /--field:\\s*#0a0d13/);
  assert.match(restrained, /--field-raised:\\s*#0e121a/);
  assert.match(paired, /--zodiac:\\s*#47556c/);
  assert.ok(paired.includes(restrained.replace("/* H2.5 isolated color-only experiment: B2 */\\n","").trim()));
  for (const id of ["B1","B2","B3"]) assert.doesNotMatch(h25OverrideCss(id),
    /--solar|--cursor|--hour|--day|--month|--year|--classification|filter:|glow|opacity/i);
});

test("H2.5 does not edit cursor, Solar, graphite, active, Classification or GLSL", () => {
  assert.deepEqual(H25_COLORS.current,
    { field:"#090b0f", raised:"#0e1116", zodiac:"#424b59" });
  const css = h25OverrideCss("A3");
  for (const role of ["--cursor","--solar","--hour","--day","--month","--year",
    "--classification","--z-fire","--z-earth","--z-air","--z-water"]) {
    assert.ok(!css.includes(role), "isolation breach: " + role);
  }
  assert.doesNotMatch(css, /cursor-|is-active|\bopacity\b|filter:|shader|glsl/i);
  const shader = readFileSync(new URL("../src/wheel/material-prototype.js",import.meta.url),"utf8");
  const page = readFileSync(new URL("../index.html",import.meta.url),"utf8");
  assert.ok(!shader.includes("home-h25-color"));
  assert.ok(!page.includes("home-h25-color"));
});

test("native screenshot fixture has screenshot-visible readiness and genuine widths", () => {
  const fixture = readFileSync(new URL("../scripts/fixtures/home-h25-color-frame.html",import.meta.url),"utf8");
  const script = readFileSync(new URL("../scripts/visual-check-home-h25-color-lab.mjs",import.meta.url),"utf8");
  assert.match(fixture,/H2\.5 CAPTURE NOT READY/);
  assert.match(fixture,/frame\.style\.width = width/);
  assert.match(fixture,/data-ready="false"/);
  assert.match(script,/baselineReplayIdentical/);
  assert.match(script,/classificationFill/);
  for (const mode of ["svg","roughness","fallback"]) assert.ok(script.includes('"'+mode+'"'));
  for (const width of ["320","390","1440","2047"]) assert.ok(script.includes(width));
});

test("H2.5 CI prepares the local Tyme vendor before loading the real Atlas", () => {
  const flow = readFileSync(new URL("../.github/workflows/home-h25-color-lab.yml", import.meta.url), "utf8");
  const vendor = flow.indexOf("npm run vendor:prepare");
  const capture = flow.indexOf("node scripts/visual-check-home-h25-color-lab.mjs");
  assert.ok(vendor >= 0 && capture > vendor, "native browser evidence requires local Tyme ESM");
});
