import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../instrument-first.css", import.meta.url), "utf8");

test("instrument-first reset is loaded last among homepage styles", () => {
  const reset = html.indexOf('href="./instrument-first.css"');
  const inspector = html.indexOf('href="./ganzhi-inspector.css"');
  assert.ok(reset > inspector && inspector >= 0);
});

test("desktop reading view removes narrative and elevated card chrome", () => {
  assert.match(css, /@media \(min-width: 481px\)/);
  assert.match(css, /\.atlas-intro\s*\{\s*display:\s*none;/);
  assert.match(css, /\.instrument-shell\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
});

test("desktop wheel owns the viewport instead of a capped document column", () => {
  assert.match(
    css,
    /\.kinetic-shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?padding:\s*12px 0 22px;/
  );
  assert.doesNotMatch(css, /\.kinetic-shell\s*\{[^}]*width:\s*min\(1760px,\s*100%\)/s);
  assert.match(
    css,
    /\.instrument-shell\s*\{[\s\S]*?height:\s*max\(720px,\s*calc\(100dvh - 52px\)\);[\s\S]*?container-type:\s*size;/
  );
  assert.match(
    css,
    /\.kinetic-topbar\s*\{[^}]*padding-inline:\s*clamp\(14px,\s*2vw,\s*32px\);/s,
    "full-bleed wheel must not push product/navigation chrome against the viewport edge"
  );
});

test("wide desktop ring identities follow camera height instead of old width percentages", () => {
  assert.match(css, /@media \(min-width: 821px\)/, "wide desktop identity placement override must exist");
  for (const [ring, offset, top] of [
    ["year", "57.08", "36.26"],
    ["month", "49.08", "51.97"],
    ["solar", "41.08", "67.67"],
    ["day", "34.14", "81.28"],
    ["hour", "32.01", "85.47"]
  ]) {
    assert.match(
      css,
      new RegExp(`\\.ring-${ring}\\s*\\{[^}]*left:\\s*calc\\(50% - ${offset}cqh\\);[^}]*top:\\s*${top}%;`, "s"),
      `${ring} identity should stay on the intended radial spoke across desktop aspect ratios`
    );
  }
  assert.doesNotMatch(css, /\.ring-(?:year|month|solar|day|hour)\s*\{[^}]*left:\s*\d+(?:\.\d+)?%;/s);
});

test("mobile reading view removes hero/card chrome without stealing shell scroll ownership", () => {
  const mobile = css.match(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/);
  assert.ok(mobile, "mobile instrument-first override must exist");
  assert.doesNotMatch(mobile[1], /\.kinetic-shell\s*\{/);
  assert.doesNotMatch(mobile[1], /grid-template-rows/);
  assert.match(mobile[1], /\.atlas-intro\s*\{\s*display:\s*none;/);
  assert.match(mobile[1], /\.instrument-shell\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
});

test("mobile ordinary reading keeps exact-time chrome flat with M2 etched rails", () => {
  assert.match(css, /^@import "\.\/graphite-m2-material\.css";/);
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-top:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*inset 0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    css,
    /\.mobile-time-dock #mobile-instant-input\s*\{[\s\S]*?border-bottom:\s*1px solid var\(--m2-etched-dark-soft\);[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*0 1px 0 var\(--m2-etched-light-soft\);/
  );
  assert.match(
    css,
    /\.mobile-time-dock #mobile-time-apply\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?color:\s*var\(--cursor\);[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock\s*\{[^}]*display:\s*none;/s
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \+ \.mobile-time-dock/,
    "runtime-inserted Analysis siblings must not disable ordinary mobile flattening"
  );
});

test("mobile ordinary idle exact-time rail removes duplicate metadata but preserves feedback states", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock \.mobile-time-heading\s*\{[^}]*justify-content:\s*flex-end;/s
  );
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock \.mobile-time-heading strong,[\s\S]*?#mobile-time-status\[data-state="idle"\]\s*\{\s*display:\s*none;/
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.mobile-time-dock #mobile-time-status:not\(\[data-state="idle"\]\)\s*\{[^}]*display:\s*none;/s
  );
});

test("ordinary reading keeps long-form notes and provenance footer out of the main path", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.atlas-notes,[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.sources-panel\s*\{\s*display:\s*none;/
  );
});

test("ordinary reading hides observation-window presets and analysis transport chrome", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.scale-button,[\s\S]*?#classification-overlay-button,[\s\S]*?#play-button\s*\{\s*display:\s*none;/
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.scale-button\s*\{[^}]*display:\s*none;/s
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #now-button\s*\{[^}]*display:\s*none;/s
  );
});

test("ordinary time navigation leaves Now as the only toolbar shortcut", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-toolbar\s*\{[\s\S]*?justify-content:\s*flex-start;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*2px;/
  );
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-toolbar > \.toolbar-group\s*\{[\s\S]*?flex-wrap:\s*nowrap;/
  );
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.instrument-toolbar > \.toolbar-group:last-child\s*\{[\s\S]*?margin-left:\s*1px;/
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] \.instrument-toolbar\s*\{[^}]*justify-content:\s*flex-start;/s
  );
});

test("ordinary reading retires the duplicate Selected Instant caption", () => {
  assert.match(
    css,
    /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) #cursor-layer \.cursor-note\s*\{\s*display:\s*none;/
  );
  assert.doesNotMatch(
    css,
    /#kinetic-instrument\[data-analysis-open="true"\] #cursor-layer \.cursor-note\s*\{[^}]*display:\s*none;/s
  );
});

test("wide desktop ordinary reading makes the read-head the sole exact-time surface", () => {
  assert.match(
    css,
    /@media \(min-width: 821px\) \{[\s\S]*?#kinetic-instrument:not\(\[data-analysis-open="true"\]\) ~ \.timeline-dock\s*\{\s*display:\s*none;/,
    "ordinary desktop must not render a second exact-time input below the read-head"
  );
  assert.match(css, /#kinetic-instrument:not\(\[data-analysis-open="true"\]\) \.readout-meta,[\s\S]*?\.boundary-meta\s*\{\s*display:\s*none;/);
  assert.match(css, /#kinetic-instrument\[data-analysis-open="true"\] ~ \.timeline-dock\s*\{\s*opacity:\s*1;/);
});
